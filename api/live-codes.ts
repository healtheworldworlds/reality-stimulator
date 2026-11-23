import { isAdminKey } from './admin-auth.js'
import { timingSafeEqual } from 'node:crypto'

type Bookie = 'sportybet' | 'betway'

type LiveCode = {
  id: string
  code: string
  odds: number | null
  time: string
  bookie: Bookie
  channel: string
  countryCode: CountryCode
  source?: 'telegram' | 'generated' | 'manual'
  ocr?: boolean
  generatedAt?: string
  expiresAt?: string
  legs?: Array<{ event_id?: string; home_team?: string; away_team?: string; market: string; pick: string; odds: number }>
}

type CodesRequest = {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

type CodesResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): CodesResponse
  json(body: unknown): CodesResponse
}

type CountryCode = 'GHANA'

const DEFAULT_COUNTRY: CountryCode = 'GHANA'

const configuredChannels = (process.env.TELEGRAM_CHANNELS ?? '')
  .split(/[,;\s]+/)
  .map((channel) => channel.trim())
  .filter(Boolean)
  .map((channel) => channel.replace(/^https?:\/\/t\.me\/(?:s\/)?/i, '').replace(/^@/, '').replace(/[/?#].*$/, ''))
const SOURCE_CONFIG: Array<{ channel: string, country: CountryCode }> =
  (configuredChannels.length ? configuredChannels : ['sportybet_gh', 'SportybetOfficialChannel'])
    .map((channel) => ({ channel, country: 'GHANA' }))
const CHANNELS = SOURCE_CONFIG.map((source) => source.channel)
const CACHE_TTL_MS = 60_000
const MAX_PER_BOOKIE = 30
const STOP_WORDS = new Set([
  'BETWAY', 'BOOKING', 'SPORTY', 'SPORTYBET', 'CODE', 'CODES',
  'FLORIDA', 'KNICKS', 'LEAGUE', 'LOSERS', 'ASTANA',
  'TODAY', 'FREE', 'TICKET', 'VOUCHER', 'WINNER', 'MOBILE', 'TOMORROW', 'WINNERS',
])
const MAX_CODE_AGE_MS = 24 * 60 * 60 * 1000
const GENERATED_CODES_KEY = 'reality-simulator:generated-live-codes'
const MANUAL_CODES_KEY = 'reality-simulator:manual-live-codes'
const GENERATED_CODE_TTL_MS = 24 * 60 * 60 * 1000

type FeedBody = {
  success: true
  updatedAt: string
  sportybet: LiveCode[]
  betway: LiveCode[]
  warnings?: string[]
}

let cached: { expiresAt: number, body: FeedBody } | null = null
let generatedMemory: LiveCode[] = []
let manualMemory: LiveCode[] = []

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function kvCredentials() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

async function kvCommand(command: unknown[]) {
  const credentials = kvCredentials()
  if (!credentials) return null
  const response = await fetch(credentials.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Live code storage returned HTTP ${response.status}.`)
  return response.json() as Promise<{ result?: unknown }>
}

async function readGeneratedCodes() {
  const result = await kvCommand(['LRANGE', GENERATED_CODES_KEY, '0', String(MAX_PER_BOOKIE - 1)])
  const stored = !result || !Array.isArray(result.result)
    ? generatedMemory
    : result.result.flatMap((item) => {
    if (typeof item !== 'string') return []
    try {
      const parsed = JSON.parse(item) as LiveCode
      const valid = parsed.code &&
        (parsed.bookie === 'sportybet' || parsed.bookie === 'betway') &&
        parsed.countryCode === 'GHANA'
      return valid ? [parsed] : []
    } catch {
      return []
    }
  })
  const now = Date.now()
  return stored.filter((item) => {
    if (item.source !== 'generated') return false
    const expiresAt = item.expiresAt ? Date.parse(item.expiresAt) : Date.parse(item.time) + GENERATED_CODE_TTL_MS
    return Number.isFinite(expiresAt) && expiresAt > now
  })
}

async function readManualCodes() {
  const result = await kvCommand(['LRANGE', MANUAL_CODES_KEY, '0', String(MAX_PER_BOOKIE - 1)])
  const stored = !result || !Array.isArray(result.result)
    ? manualMemory
    : result.result.flatMap((item) => {
      if (typeof item !== 'string') return []
      try {
        const parsed = JSON.parse(item) as LiveCode
        return parsed.source === 'manual' &&
          (parsed.bookie === 'sportybet' || parsed.bookie === 'betway') &&
          parsed.countryCode === 'GHANA'
          ? [parsed]
          : []
      } catch {
        return []
      }
    })
  return stored.filter((item) =>
    item.source === 'manual' &&
    (item.bookie === 'sportybet' || item.bookie === 'betway') &&
    item.countryCode === 'GHANA')
}

function parseBody(body: unknown): Record<string, unknown> | null {
  let value = body
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function validStoredLegs(value: unknown[]): unknown[] | null {
  if (value.length < 1 || value.length > 100) return null
  const eventIds = new Set<string>()
  const legs: unknown[] = []
  for (const rawLeg of value) {
    if (typeof rawLeg !== 'object' || rawLeg === null) return null
    const leg = rawLeg as Record<string, unknown>
    const eventId = typeof leg.event_id === 'string' ? leg.event_id.trim() : ''
    const market = typeof leg.market === 'string' ? leg.market.trim() : ''
    const pick = typeof leg.pick === 'string' ? leg.pick.trim() : ''
    const odds = typeof leg.odds === 'number' ? leg.odds : Number(leg.odds)
    if (!eventId || eventId.length > 128 || !market || market.length > 64 ||
      !pick || pick.length > 64 || !Number.isFinite(odds) || odds < 1 || odds > 1000 ||
      eventIds.has(eventId)) return null
    eventIds.add(eventId)
    legs.push({ event_id: eventId, market, pick, odds })
  }
  return legs
}

async function storeGeneratedCode(body: Record<string, unknown>) {
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : ''
  const countryCode = typeof body.countryCode === 'string' ? body.countryCode.toUpperCase() : 'GHANA'
  const bookie = typeof body.bookie === 'string' ? body.bookie.toLowerCase() : 'sportybet'
  if ((bookie !== 'sportybet' && bookie !== 'betway') || countryCode !== 'GHANA') {
    throw new Error('Only SportyBet Ghana (GH) or Betway Ghana (GH) codes can be stored.')
  }
  const time = typeof body.time === 'string' && Number.isFinite(Date.parse(body.time))
    ? new Date(body.time).toISOString()
    : new Date().toISOString()
  const legs = Array.isArray(body.legs) ? body.legs : []
  const validLegs = legs.length > 0 ? validStoredLegs(legs) : []
  if (bookie === 'sportybet' && !/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('A valid 6-character SportyBet Ghana booking code is required.')
  }
  if (bookie === 'sportybet' && !/\d/.test(code) && body.verified !== true) {
    throw new Error('SportyBet booking codes must contain a digit unless Playwright verification is provided.')
  }
  if (bookie === 'betway' && !/^BW[A-Z0-9]{6}$/.test(code)) {
    throw new Error('A valid 8-character Betway Ghana booking code starting with BW is required.')
  }
  if (bookie === 'betway' && !/[0-9]/.test(code.slice(2))) {
    throw new Error('Betway booking code suffix must contain at least one digit.')
  }
  const source = body.source === 'manual' ? 'manual' : 'generated'
  const expiresAt = source === 'generated'
    ? new Date(Date.parse(time) + GENERATED_CODE_TTL_MS).toISOString()
    : undefined
  const record: LiveCode = {
    id: `generated:${code}:${time}`,
    code,
    odds: typeof body.combinedOdds === 'number' && body.combinedOdds >= 1
      ? body.combinedOdds
      : legs.reduce((total, leg) => total * (typeof (leg as Record<string, unknown>)?.odds === 'number' ? (leg as Record<string, number>).odds : 1), legs.length ? 1 : 0),
    time,
    bookie: bookie as Bookie,
    channel: typeof body.channel === 'string' ? body.channel : 'reality-simulator',
    countryCode: 'GHANA',
    source,
    generatedAt: time,
    expiresAt,
    legs: validLegs as LiveCode['legs'],
  }
  if (source === 'manual') {
    manualMemory = [record, ...manualMemory.filter((item) => item.code !== record.code)].slice(0, MAX_PER_BOOKIE)
    await kvCommand(['LPUSH', MANUAL_CODES_KEY, JSON.stringify(record)])
    await kvCommand(['LTRIM', MANUAL_CODES_KEY, '0', String(MAX_PER_BOOKIE - 1)])
  } else {
    generatedMemory = [record, ...generatedMemory.filter((item) =>
    item.code !== record.code &&
    item.source === 'generated' &&
    (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
    )].slice(0, MAX_PER_BOOKIE)
    await kvCommand(['LPUSH', GENERATED_CODES_KEY, JSON.stringify(record)])
    await kvCommand(['LTRIM', GENERATED_CODES_KEY, '0', String(MAX_PER_BOOKIE - 1)])
  }
  cached = null
  return record
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

function htmlToText(html: string) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
}

function findOdds(text: string) {
  const match = /(\d{1,4}(?:\.\d{1,2})?)\s*(?:\+\s*)?odds?\b/i.exec(text) ?? /\bodds?\s*[:=-]?\s*(\d{1,4}(?:\.\d{1,2})?)/i.exec(text)
  const odds = match ? Number(match[1]) : NaN
  return Number.isFinite(odds) && odds >= 1.01 ? odds : null
}

function isValidCode(value: string) {
  return /^[A-Z0-9]{6,8}$/i.test(value) && /\d/.test(value) && /[A-Z]/i.test(value) &&
    !STOP_WORDS.has(value.toUpperCase())
}

function isValidExplicitCode(value: string) {
  const code = value.toUpperCase()
  if (code.startsWith('BW')) return isValidBookieCode('betway', code)
  return isValidBookieCode('sportybet', code) && !STOP_WORDS.has(code)
}

function isValidBookieCode(bookie: Bookie, code: string) {
  if (bookie === 'betway') return /^BW[A-Z0-9]{6}$/.test(code) && /[0-9]/.test(code.slice(2))
  return /^[A-Z0-9]{6}$/.test(code) && /[0-9]/.test(code)
}

function extractCodes(text: string): Array<{ bookie: Bookie, code: string }> {
  const found = new Map<string, Bookie>()
  const explicitTokens = [
    ...text.matchAll(/shareCode=([A-Z0-9]{6,8})/gi),
    ...text.matchAll(/\/m\/code-hub\/([A-Z0-9]{6,8})/gi),
    ...text.matchAll(/(?:Booking\s*Code|Sportybet|Code)[:\s-]+([A-Z0-9]{6,8})/gi),
    ...text.matchAll(/\b(BW[A-Z0-9]{6,8})\b/gi),
  ]
  const explicitMatches = explicitTokens.map((match) => ({ code: match[1], index: match.index ?? 0, explicit: true }))
  const standaloneMatches = [...text.matchAll(/\b[A-Z0-9]{6,8}\b/g)]
    .filter((match) => isValidCode(match[0]))
    .map((match) => ({ code: match[0], index: match.index ?? 0, explicit: false }))
  for (const { code: rawCode, index, explicit } of [...explicitMatches, ...standaloneMatches]) {
    const code = rawCode.toUpperCase()
    if (explicit ? !isValidExplicitCode(code) : !isValidCode(code)) continue
    // Filter out codes that are emoji-only or consist of repeated characters (junk from image filenames like F09F9189)
    const isJunkCode = (code: string) => /^[^\p{L}\p{N}]+$/u.test(code) || /^(.)\1{5,}$/u.test(code) || code.length > 12
    if (isJunkCode(code)) continue
    const before = text.slice(Math.max(0, index - 40), index)
    if (code.startsWith('BW')) {
      if (isValidBookieCode('betway', code)) found.set(code, 'betway')
    } else if (/sporty\s*bet/i.test(before) || code.length === 6) {
      found.set(code, 'sportybet')
    }
  }
  return [...found].map(([code, bookie]) => ({ code, bookie }))
}

async function fetchChannel(channel: string): Promise<LiveCode[]> {
  const countryCode = SOURCE_CONFIG.find((source) => source.channel === channel)?.country ?? DEFAULT_COUNTRY
  const upstream = await fetch(`https://t.me/s/${channel}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RealitySimulator/1.0)', Accept: 'text/html' },
    signal: AbortSignal.timeout(4000),
  })
  if (!upstream.ok) throw new Error(`Telegram preview returned HTTP ${upstream.status}`)
  const html = await upstream.text()
  const codes: LiveCode[] = []
  for (const block of html.split('tgme_widget_message_wrap').slice(1)) {
    const post = /data-post="([^"]+)"/.exec(block)?.[1]
    const datetime = /<time[^>]*datetime="([^"]+)"/.exec(block)?.[1]
    const body = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1]
    if (!post || !datetime || !body || !Number.isFinite(Date.parse(datetime))) continue
    const postTime = Date.parse(datetime)
    if (Date.now() - postTime > MAX_CODE_AGE_MS) continue
    const text = htmlToText(body).trim()
    const odds = findOdds(text)
    for (const { bookie, code } of extractCodes(`${body} ${text}`)) {
      codes.push({ id: `${post}:${bookie}:${code}`, code, odds, time: new Date(postTime).toISOString(), bookie, channel, countryCode, source: 'telegram' })
    }
  }
  return codes
}

