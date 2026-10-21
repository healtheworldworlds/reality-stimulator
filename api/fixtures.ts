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

    // Filter out friendlies, youth reserves, and finished games
    const mapped = items
      .filter((item: any) => {
        if (!item?.fixture?.id || !item?.teams?.home?.name || !item?.teams?.away?.name) return false;
        
        const leagueName = (item.league?.name || '').toLowerCase();
        // Exclude youth/women/reserves that SportyBet doesn't list
        if (leagueName.includes('u19') || leagueName.includes('u20') || leagueName.includes('u21') || leagueName.includes('women') || leagueName.includes('reserve')) {
          return false;
        }

        const status = item.fixture.status?.short || '';
        const isNotStarted = status === 'NS' || status === 'TBD';
        const kickoffTimeMs = new Date(item.fixture.date).getTime();

        return isNotStarted && kickoffTimeMs >= currentTimeMs;
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
