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

const UPSTREAM_TIMEOUT_MS = 9000;
const SPORTYBET_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/m/sport/football'
};

export default async function fixturesHandler(request: FixturesRequest, response: FixturesResponse) {
  response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=90, stale-while-revalidate=180');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    // 1. Fetch live upcoming football events from SportyBet Ghana directly
    const sportyUrl = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents?sportId=sr:sport:1&_t=' + Date.now();
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(sportyUrl, {
      headers: SPORTYBET_HEADERS,
      signal: controller.signal
    });
    clearTimeout(timer);

    let sportyEvents: any[] = [];
    if (upstream.ok) {
      const data = await upstream.json();
      const tournaments = data?.data?.tournaments || [];
      for (const t of tournaments) {
        for (const e of (t.events || [])) {
          if (e.eventId && e.status === 'not_started') {
            // Find Over 1.5 market directly in the feed if present
            let over15Odd = 0;
            const markets = e.markets || [];
            for (const m of markets) {
              if (m.specifier === 'total=1.5' || (m.desc && m.desc.includes('1.5'))) {
                const overOutcome = (m.outcomes || []).find((o: any) => o.desc === 'Over' || o.id === '12');
                if (overOutcome?.odds) {
                  over15Odd = parseFloat(overOutcome.odds);
                }
              }
            }

            sportyEvents.push({
              id: e.eventId,
              home: e.homeTeamName || 'Home',
              away: e.awayTeamName || 'Away',
              competition: t.name || 'SportyBet Football',
              kickoffDate: new Date(e.estimateStartTime || Date.now()).toISOString(),
              estimateStartTime: e.estimateStartTime,
              odds: over15Odd
            });
          }
        }
      }
    }

    // 2. If SportyBet list loaded, format mapped fixtures with exact Ghana GMT kickoff
    if (sportyEvents.length > 0) {
      const nowMs = Date.now();
      const mapped = sportyEvents
        .filter((e) => !e.estimateStartTime || e.estimateStartTime >= nowMs)
        .map((e) => {
          const d = new Date(e.estimateStartTime || Date.now());
          const hours = String(d.getUTCHours()).padStart(2, '0');
          const mins = String(d.getUTCMinutes()).padStart(2, '0');
          return {
            id: String(e.id),
            date: e.kickoffDate,
            status: 'NS',
            kickoff: `${hours}:${mins} GMT`,
            kickoffDate: e.kickoffDate,
            competition: e.competition,
            home: e.home,
            away: e.away,
            sportyOdd: e.odds > 0 ? e.odds : null,
            teams: { home: e.home, away: e.away }
          };
        });

      return response.status(200).json({ status: 'available', response: mapped, source: 'sportybet-gh' });
    }

    // 3. Fallback to API-Football if SportyBet rate limits upstream
    const apiKey = process.env.FOOTBALL_API_KEY?.trim();
    if (apiKey) {
      const today = new Date().toISOString().slice(0, 10);
      const fbUrl = `https://v3.football.api-sports.io/fixtures?date=${today}&timezone=UTC`;
      const fbRes = await fetch(fbUrl, { headers: { 'x-apisports-key': apiKey, 'Accept': 'application/json' } });
      if (fbRes.ok) {
        const payload = await fbRes.json();
        const items = (payload.response || []).filter((i: any) => i?.fixture?.id && i.fixture.status?.short === 'NS');
        const mapped = items.map((i: any) => {
          const d = new Date(i.fixture.date);
          const hours = String(d.getUTCHours()).padStart(2, '0');
          const mins = String(d.getUTCMinutes()).padStart(2, '0');
          return {
            id: String(i.fixture.id),
            date: i.fixture.date,
            status: 'NS',
            kickoff: `${hours}:${mins} GMT`,
            kickoffDate: i.fixture.date,
            competition: i.league?.name || 'Football',
            home: i.teams.home.name.trim(),
            away: i.teams.away.name.trim(),
            teams: { home: i.teams.home.name.trim(), away: i.teams.away.name.trim() }
          };
        });
        return response.status(200).json({ status: 'available', response: mapped, source: 'api-football' });
      }
    }

    return response.status(200).json({ status: 'fallback', response: [] });
  } catch (err: any) {
    return response.status(500).json({ error: err.message || 'Failed to query match feed' });
  }
}
