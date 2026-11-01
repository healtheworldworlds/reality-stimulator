// Multipart video/screenshot ingestion with a stubbed OCR/vision pipeline.
// Pipeline: uploaded media -> [vision stub] -> transcript -> parser -> LiveFixture[].
// Swap stubVisionTranscript for a real OCR engine (Tesseract, a vision API, …) later;
// extractFixturesFromTranscript is the shared seam that genuine OCR output will use.
// Access is admin-only: every request must carry a valid x-admin-key header.
import { isAdminKey } from './admin-auth.ts'

export interface IngestMediaRequest {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface IngestMediaResponse {
  setHeader: (name: string, value: string | number) => void
  status: (code: number) => IngestMediaResponse
  json: (body: unknown) => IngestMediaResponse
}

interface LiveFixture {
  id: string
  kickoff: string
  kickoffDate: string
  status: string
  competition: string
  home: string
  away: string
  marketType?: '1X2' | 'Over1.5' | 'Over2.5' | 'SHH'
  selectedOption?: '1' | 'X' | '2'
  sportyOdd?: number
  generatedId?: string
  teams?: { home: string; away: string }
}

type MarketType = NonNullable<LiveFixture['marketType']>

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const MAX_FIXTURES = 50
const MAX_TRANSCRIPT_CHARS = 20000
const MAX_FILE_NAME_CHARS = 120

class PayloadTooLargeError extends Error {}

async function readRawBody(request: IngestMediaRequest): Promise<Buffer> {
  if (Buffer.isBuffer(request.body)) {
    if (request.body.length > MAX_UPLOAD_BYTES) throw new PayloadTooLargeError()
    return request.body
  }
  if (typeof request.body === 'string') {
    const buffered = Buffer.from(request.body, 'latin1')
    if (buffered.length > MAX_UPLOAD_BYTES) throw new PayloadTooLargeError()
    return buffered
  }
  const stream = request as unknown as AsyncIterable<Uint8Array>
  if (typeof stream?.[Symbol.asyncIterator] !== 'function') return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    total += chunk.length
    if (total > MAX_UPLOAD_BYTES) throw new PayloadTooLargeError()
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

type MultipartPart = {
  name: string
  filename?: string
  contentType?: string
  data: Buffer
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const delimiter = Buffer.from(`--${boundary}`, 'latin1')
  const parts: MultipartPart[] = []
  let cursor = body.indexOf(delimiter)
  while (cursor !== -1) {
    const next = body.indexOf(delimiter, cursor + delimiter.length)
    if (next === -1) break
    let segment = body.subarray(cursor + delimiter.length, next)
    if (segment[0] === 0x2d && segment[1] === 0x2d) break // closing "--" of the final boundary
    if (segment[0] === 0x0d && segment[1] === 0x0a) segment = segment.subarray(2)
    if (segment[segment.length - 2] === 0x0d && segment[segment.length - 1] === 0x0a) {
      segment = segment.subarray(0, segment.length - 2)
    }
    const headerEnd = segment.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      const headers: Record<string, string> = {}
      for (const line of segment.subarray(0, headerEnd).toString('latin1').split('\r\n')) {
        const colon = line.indexOf(':')
        if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
      }
      const disposition = headers['content-disposition'] ?? ''
      parts.push({
        name: /name="([^"]*)"/.exec(disposition)?.[1] ?? '',
        filename: /filename="([^"]*)"/.exec(disposition)?.[1],
        contentType: headers['content-type'],
        data: segment.subarray(headerEnd + 4),
      })
    }
    cursor = next
  }
  return parts
}

// --- Vision stub -----------------------------------------------------------

const STUB_LEAGUES = [
  'England - Premier League',
  'Spain - LaLiga',
  'Italy - Serie A',
  'Germany - Bundesliga',
  'France - Ligue 1',
  'Ghana - Premier League',
]