export default async function liveCodesHandler(request: CodesRequest, response: CodesResponse) {
  response.setHeader('Cache-Control', request.method === 'POST' ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=30')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (request.method === 'POST') {
    const submittedKey = headerValue(request.headers?.['x-admin-key'])
    const masterKey = process.env.ADMIN_MASTER_KEY
    const publishKey = process.env.LIVE_CODES_ADMIN_KEY
    let authorized = false
    if (masterKey && isAdminKey(submittedKey)) authorized = true
    if (!authorized && publishKey) {
      const actual = Buffer.from(submittedKey)
      const expected = Buffer.from(publishKey)
      authorized = actual.length === expected.length && timingSafeEqual(actual, expected)
    }
    if (!authorized) {
      return response.status(401).json({ success: false, error: 'A valid admin key is required.' })
    }
    try {
      const record = await storeGeneratedCode(parseBody(request.body) ?? {})
      return response.status(201).json({ success: true, code: record })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid generated code.'
      return response.status(message.startsWith('Live code storage') ? 503 : 400).json({ success: false, error: message })
    }
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ success: false, error: 'Method not allowed.' })
  }

  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    const filtered = {
      ...cached.body,
      sportybet: cached.body.sportybet.filter((item) =>
        item.bookie === 'sportybet' &&
        item.countryCode === 'GHANA' &&
        isValidBookieCode(item.bookie, item.code) &&
        (item.source !== 'generated' ||
          (!item.expiresAt || Date.parse(item.expiresAt) > now))),
      betway: cached.body.betway.filter((item) =>
        item.bookie === 'betway' &&
        item.countryCode === 'GHANA' &&
        isValidBookieCode(item.bookie, item.code) &&
        (item.source !== 'generated' ||
          (!item.expiresAt || Date.parse(item.expiresAt) > now))),
    }
    return response.status(200).json(filtered)
  }

  const settled = await Promise.allSettled(CHANNELS.map(fetchChannel))
  const all = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  const warnings = settled.flatMap((result, index) =>
    result.status === 'rejected' ? [`${CHANNELS[index]}: ${result.reason instanceof Error ? result.reason.message : 'feed unavailable'}`] : [],
  )
  if (all.length === 0 && settled.every((result) => result.status === 'rejected')) {
    if (cached) return response.status(200).json(cached.body)
    return response.status(200).json({
      success: true as const,
      updatedAt: new Date(now).toISOString(),
      sportybet: [],
      betway: [],
      warnings,
    })
  }

  const seen = new Set<string>()
  const newestFirst = all
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .filter((item) => {
      const key = item.code.toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  let generated: LiveCode[]
  let manual: LiveCode[]
  try {
    generated = await readGeneratedCodes()
    manual = await readManualCodes()
  } catch {
    generated = generatedMemory
    manual = manualMemory
  }
  generated = generated.filter((item) =>
    (item.bookie === 'sportybet' || item.bookie === 'betway') &&
    item.countryCode === 'GHANA' &&
    isValidBookieCode(item.bookie, item.code))
  manual = manual.filter((item) =>
    item.source === 'manual' &&
    (item.bookie === 'sportybet' || item.bookie === 'betway') &&
    item.countryCode === 'GHANA' &&
    isValidBookieCode(item.bookie, item.code))
  const body = {
    success: true as const,
    updatedAt: new Date(now).toISOString(),
    sportybet: [...generated, ...manual, ...newestFirst.filter((item) => item.bookie === 'sportybet')]
      .filter((item) => item.bookie === 'sportybet')
      .filter((item) => isValidBookieCode(item.bookie, item.code))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code) === index)
      .slice(0, MAX_PER_BOOKIE),
    betway: [...generated, ...manual, ...newestFirst.filter((item) => item.bookie === 'betway')]
      .filter((item) => item.bookie === 'betway')
      .filter((item) => isValidBookieCode(item.bookie, item.code))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code) === index)
      .slice(0, MAX_PER_BOOKIE),
    ...(warnings.length > 0 ? { warnings } : {}),
  }
  cached = { expiresAt: now + CACHE_TTL_MS, body }
  return response.status(200).json(body)
}
