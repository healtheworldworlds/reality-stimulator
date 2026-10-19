type Bookie = 'sportybet' | 'betway'

type LiveCode = {
  id: string
  code: string
  odds: number | null
  time: string
  bookie: Bookie
  channel: string
  countryCode: CountryCode
}

type CodesRequest = { method?: string }

type CodesResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): CodesResponse
  json(body: unknown): CodesResponse
}

type CountryCode = 'GHANA' | 'NIGERIA' | 'KENYA' | 'TANZANIA' | 'ZAMBIA' | 'SOUTH AFRICA'

const DEFAULT_COUNTRY: CountryCode = 'NIGERIA'

const SOURCE_CONFIG: Array<{ channel: string, country: CountryCode }> = [
  { channel: 'sportybet_ghana_codes', country: 'GHANA' },
  { channel: 'SportybetOfficialChannel', country: 'NIGERIA' },
  { channel: 'bookingcodes', country: 'NIGERIA' },
  { channel: 'sportybet_nigeria_codes', country: 'NIGERIA' },
  { channel: 'sportybet_codes_free', country: 'NIGERIA' },
  { channel: 'betcodes_hub', country: 'NIGERIA' },
  { channel: 'sportybetkenya_official', country: 'KENYA' },
  { channel: 'sportybet_kenya_slips', country: 'KENYA' },
  { channel: 'sportybet_tanzania', country: 'TANZANIA' },
  { channel: 'sportybet_tz_codes', country: 'TANZANIA' },
  { channel: 'sportybet_zambia', country: 'ZAMBIA' },
  { channel: 'sportybet_southafrica', country: 'SOUTH AFRICA' },
]
const CHANNELS = SOURCE_CONFIG.map((source) => source.channel)
// Channels whose unlabeled codes are not assumed to be SportyBet
const MIXED_CHANNELS = new Set(['betway_sporty_codes'])
const CACHE_TTL_MS = 60_000
const MAX_PER_BOOKIE = 30
const STOP_WORDS = new Set([
  'BETWAY', 'BOOKING', 'SPORTY', 'SPORTYBET', 'CODE', 'CODES',
  'FLORIDA', 'KNICKS', 'LEAGUE', 'LOSERS', 'ASTANA',
  'TODAY', 'FREE', 'TICKET', 'VOUCHER', 'WINNER', 'MOBILE', 'TOMORROW', 'WINNERS',
])
const MAX_CODE_AGE_MS = 24 * 60 * 60 * 1000

type FeedBody = {
  success: true
  updatedAt: string
  sportybet: LiveCode[]
  betway: LiveCode[]
  warnings?: string[]
}

let cached: { expiresAt: number, body: FeedBody } | null = null

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
  return /^[A-Z0-9]{6,8}$/i.test(value) && !STOP_WORDS.has(value.toUpperCase())
}

function extractCodes(text: string, channel: string): Array<{ bookie: Bookie, code: string }> {
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
    const before = text.slice(Math.max(0, index - 40), index)
    const labeledBetway = /betway/i.test(before)
    const labeledSportyBet = /sporty\s*bet/i.test(before)
    let bookie: Bookie | null = null
    if (/^BW[A-Z0-9]{6,8}$/.test(code) || (labeledBetway && code.length >= 7)) {
      bookie = 'betway'
    } else if (labeledSportyBet || (code.length <= 8 && !MIXED_CHANNELS.has(channel.toLowerCase()))) {
      bookie = 'sportybet'
    }
    if (bookie) found.set(code, bookie)
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
    for (const { bookie, code } of extractCodes(`${body} ${text}`, channel)) {
      codes.push({ id: `${post}:${bookie}:${code}`, code, odds, time: new Date(postTime).toISOString(), bookie, channel, countryCode })
    }
  }
  return codes
}

export default async function liveCodesHandler(request: CodesRequest, response: CodesResponse) {
  response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ success: false, error: 'Method not allowed.' })
  }

  const now = Date.now()
  if (cached && cached.expiresAt > now) return response.status(200).json(cached.body)

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
  const body = {
    success: true as const,
    updatedAt: new Date(now).toISOString(),
    sportybet: newestFirst.filter((item) => item.bookie === 'sportybet').slice(0, MAX_PER_BOOKIE),
    betway: newestFirst.filter((item) => item.bookie === 'betway').slice(0, MAX_PER_BOOKIE),
    ...(warnings.length > 0 ? { warnings } : {}),
  }
  cached = { expiresAt: now + CACHE_TTL_MS, body }
  return response.status(200).json(body)
}