const STUB_PAIRINGS: Array<[string, string]> = [
  ['Arsenal', 'Chelsea'],
  ['Real Madrid', 'Sevilla'],
  ['Inter Milan', 'Torino'],
  ['Bayer Leverkusen', 'VfL Wolfsburg'],
  ['Paris SG', 'Olympique Lyon'],
  ['Asante Kotoko', 'Hearts of Oak'],
  ['Brighton', 'Fulham'],
  ['Real Betis', 'Getafe'],
  ['Atalanta', 'Udinese'],
  ['FC Porto', 'Sporting CP'],
  ['Ajax', 'FC Utrecht'],
  ['Celtic', 'Rangers'],
]

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

// Deterministic per upload: the same file always yields the same sample transcript.
function stubVisionTranscript(fileName: string, bytes: number): string {
  const random = mulberry32(hashSeed(`${fileName}:${bytes}`))
  const count = 8 + Math.floor(random() * 7)
  const lines: string[] = []
  let minute = 13 * 60 + Math.floor(random() * 120)
  for (let index = 0; index < count; index += 1) {
    const league = STUB_LEAGUES[Math.floor(random() * STUB_LEAGUES.length)]
    const [home, away] = STUB_PAIRINGS[Math.floor(random() * STUB_PAIRINGS.length)]
    minute += 5 + Math.floor(random() * 45)
    const time = `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
    const homeOdd = (1.4 + random() * 2.4).toFixed(2)
    const drawOdd = (3.0 + random() * 1.2).toFixed(2)
    const awayOdd = (1.7 + random() * 3.5).toFixed(2)
    const id = 10000 + Math.floor(random() * 89999)
    lines.push(league, `Today, ${time}`, home, away, '1  X  2', `${homeOdd}  ${drawOdd}  ${awayOdd}`, `ID ${id}`)
  }
  return lines.join('\n')
}

// --- Transcript parser -----------------------------------------------------

const TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/
const ID_PATTERN = /\b(?:ID|#)\s*:?\s*(\d{4,6})\b/i
const STANDALONE_ID_PATTERN = /^\d{4,6}$/
const ODDS_PATTERN = /\b(\d{1,3}\.\d{1,2})\b/g
const VS_PATTERN = /^(.+?)\s+(?:vs\.?|v)\s+(.+)$/i
const COMPETITION_PATTERN = /^[A-Za-z][A-Za-z0-9 .&'()-]*\s-\s[A-Za-z0-9 .&'()-]+$/
const TEAM_STOPWORDS = /^(today|tomorrow|tonight|gmt|utc|live|vs|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i

const MARKET_HINTS: Array<{ pattern: RegExp; market: MarketType }> = [
  { pattern: /\bover\s*1\.5\b|\bo1\.5\b/i, market: 'Over1.5' },
  { pattern: /\bover\s*2\.5\b|\bo2\.5\b/i, market: 'Over2.5' },
  { pattern: /\b(?:2nd|second)\s*half\b|\b2h\b|\bshh\b/i, market: 'SHH' },
  { pattern: /\b1\s*x\s*2\b/i, market: '1X2' },
]

type DraftBlock = {
  home?: string
  away?: string
  time?: string
  id?: string
  odds: number[]
  marketType?: MarketType
}

function asTeamName(line: string): string | null {
  const cleaned = line.replace(/[^\p{L}\p{N} .&'()-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 2 || cleaned.length > 60) return null
  if (TEAM_STOPWORDS.test(cleaned)) return null
  const letters = cleaned.match(/\p{L}/gu)
  if (!letters || letters.length < 2) return null
  return cleaned
}

function kickoffIso(time: string | undefined, now: Date): string {
  if (!time) return now.toISOString()
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes))
  if (date.getTime() <= now.getTime()) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function toFixture(block: DraftBlock, competition: string, sequence: number, now: Date): LiveFixture {
  const id = block.id ?? `ocr-${sequence}`
  const marketType: MarketType | undefined = block.marketType
    ?? (block.odds.length >= 3 ? '1X2' : block.odds.length > 0 ? 'Over1.5' : undefined)
  return {
    id,
    generatedId: id,
    kickoff: block.time ? `${block.time} GMT` : 'Kickoff TBD',
    kickoffDate: kickoffIso(block.time, now),
    status: 'NS',
    competition: competition || 'SportyBet (imported)',
    home: block.home ?? '',
    away: block.away ?? '',
    marketType,
    selectedOption: marketType === '1X2' ? '1' : undefined,
    sportyOdd: block.odds[0],
    teams: { home: block.home ?? '', away: block.away ?? '' },
  }
}

type ParsedLine = {
  kind: 'competition' | 'teams' | 'team' | 'meta' | 'empty'
  competition?: string
  home?: string
  away?: string
  time?: string
  id?: string
  odds: number[]
  marketType?: MarketType
}

function parseLine(rawLine: string): ParsedLine {
  let line = rawLine.replace(/\s+/g, ' ').trim()
  const parsed: ParsedLine = { kind: 'empty', odds: [] }
  if (!line) return parsed

  if (!TIME_PATTERN.test(line) && COMPETITION_PATTERN.test(line)) {
    parsed.kind = 'competition'
    parsed.competition = line
    return parsed
  }

  for (const hint of MARKET_HINTS) {
    const match = hint.pattern.exec(line)
    if (match) {
      parsed.marketType = hint.market
      line = `${line.slice(0, match.index)} ${line.slice(match.index + match[0].length)}`.trim()
      break
    }
  }

  const timeMatch = TIME_PATTERN.exec(line)
  if (timeMatch) {
    parsed.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
    line = `${line.slice(0, timeMatch.index)} ${line.slice(timeMatch.index + timeMatch[0].length)}`.trim()
  }

  const idMatch = ID_PATTERN.exec(line)
  if (idMatch) {
    parsed.id = idMatch[1]
    line = `${line.slice(0, idMatch.index)} ${line.slice(idMatch.index + idMatch[0].length)}`.trim()
  } else if (STANDALONE_ID_PATTERN.test(line)) {
    parsed.id = line
    line = ''
  }

  line = line.replace(ODDS_PATTERN, (whole, digits: string) => {
    const value = Number(digits)
    if (value >= 1.01 && value <= 100) {
      parsed.odds.push(value)
      return ' '
    }
    return whole
  })

  const remainder = line.replace(/\s+/g, ' ').trim()
  if (remainder) {
    const versus = VS_PATTERN.exec(remainder)
    if (versus) {
      const home = asTeamName(versus[1])
      const away = asTeamName(versus[2])
      if (home && away) {
        parsed.kind = 'teams'
        parsed.home = home
        parsed.away = away
        return parsed
      }
    } else {
      const team = asTeamName(remainder)
      if (team) {
        parsed.kind = 'team'
        parsed.home = team
        return parsed
      }
    }
  }

  if (parsed.time || parsed.id || parsed.odds.length > 0 || parsed.marketType) parsed.kind = 'meta'
  return parsed
}

export function extractFixturesFromTranscript(transcript: string, now = new Date()): LiveFixture[] {
  let competition = ''
  let block: DraftBlock = { odds: [] }
  const fixtures: LiveFixture[] = []
  const seen = new Set<string>()

  const finalizeBlock = () => {
    if (block.home !== undefined && block.away !== undefined) {
      const key = `${block.home}|${block.away}|${block.time ?? ''}`
      if (!seen.has(key) && fixtures.length < MAX_FIXTURES) {
        seen.add(key)
        fixtures.push(toFixture(block, competition, fixtures.length + 1, now))
      }
    }
    block = { odds: [] }
  }
  const blockHasContent = () => Boolean(block.home || block.away || block.time || block.id || block.odds.length > 0)
  const attachMeta = (parsed: ParsedLine) => {
    if (parsed.marketType) block.marketType = parsed.marketType
    if (parsed.time) block.time = parsed.time
    if (parsed.id) block.id = parsed.id
    if (parsed.odds.length > 0) block.odds.push(...parsed.odds)
  }

  for (const rawLine of transcript.split(/\r?\n/)) {
    const parsed = parseLine(rawLine)
    if (parsed.kind === 'empty') continue
    if (parsed.kind === 'competition') {
      finalizeBlock()
      competition = parsed.competition ?? ''
      continue
    }
    if (parsed.kind === 'teams') {
      if (blockHasContent()) finalizeBlock()
      block.home = parsed.home
      block.away = parsed.away
      attachMeta(parsed)
      continue
    }
    if (parsed.kind === 'team') {
      if (!block.home) block.home = parsed.home
      else if (!block.away) block.away = parsed.home
      else {
        finalizeBlock()
        block.home = parsed.home
      }
      attachMeta(parsed)
      continue
    }
    // meta line: a fresh kickoff time on an already-populated block starts a new row
    if (parsed.time && block.time && (block.home || block.away || block.odds.length > 0)) finalizeBlock()
    attachMeta(parsed)
  }
  finalizeBlock()
  return fixtures
}

// --- Handler ---------------------------------------------------------------

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function ingestMediaHandler(request: IngestMediaRequest, response: IngestMediaResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ status: 'error', error: 'Method not allowed.' })
  }

  if (!isAdminKey(headerValue(request.headers?.['x-admin-key']))) {
    return response.status(401).json({ status: 'error', error: 'A valid admin key is required to scan media.' })
  }

  const contentType = headerValue(request.headers?.['content-type'])
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!contentType.toLowerCase().startsWith('multipart/form-data') || !boundaryMatch) {
    return response.status(400).json({ status: 'error', error: 'Expected a multipart/form-data upload.' })
  }
  const boundary = boundaryMatch[1] ?? boundaryMatch[2]

  let body: Buffer
  try {
    body = await readRawBody(request)
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return response.status(413).json({ status: 'error', error: 'Uploads are limited to 25 MB.' })
    }
    return response.status(400).json({ status: 'error', error: 'Could not read the upload body.' })
  }
  if (body.length === 0) {
    return response.status(400).json({ status: 'error', error: 'The upload body was empty.' })
  }

  const parts = parseMultipart(body, boundary)
  const filePart = parts.find((part) => part.name === 'media' && part.filename !== undefined)
  const textPart = parts.find((part) => part.name === 'text')
  if (!filePart && !textPart) {
    return response.status(400).json({ status: 'error', error: 'Include a "media" file field or a "text" OCR field.' })
  }

  let transcript: string
  let source: 'vision-stub' | 'ocr-text'
  let fileMeta: { name: string; type: string; bytes: number } | undefined

  if (filePart) {
    const type = (filePart.contentType ?? 'application/octet-stream').toLowerCase()
    if (!type.startsWith('image/') && !type.startsWith('video/')) {
      return response.status(415).json({ status: 'error', error: 'Only image and video uploads are supported.' })
    }
    if (filePart.data.length === 0) {
      return response.status(400).json({ status: 'error', error: 'The uploaded file was empty.' })
    }
    transcript = stubVisionTranscript(filePart.filename ?? 'upload', filePart.data.length)
    source = 'vision-stub'
    fileMeta = { name: (filePart.filename ?? 'upload').slice(0, MAX_FILE_NAME_CHARS), type, bytes: filePart.data.length }
  } else {
    transcript = (textPart?.data.toString('utf8') ?? '').slice(0, MAX_TRANSCRIPT_CHARS)
    source = 'ocr-text'
  }

  const fixtures = extractFixturesFromTranscript(transcript)
  if (fixtures.length === 0) {
    return response.status(422).json({ status: 'error', error: 'No fixtures could be extracted from the media.', transcript })
  }

  return response.status(200).json({
    status: 'available',
    source,
    stub: source === 'vision-stub',
    file: fileMeta,
    transcript,
    fixtures,
    note: 'OCR/vision extraction is currently stubbed: uploads return deterministic sample fixtures parsed through the same transcript parser that real OCR output will feed.',
  })
}
