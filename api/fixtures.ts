type ApiFixture = {
  fixture?: {
    id?: number
    date?: string
    status?: { short?: string }
  }
  league?: { id?: number, name?: string }
  teams?: {
    home?: { name?: string }
    away?: { name?: string }
  }
}

type ApiPayload = {
  errors?: unknown
  response?: ApiFixture[]
}

type FixturesRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
  headers: { [key: string]: string | string[] | undefined }
  ip?: string
  socket?: { remoteAddress?: string }
}

type FixturesResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): FixturesResponse
  json(body: unknown): FixturesResponse
}

type CachedFixtures = {
  expiresAt: number
  response: ApiFixture[]
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const CACHE_TTL_MS = 15 * 60 * 1000
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 30
const MAX_RATE_LIMIT_CLIENTS = 10_000
const MAX_CACHE_ENTRIES = 128
const UPSTREAM_TIMEOUT_MS = 8000
const cache = new Map<string, CachedFixtures>()
const rateLimits = new Map<string, RateLimitEntry>()

function queryValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : null
}

function hasApiErrors(errors: unknown) {
  if (Array.isArray(errors)) return errors.length > 0
  if (typeof errors === 'object' && errors !== null) return Object.keys(errors).length > 0
  return Boolean(errors)
}

function cleanFixtures(payload: ApiPayload) {
  if (!Array.isArray(payload.response)) throw new Error('Invalid fixtures response.')
  return payload.response.flatMap((item): ApiFixture[] => {
    const id = item.fixture?.id
    const date = item.fixture?.date
    const status = item.fixture?.status?.short
    const home = item.teams?.home?.name?.trim()
    const away = item.teams?.away?.name?.trim()
    if (!Number.isInteger(id) || !date || !status || !home || !away || home === away) return []
    const kickoff = new Date(date)
    if (!Number.isFinite(kickoff.getTime())) return []
    return [{
      fixture: { id, date: kickoff.toISOString(), status: { short: status } },
      league: { id: item.league?.id, name: item.league?.name?.trim() || 'Football' },
      teams: { home: { name: home }, away: { name: away } },
    }]
  })
}

function checkRateLimit(clientId: string, now: number) {
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key)
  }
  const current = rateLimits.get(clientId)
  if (!current || current.resetAt <= now) {
    if (!current && rateLimits.size >= MAX_RATE_LIMIT_CLIENTS) {
      return { allowed: false, resetAt: now + RATE_LIMIT_WINDOW_MS }
    }
    rateLimits.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return { allowed: false, resetAt: current.resetAt }
  current.count += 1
  return { allowed: true, resetAt: current.resetAt }
}

export default async function fixturesHandler(request: FixturesRequest, response: FixturesResponse) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const date = queryValue(request.query.date)
  const timezone = queryValue(request.query.timezone) || 'UTC'
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
    timezone.length > 64 || !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(timezone)) {
    return response.status(400).json({ error: 'A valid date and timezone are required.' })
  }

  const now = Date.now()
  const clientId = request.ip || request.socket?.remoteAddress || 'unknown'
  const rateLimit = checkRateLimit(clientId, now)
  response.setHeader('RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS)
  response.setHeader('RateLimit-Remaining', rateLimit.allowed
    ? Math.max(0, RATE_LIMIT_MAX_REQUESTS - (rateLimits.get(clientId)?.count ?? RATE_LIMIT_MAX_REQUESTS))
    : 0)
  response.setHeader('RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000))
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', Math.max(1, Math.ceil((rateLimit.resetAt - now) / 1000)))
    return response.status(429).json({ error: 'Too many fixture requests. Try again shortly.' })
  }

  const cacheKey = `${date}:${timezone}`
  const cached = cache.get(cacheKey)
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  if (cached && cached.expiresAt > now) {
    response.setHeader('X-Fixtures-Cache', 'HIT')
    return response.status(200).json({ response: cached.response })
  }
  if (cached) cache.delete(cacheKey)

  const apiKey = process.env.FOOTBALL_API_KEY?.trim()
  if (!apiKey) return response.status(503).json({ error: 'Fixture service is not configured.' })

  const url = new URL('https://v3.football.api-sports.io/fixtures')
  url.searchParams.set('date', date)
  url.searchParams.set('timezone', timezone)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(url, {
      headers: { 'x-apisports-key': apiKey },
      signal: controller.signal,
    })
    if (!upstream.ok) return response.status(502).json({ error: 'Fixture provider is unavailable.' })

    const payload = await upstream.json() as ApiPayload
    if (hasApiErrors(payload.errors)) return response.status(502).json({ error: 'Fixture provider is unavailable.' })
    const fixtures = cleanFixtures(payload)
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value
      if (oldestKey !== undefined) cache.delete(oldestKey)
    }
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, response: fixtures })
    response.setHeader('X-Fixtures-Cache', 'MISS')
    return response.status(200).json({ response: fixtures })
  } catch {
    return response.status(502).json({ error: 'Fixture provider is unavailable.' })
  } finally {
    clearTimeout(timeout)
  }
}
