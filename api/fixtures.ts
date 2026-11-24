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

type TeamGoalStats = {
  scored: number
  conceded: number
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

function recentGoalStats(fixtures: unknown[], teamId: number): TeamGoalStats | undefined {
  const matches = fixtures as ApiFootballFixture[]
  const ordered = matches
    .filter((fixture) =>
      fixture.fixture?.status?.short === 'FT' &&
      typeof fixture.goals?.home === 'number' &&
      typeof fixture.goals?.away === 'number' &&
      (fixture.teams?.home?.id === teamId || fixture.teams?.away?.id === teamId),
    )
    .sort((left, right) =>
      String(right.fixture?.date ?? '').localeCompare(String(left.fixture?.date ?? '')))
    .slice(0, 5)
  if (ordered.length < 3) return undefined

  const totals = ordered.reduce((stats, fixture) => {
    const isHome = fixture.teams?.home?.id === teamId
    const scored = isHome ? fixture.goals!.home! : fixture.goals!.away!
    const conceded = isHome ? fixture.goals!.away! : fixture.goals!.home!
    return { scored: stats.scored + scored, conceded: stats.conceded + conceded }
  }, { scored: 0, conceded: 0 })

  return {
    scored: totals.scored / ordered.length,
    conceded: totals.conceded / ordered.length,
  }
}

async function mapApiFootballFixtures(date: string, credentials: NonNullable<ReturnType<typeof apiFootballCredentials>>) {
  const response = await apiFootballGet(credentials, `/fixtures?date=${encodeURIComponent(date)}&timezone=UTC`)
  if (!Array.isArray(response)) return []
  const fixtures = response as ApiFootballFixture[]
  const teamIds = [...new Set(fixtures.flatMap((fixture) =>
    [fixture.teams?.home?.id, fixture.teams?.away?.id].filter((id): id is number => typeof id === 'number'),
  ))].slice(0, 40)
  const teamStats = new Map<number, TeamGoalStats>()
  await Promise.all(teamIds.map(async (teamId) => {
    try {
      const recent = await apiFootballGet(credentials, `/fixtures?team=${teamId}&status=FT&last=5&timezone=UTC`)
      const stats = recentGoalStats(Array.isArray(recent) ? recent : [], teamId)
      if (stats) teamStats.set(teamId, stats)
    } catch {
      // Missing form data is intentionally excluded from the featured picks.
    }
  }))

  return fixtures.flatMap((fixture) => {
    const fixtureId = fixture.fixture?.id
    const kickoffDate = fixture.fixture?.date
    const home = fixture.teams?.home
    const away = fixture.teams?.away
    if (!fixtureId || !kickoffDate || !home?.name || !away?.name) return []
    const statusShort = fixture.fixture?.status?.short
    if (!statusShort || !['NS', 'TBD'].includes(String(statusShort))) return []
    const homeStats = typeof home.id === 'number' ? teamStats.get(home.id) : undefined
    const awayStats = typeof away.id === 'number' ? teamStats.get(away.id) : undefined
    if (!homeStats || !awayStats) return []
    const expectedTotalGoals = (
      homeStats.scored + awayStats.conceded + awayStats.scored + homeStats.conceded
    ) / 2
    const over15Probability = 1 - Math.exp(-expectedTotalGoals) * (1 + expectedTotalGoals)
    if (!Number.isFinite(over15Probability) || over15Probability <= 0) return []
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
      marketType: 'Over1.5',
      over15Probability,
      over15Odds: 1 / over15Probability,
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
    const paginated = mapped.slice((pageNum - 1) * pageSize, pageNum * pageSize)
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
