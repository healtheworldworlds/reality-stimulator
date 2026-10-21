export interface LiveFixture {
  id: string;
  kickoff: string;
  kickoffDate: string;
  status: string;
  competition: string;
  home: string;
  away: string;
  sportyOdd?: number;
  generatedId?: string;
  teams?: {
    home: string;
    away: string;
  };
}

export interface FixtureFetchResult {
  status: 'available' | 'fallback';
  fixtures: LiveFixture[];
  reason?: string;
}

export async function fetchTodaysFixtures(
  startMinute?: number,
  endMinute?: number
): Promise<FixtureFetchResult> {
  void startMinute;
  void endMinute;

  try {
    // Direct client-side fetch straight to SportyBet Ghana
    // Runs from your Ghana IP address, bypassing Vercel firewall blocks
    const sportyUrl = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents?sportId=sr:sport:1&_t=' + Date.now();
    
    let res: Response | null = null;
    try {
      res = await fetch(sportyUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });
    } catch (_) {
      res = null;
    }

    if (res && res.ok) {
      const data: any = await res.json();
      const tournaments = data?.data?.tournaments || [];
      const fixtures: LiveFixture[] = [];
      const nowMs = Date.now();

      for (const t of tournaments) {
        for (const e of (t.events || [])) {
          if (e.eventId && e.status === 'not_started') {
            const startMs = e.estimateStartTime || nowMs;
            if (startMs >= nowMs) {
              const d = new Date(startMs);
              const hours = String(d.getUTCHours()).padStart(2, '0');
              const mins = String(d.getUTCMinutes()).padStart(2, '0');

              // Extract actual SportyBet Over 1.5 odds from markets
              let realOdd = 0;
              for (const m of (e.markets || [])) {
                if (m.specifier === 'total=1.5' || (m.desc && m.desc.includes('1.5'))) {
                  const over = (m.outcomes || []).find((o: any) => o.desc === 'Over' || o.id === '12');
                  if (over?.odds) realOdd = parseFloat(over.odds);
                }
              }

              fixtures.push({
                id: String(e.eventId),
                generatedId: String(e.eventId),
                kickoff: `${hours}:${mins} GMT`,
                kickoffDate: new Date(startMs).toISOString(),
                status: 'NS',
                competition: t.name || 'SportyBet Match',
                home: e.homeTeamName || 'Home',
                away: e.awayTeamName || 'Away',
                sportyOdd: realOdd > 0 ? realOdd : undefined,
                teams: {
                  home: e.homeTeamName || 'Home',
                  away: e.awayTeamName || 'Away'
                }
              });
            }
          }
        }
      }

      if (fixtures.length > 0) {
        return { status: 'available', fixtures };
      }
    }

    // Fallback: If SportyBet CORS blocks the direct browser fetch, use Vercel proxy
    const fallbackRes = await fetch('/api/fixtures?timezone=UTC');
    if (fallbackRes.ok) {
      const fbData: any = await fallbackRes.json();
      if (fbData?.status === 'available' && Array.isArray(fbData.response) && fbData.response.length > 0) {
        return { status: 'available', fixtures: fbData.response };
      }
    }

    return { status: 'fallback', fixtures: [], reason: 'no-matches' };
  } catch (err: any) {
    return { status: 'fallback', fixtures: [], reason: err.message };
  }
}
