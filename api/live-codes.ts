type Bookie = 'sportybet' | 'betway'

type LiveCode = {
  id: string
  code: string
  odds: number | null
  time: string
  bookie: Bookie
  channel: string
}

type CodesRequest = { method?: string }

type CodesResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): CodesResponse
  json(body: unknown): CodesResponse
}

const GHANA_CHANNELS = [
  'bookingcodes',
  'sportybet_codes_gh',
  'ghana_betting_codes',
  'sportybetcodeshub',
  'ghana_sure_odds',
  'daily_bet_codes_gh',
  'betway_ghana_codes',
]
const CACHE_TTL_MS = 60_000
const FETCH_TIMEOUT_MS = 9000
const MAX_PER_BOOKIE = 30
const STOP_WORDS = new Set(['BETWAY', 'BOOKING', 'SPORTY', 'SPORTYBET', 'CODE', 'CODES'])

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

function extractCodes(text: string, channel: string): Array<{ bookie: Bookie, code: string }> {
  const isBetwayChannel = channel.toLowerCase().includes('betway')
  const found = new Map<string, Bookie>()
  const tokens = [...text.matchAll(/\b[A-Z0-9]{6,10}\b/gi)]
  for (const tokenMatch of tokens) {
    const code = tokenMatch[0].toUpperCase()
    if (STOP_WORDS.has(code) || !/[A-Z]/.test(code)) continue
    const index = tokenMatch.index ?? 0
    const before = text.slice(Math.max(0, index - 40), index)
    const explicitBetway = /betway/i.test(before)
    const explicitSportyBet = /sporty\s*bet/i.test(before)
    let bookie: Bookie | null = null
    if (/^BW[A-Z0-9]{6,8}$/.test(code) || explicitBetway || (isBetwayChannel && code.length >= 7)) {
      bookie = 'betway'
    } else if (explicitSportyBet || (!isBetwayChannel && code.length >= 6 && code.length <= 7)) {
      bookie = 'sportybet'
    }
    if (bookie) found.set(code, bookie)
  }
  return [...found].map(([code, bookie]) => ({ code, bookie }))
}

async function fetchChannel(channel: string): Promise<LiveCode[]> {
  const upstream = await fetch(`https://t.me/s/${channel}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RealitySimulator/1.0)', Accept: 'text/html' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!upstream.ok) throw new Error(`Telegram preview returned HTTP ${upstream.status}`)
  const html = await upstream.text()
  const codes: LiveCode[] = []
  for (const block of html.split('tgme_widget_message_wrap').slice(1)) {
    const post = /data-post="([^"]+)"/.exec(block)?.[1]
    const datetime = /<time[^>]*datetime="([^"]+)"/.exec(block)?.[1]
    const body = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1]
    if (!post || !datetime || !body || !Number.isFinite(Date.parse(datetime))) continue
    const text = htmlToText(body).trim()
    const odds = findOdds(text)
    for (const { bookie, code } of extractCodes(text, channel)) {
      codes.push({ id: `${post}:${bookie}:${code}`, code, odds, time: new Date(datetime).toISOString(), bookie, channel })
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

  const settled = await Promise.allSettled(GHANA_CHANNELS.map(fetchChannel))
  const all = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  const warnings = settled.flatMap((result, index) =>
    result.status === 'rejected' ? [`${GHANA_CHANNELS[index]}: ${result.reason instanceof Error ? result.reason.message : 'feed unavailable'}`] : [],
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
