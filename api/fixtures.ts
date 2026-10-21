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

// Comprehensive SportyBet Ghana verified competitions
const SPORTYBET_LEAGUES_EXPANDED = new Set<number>([
  // UEFA & International
  2, 3, 848, 531, 1, 4, 5, 15, 11, 12, 13, 20, 21, 849, 1032,
  // England
  39, 40, 41, 42, 45, 48, 46, 50, 51, 52, 47, 54, 55, 683,
  // Spain
  140, 141, 143, 435, 436, 437, 438, 439, 440,
  // Italy
  135, 136, 137, 138, 715, 716, 717,
  // Germany
  78, 79, 81, 82, 83, 84,
  // France
  61, 62, 66, 63,
  // Japan, Asia & Oceania
  98, 99, 100, 311, 17, 307, 301, 292, 293, 294, 305, 306,
  // Americas
  253, 255, 256, 71, 72, 73, 75, 480, 128, 130, 262, 263, 239, 240, 242, 265, 266,
  // Africa
  570, 288, 233, 234, 381, 382, 323, 324, 332,
  // Netherlands, Belgium, Portugal & Rest of Europe
  88, 89, 90, 144, 145, 94, 95, 96, 203, 204, 179, 180, 119, 120, 103, 113, 218, 207, 197, 345, 328, 118, 106, 333
]);

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

        const leagueId = Number(item.league?.id);
        const leagueName = (item.league?.name || '').toLowerCase();

        // 1. Check if ID matches SportyBet list OR contains recognized tournament keywords
        const isRecognized = 
          SPORTYBET_LEAGUES_EXPANDED.has(leagueId) ||
          leagueName.includes('champions league') ||
          leagueName.includes('sudamericana') ||
          leagueName.includes('libertadores') ||
          leagueName.includes('j1') ||
          leagueName.includes('j2') ||
          leagueName.includes('j3') ||
          leagueName.includes('premier') ||
          leagueName.includes('liga') ||
          leagueName.includes('copa') ||
          leagueName.includes('division') ||
          leagueName.includes('pokal') ||
          leagueName.includes('cup');

        if (!isRecognized) return false;

        // 2. Reject internal simulated virtuals (SRL) which have separate odds systems
        if (leagueName.includes('srl') || leagueName.includes('simulated')) return false;

        // 3. Status must be not started
        const status = item.fixture.status?.short || '';
        const isNotStarted = status === 'NS' || status === 'TBD';

        // 4. Kickoff in future GMT
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
