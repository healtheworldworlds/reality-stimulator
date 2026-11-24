export interface FixturesRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface FixturesResponse {
  setHeader: (name: string, value: string | number) => void;
  status: (code: number) => {
    json: (body: any) => void;
  };
}

const UPSTREAM_TIMEOUT_MS = 10000
const FIXTURE_CACHE_TTL_MS = 60_000
let fixtureCache: { key: string; expiresAt: number; payload: unknown } | null = null

type ApiFootballFixture = {
  fixture?: { id?: number; date?: string; status?: { short?: string } }
  league?: { name?: string }
  teams?: {
    home?: { id?: number; name?: string }
    away?: { id?: number; name?: string }
  }
  goals?: { home?: number | null; away?: number | null }
}

function utcDate() {
  return new Date().toISOString().slice(0, 10)
}

function apiFootballCredentials() {
  const key = process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || process.env.APISPORTS_API_KEY
  if (!key) return null
  const rapidHost = process.env.API_FOOTBALL_RAPIDAPI_HOST
  const host = rapidHost || 'v3.football.api-sports.io'
  return {
    key,
    baseUrl: `https://${host}`,
    headers: rapidHost
      ? { 'x-rapidapi-key': key, 'x-rapidapi-host': rapidHost }
      : { 'x-apisports-key': key },
  }
}

async function apiFootballGet(credentials: ReturnType<typeof apiFootballCredentials>, path: string) {
  if (!credentials) throw new Error('API-Football credentials are not configured.')
  const response = await fetch(`${credentials.baseUrl}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json', ...credentials.headers },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  const payload = await response.json().catch(() => null) as {
    errors?: unknown
    response?: unknown
  } | null
  if (!response.ok) throw new Error(`API-Football returned HTTP ${response.status}.`)
  if (payload?.errors && typeof payload.errors === 'object' && Object.keys(payload.errors).length > 0) {
    throw new Error(`API-Football returned ${JSON.stringify(payload.errors)}.`)
  }
  return payload?.response ?? []
}

function scoringStreak(fixtures: unknown[], teamId: number): number | undefined {
  const matches = fixtures as ApiFootballFixture[]
  const ordered = matches
    .filter((fixture) => fixture.fixture?.status?.short === 'FT')
    .sort((left, right) =>
      String(right.fixture?.date ?? '').localeCompare(String(left.fixture?.date ?? '')))
  let streak = 0
  for (const fixture of ordered) {
    const isHome = fixture.teams?.home?.id === teamId
    const goals = isHome ? fixture.goals?.home : fixture.teams?.away?.id === teamId ? fixture.goals?.away : null
    if (typeof goals !== 'number' || goals <= 0) break
    streak += 1
  }
  return ordered.length > 0 ? streak : undefined
}

async function mapApiFootballFixtures(date: string, credentials: NonNullable<ReturnType<typeof apiFootballCredentials>>) {
  const response = await apiFootballGet(credentials, `/fixtures?date=${encodeURIComponent(date)}&timezone=UTC`)
  if (!Array.isArray(response)) return []
  const fixtures = response as ApiFootballFixture[]
  const teamIds = [...new Set(fixtures.flatMap((fixture) =>
    [fixture.teams?.home?.id, fixture.teams?.away?.id].filter((id): id is number => typeof id === 'number'),
  ))].slice(0, 40)
  const streaks = new Map<number, number>()
  await Promise.all(teamIds.map(async (teamId) => {
    try {
      const recent = await apiFootballGet(credentials, `/fixtures?team=${teamId}&status=FT&last=5&timezone=UTC`)
      const streak = scoringStreak(Array.isArray(recent) ? recent : [], teamId)
      if (streak !== undefined) streaks.set(teamId, streak)
    } catch {
      // Missing streak data is intentionally excluded from goal markets.
    }
  }))

  return fixtures.flatMap((fixture) => {
    const fixtureId = fixture.fixture?.id
    const kickoffDate = fixture.fixture?.date
    const home = fixture.teams?.home
    const away = fixture.teams?.away
    if (!fixtureId || !kickoffDate || !home?.name || !away?.name) return []
    const statusShort = fixture.fixture?.status?.short
  if (!statusShort || String(statusShort) === '0' || ['NS', 'TBD'].includes(String(statusShort))) return []
    const homeStreak = typeof home.id === 'number' ? streaks.get(home.id) : undefined
    const awayStreak = typeof away.id === 'number' ? streaks.get(away.id) : undefined
    const d = new Date(kickoffDate)
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const mins = String(d.getUTCMinutes()).padStart(2, '0')
    return [{
      id: String(fixtureId),
      generatedId: String(fixtureId),
      kickoff: `${hours}:${mins} GMT`,
      kickoffDate: d.toISOString(),
      status: 'NS',
      competition: fixture.league?.name || 'API-Football Match',
      home: home.name,
      away: away.name,
      ...(homeStreak !== undefined && awayStreak !== undefined
        ? { homeScoringStreak: homeStreak, awayScoringStreak: awayStreak, streakDataAvailable: true }
        : {}),
      teams: { home: home.name, away: away.name },
      source: 'api-football',
    }]
  })
}

export default async function fixturesHandler(request: FixturesRequest, response: FixturesResponse) {
  response.setHeader('Cache-Control', 'no-store, must-revalidate');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const date = typeof request.query?.date === 'string' ? request.query.date : utcDate()
    const pageSize = typeof request.query?.pageSize === 'string' ? parseInt(request.query.pageSize, 10) : 20
    const pageNum = typeof request.query?.pageNum === 'string' ? parseInt(request.query.pageNum, 10) : 1
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return response.status(400).json({ status: 'fallback', error: 'date must use YYYY-MM-DD.' })
    }
    const cacheKey = `fixtures:${date}:${pageNum}:${pageSize}`
    const now = Date.now()
    if (fixtureCache?.key === cacheKey && fixtureCache.expiresAt > now) {
      return response.status(200).json(fixtureCache.payload)
    }
    const credentials = apiFootballCredentials()
    if (!credentials) {
      return response.status(503).json({
        status: 'fallback',
        response: [],
        error: 'API-Football is not configured. Set API_FOOTBALL_KEY or FOOTBALL_API_KEY.',
      })
    }
    const mapped = await mapApiFootballFixtures(date, credentials)
    // Filter by status: only include fixtures that have started (not 'NS' or 'TBD')
    const filtered = mapped.filter((f) => {
      const statusShort = f.status
      // 'NS' = not started, 'TBD' = to be decided; exclude these (treat as numeric 0 filter)
      if (!statusShort) return false
      return !['NS', 'TBD'].includes(statusShort)
    })
    const paginated = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize)
    if (paginated.length > 0) {
      const payload = { status: 'available', response: paginated, source: 'api-football', date, pageNum, pageSize }
      fixtureCache = { key: cacheKey, expiresAt: now + FIXTURE_CACHE_TTL_MS, payload }
      return response.status(200).json(payload)
    }
    return response.status(200).json({
      status: 'fallback',
      response: [],
      error: `No upcoming fixtures returned by API-Football for ${date}.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching API-Football fixtures.'
    // Don't cache errors - return immediately without Cache-Control caching
    return response.status(502).json({ status: 'fallback', error: message, _ephemeral: true })
  }
}
