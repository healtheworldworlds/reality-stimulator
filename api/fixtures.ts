import type { ApiFootballFixture, ApiPayload, FixturesRequest, FixturesResponse } from './fixtures-types';

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

export default async function fixturesHandler(request: FixturesRequest, response: FixturesResponse) {
  response.setHeader('Cache-Control', 'public, max-age=180, s-maxage=300, stale-while-revalidate=600');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  // Get current Date in Ghana GMT (UTC)
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
    url.searchParams.set('timezone', 'UTC'); // Ghana is strictly UTC/GMT

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

    const payload = await upstream.json() as ApiPayload;
    const items = payload.response || [];

    const mapped = items
      .filter((item: any) => item?.fixture?.id && item?.teams?.home?.name && item?.teams?.away?.name)
      .map((item: any) => {
        const d = new Date(item.fixture.date);
        // Format strictly in GMT (Ghana Time)
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const mins = String(d.getUTCMinutes()).padStart(2, '0');
        return {
          id: String(item.fixture.id),
          date: item.fixture.date,
          status: item.fixture.status?.short || 'NS',
          kickoff: `${hours}:${mins} GMT`,
          kickoffDate: item.fixture.date,
          competition: item.league?.name || 'Football',
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
