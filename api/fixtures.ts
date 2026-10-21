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

const UPSTREAM_TIMEOUT_MS = 10000;

export default async function fixturesHandler(request: FixturesRequest, response: FixturesResponse) {
  response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=90, stale-while-revalidate=180');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    // SportyBet mobile endpoint with explicit headers
    const sportyUrl = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents?sportId=sr:sport:1&_t=' + Date.now();
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(sportyUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.sportybet.com/gh/m/sport/football',
        'Origin': 'https://www.sportybet.com'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return response.status(502).json({ status: 'fallback', error: `SportyBet returned ${upstream.status}` });
    }

    const data: any = await upstream.json();
    const tournaments = data?.data?.tournaments || [];
    const mapped: any[] = [];
    const nowMs = Date.now();

    for (const t of tournaments) {
      for (const e of (t.events || [])) {
        if (e.eventId && e.status === 'not_started') {
          const startMs = e.estimateStartTime || nowMs;
          if (startMs >= nowMs) {
            const d = new Date(startMs);
            const hours = String(d.getUTCHours()).padStart(2, '0');
            const mins = String(d.getUTCMinutes()).padStart(2, '0');

            let over15Odd = 0;
            for (const m of (e.markets || [])) {
              if (m.specifier === 'total=1.5' || (m.desc && m.desc.includes('1.5'))) {
                const over = (m.outcomes || []).find((o: any) => o.desc === 'Over' || o.id === '12');
                if (over?.odds) over15Odd = parseFloat(over.odds);
              }
            }

            mapped.push({
              id: String(e.eventId),
              generatedId: String(e.eventId),
              kickoff: `${hours}:${mins} GMT`,
              kickoffDate: new Date(startMs).toISOString(),
              status: 'NS',
              competition: t.name || 'SportyBet Match',
              home: e.homeTeamName || 'Home',
              away: e.awayTeamName || 'Away',
              sportyOdd: over15Odd > 0 ? over15Odd : undefined,
              teams: {
                home: e.homeTeamName || 'Home',
                away: e.awayTeamName || 'Away'
              }
            });
          }
        }
      }
    }

    if (mapped.length > 0) {
      return response.status(200).json({ status: 'available', response: mapped, source: 'sportybet' });
    }

    return response.status(200).json({ status: 'fallback', response: [], error: 'No upcoming events found on SportyBet' });
  } catch (err: any) {
    return response.status(500).json({ status: 'fallback', error: err.message || 'Error fetching from SportyBet' });
  }
}
