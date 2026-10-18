type BookMatch = { home: string, away: string, market: string, pick: string }

type BookRequest = {
  method?: string
  body?: unknown
}

type BookResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): BookResponse
  json(body: unknown): BookResponse
}

const HOST = 'convert-bet-codes-api1.p.rapidapi.com'
const ENDPOINT = process.env.CONVERT_BET_CODES_URL ?? `https://${HOST}/generate_bet_code`
const MAX_MATCHES = 40

function isText(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function parseMatches(body: unknown): BookMatch[] | null {
  let payload = body
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { return null }
  }
  const matches = (payload as { matches?: unknown } | null)?.matches
  if (!Array.isArray(matches) || matches.length === 0 || matches.length > MAX_MATCHES) return null
  const parsed: BookMatch[] = []
  for (const item of matches) {
    const { home, away, market, pick } = (item ?? {}) as Record<string, unknown>
    if (!isText(home) || !isText(away) || !isText(market) || !isText(pick)) return null
    parsed.push({ home: home.trim(), away: away.trim(), market: market.trim(), pick: pick.trim() })
  }
  return parsed
}

export default async function bookSportyBetHandler(request: BookRequest, response: BookResponse) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      return response.status(405).json({ success: false, error: 'Method not allowed. Use POST.' })
    }
    const apiKey = (process.env.RAPIDAPI_KEY || '').trim()
    if (!apiKey) {
      return response.status(500).json({ success: false, error: 'Server is missing RAPIDAPI_KEY configuration.' })
    }
    const matches = parseMatches(request.body)
    if (!matches) {
      return response.status(400).json({
        success: false,
        error: `Body must be { matches: [{ home, away, market, pick }] } with 1-${MAX_MATCHES} non-empty entries.`,
      })
    }

    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': HOST,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookmaker: 'sportybet', destination: 'sportybet:gh', selections: matches, matches }),
      signal: AbortSignal.timeout(20_000),
    })
    const text = await upstream.text()
    let data: { booking_code?: unknown, message?: unknown, error?: unknown } | null = null
    try { data = JSON.parse(text) } catch { /* non-JSON upstream body */ }
    const nested = (data as { data?: { booking_code?: unknown } } | null)?.data
    const code = nested?.booking_code ?? data?.booking_code

    if (!upstream.ok || typeof code !== 'string' || code.length === 0) {
      const detail = text.trim().slice(0, 1000) || 'empty response body'
      console.error('[book-sportybet] upstream rejected', { url: ENDPOINT, status: upstream.status, body: detail })
      return response.status(upstream.ok ? 502 : upstream.status).json({
        success: false,
        error: `RapidAPI responded HTTP ${upstream.status} from ${ENDPOINT}: ${detail}`,
        upstreamStatus: upstream.status,
        upstreamBody: detail,
      })
    }
    return response.status(200).json({ success: true, bookingCode: code })
  } catch (error) {
    return response.status(502).json({
      success: false,
      error: `Could not reach ConvertBetCodes: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
}
