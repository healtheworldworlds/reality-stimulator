type Bookie = 'sportybet' | 'betway'

type LiveCode = {
  id: string
  code: string
  odds: number | null
  time: string
  bookie: Bookie
}

type CodesRequest = { method?: string }

type CodesResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): CodesResponse
  json(body: unknown): CodesResponse
}

type Channel = {
  name: string
  // Bookie assumed for messages that are only a bare code (no bookmaker mentioned).
  defaultBookie?: Bookie
}

const CHANNELS: Channel[] = [{ name: 'bookingcodes', defaultBookie: 'sportybet' }]
const CACHE_TTL_MS = 60_000
const FETCH_TIMEOUT_MS = 9000
const MAX_PER_BOOKIE = 30
const STOP_WORDS = new Set(['BETWAY', 'BOOKING', 'SPORTY', 'SPORTYBET', 'CODE', 'CODES'])

let cached: { expiresAt: number, body: Record<string, unknown> } | null = null

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

function extractCodes(text: string, defaultBookie?: Bookie): Array<{ bookie: Bookie, code: string }> {
  const found: Array<{ bookie: Bookie, code: string }> = []
  const mentions = [...text.matchAll(/sporty\s*bet|betway/gi)]
  mentions.forEach((mention, index) => {
    const start = (mention.index ?? 0) + mention[0].length
    const end = Math.min(mentions[index + 1]?.index ?? text.length, start + 60)
    const code = [...text.slice(start, end).matchAll(/\b[A-Z0-9]{6,8}\b/g)]
      .map((item) => item[0])
      .find((token) => !STOP_WORDS.has(token))
    if (code) found.push({ bookie: mention[0].toLowerCase().startsWith('betway') ? 'betway' : 'sportybet', code })
  })
  if (found.length === 0 && defaultBookie && /^[A-Z0-9]{6,8}$/.test(text.trim()) && !STOP_WORDS.has(text.trim())) {
    found.push({ bookie: defaultBookie, code: text.trim() })
  }
  return found
}

async function fetchChannel(channel: Channel): Promise<LiveCode[]> {
  const upstream = await fetch(`https://t.me/s/${channel.name}`, {
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
    for (const { bookie, code } of extractCodes(text, channel.defaultBookie)) {
      codes.push({ id: `${post}:${bookie}:${code}`, code, odds, time: new Date(datetime).toISOString(), bookie })
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
  if (all.length === 0 && settled.every((result) => result.status === 'rejected')) {
    if (cached) return response.status(200).json(cached.body)
    const reason = (settled[0] as PromiseRejectedResult).reason
    return response.status(502).json({
      success: false,
      error: `Could not load the codes feed: ${reason instanceof Error ? reason.message : 'unknown error'}`,
    })
  }

  const seen = new Set<string>()
  const newestFirst = all
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .filter((item) => {
      const key = `${item.bookie}:${item.code}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  const body = {
    success: true,
    updatedAt: new Date(now).toISOString(),
    sportybet: newestFirst.filter((item) => item.bookie === 'sportybet').slice(0, MAX_PER_BOOKIE),
    betway: newestFirst.filter((item) => item.bookie === 'betway').slice(0, MAX_PER_BOOKIE),
  }
  cached = { expiresAt: now + CACHE_TTL_MS, body }
  return response.status(200).json(body)
}
