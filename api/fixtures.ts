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

export interface ApiPayload {
  response?: any[];
  errors?: any;
}

const UPSTREAM_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// Exact SportyBet Ghana League IDs from src/engine/leagues.ts
const SPORTYBET_LEAGUE_IDS = new Set<number>([
  39, 40, 41, 45, 48,          // England: PL, Championship, L1, FA Cup, EFL Cup
  140, 141, 143,               // Spain: La Liga, La Liga 2, Copa del Rey
  135, 136, 137,               // Italy: Serie A, Serie B, Coppa Italia
  78, 79, 81,                  // Germany: Bundesliga, 2. Bundesliga, DFB Pokal
  61, 62,                      // France: Ligue 1, Ligue 2
  2, 3, 848,                   // European: Champions League, Europa League, Conference League
  88, 94, 253, 71, 128, 288, 570 // Eredivisie, Portugal, MLS, Brazil, Argentina, South Africa, Ghana
]);

function checkRateLimit(clientId: string, now: number) {
  for (const [key, entry] of rateLimits.entries()) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }
  const current = rateLimits.get(clientId);
  if (!current || current.resetAt <= now) {
    rateLimits.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, resetAt: now + RATE_LIMIT_WINDOW_MS, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, resetAt: current.resetAt, remaining: 0 };
  }
  current.count += 1;
  return { allowed: true, resetAt: current.resetAt, remaining: RATE_LIMIT_MAX_REQUESTS - current.count };
}

export default async function fixturesHandler(request: FixturesRequest, response: FixturesResponse) {
  response.setHeader('Cache-Control', 'public, max-age=120, s-maxage=180, stale-while-revalidate=300');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const now = new Date();
  const ghanaDateStr = now.toISOString().slice(0, 10);
  const date = typeof request.query?.date === 'string' ? request.query.date : ghanaDateStr;

  const clientId = (request.headers?.['x-forwarded-for'] as string)?.split(',')[0] || request.socket?.remoteAddress || 'unknown';
  const limit = checkRateLimit(clientId, Date.now());
  if (!limit.allowed) {
    return response.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  const apiKey = process.env.FOOTBALL_API_KEY?.trim();
  if (!apiKey) {
    return response.status(503).json({ error: 'FOOTBALL_API_KEY is not configured in Vercel environment.' });
  }

  try {
    const url = new URL('https://v3.football.api-sports.io/fixtures');
    url.searchParams.set('date', date);
    url.searchParams.set('timezone', 'UTC');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return response.status(502).json({ error: `Upstream error: HTTP ${upstream.status}` });
    }

    const payload = (await upstream.json()) as ApiPayload;
    const items = payload.response || [];

    const currentTimeMs = Date.now() - 5 * 60 * 1000;

    const mapped = items
      .filter((item: any) => {
        if (!item?.fixture?.id || !item?.teams?.home?.name || !item?.teams?.away?.name) return false;
        
        // 1. Must belong to a confirmed SportyBet league
        const leagueId = Number(item.league?.id);
        if (!SPORTYBET_LEAGUE_IDS.has(leagueId)) return false;

        // 2. Must not be finished or in-play
        const status = item.fixture.status?.short || '';
        const isNotStarted = status === 'NS' || status === 'TBD';

        // 3. Kickoff must be in the future (Ghana GMT)
        const kickoffTimeMs = new Date(item.fixture.date).getTime();
        const isFuture = kickoffTimeMs >= currentTimeMs;

        return isNotStarted && isFuture;
      })
      .map((item: any) => {
        const d = new Date(item.fixture.date);
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const mins = String(d.getUTCMinutes()).padStart(2, '0');
        return {
          id: String(item.fixture.id),
          date: item.fixture.date,
          status: 'NS',
          kickoff: `${hours}:${mins} GMT`,
          kickoffDate: item.fixture.date,
          competition: item.league?.name || 'Football',
          home: item.teams.home.name.trim(),
          away: item.teams.away.name.trim(),
          teams: {
            home: item.teams.home.name.trim(),
            away: item.teams.away.name.trim()
          }
        };
      });

    return response.status(200).json({ status: 'available', response: mapped });
  } catch (err: any) {
    return response.status(500).json({ error: err.message || 'Failed to fetch fixtures' });
  }
}
