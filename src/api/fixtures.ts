export interface LiveFixture {
  id: string;
  kickoff: string;
  kickoffDate: string;
  status: string;
  competition: string;
  home: string;
  away: string;
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

const SANITIZE_MAP: Record<string, string> = {
  'M?nchengladbach': 'Mönchengladbach',
  'Vit?ria': 'Vitoria',
  'Guimar?es': 'Guimaraes',
  'Atl?tico': 'Atletico',
  'N?rnberg': 'Nurnberg',
  'K?ln': 'Koln',
  'Legan?s': 'Leganes',
  'Alav?s': 'Alaves'
};

function cleanTeamName(name: string): string {
  let cleaned = name;
  for (const [bad, good] of Object.entries(SANITIZE_MAP)) {
    cleaned = cleaned.replaceAll(bad, good);
  }
  return cleaned;
}

export async function fetchTodaysFixtures(
  startMinute?: number,
  endMinute?: number
): Promise<FixtureFetchResult> {
  // Use parameters to satisfy TS6133
  void startMinute;
  void endMinute;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/fixtures?date=${today}&timezone=UTC`);
    
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { status: 'fallback', fixtures: [], reason: 'api-unavailable' };
    }

    const data = await res.json();
    if (data?.status === 'available' && Array.isArray(data.response)) {
      const sanitized: LiveFixture[] = data.response.map((f: any) => {
        const homeName = cleanTeamName(f.home || f.teams?.home || '');
        const awayName = cleanTeamName(f.away || f.teams?.away || '');
        return {
          id: String(f.id),
          generatedId: String(f.id),
          kickoff: f.kickoff,
          kickoffDate: f.kickoffDate,
          status: f.status || 'NS',
          competition: f.competition || 'Football',
          home: homeName,
          away: awayName,
          teams: {
            home: homeName,
            away: awayName
          }
        };
      });
      return { status: 'available', fixtures: sanitized };
    }
    return { status: 'fallback', fixtures: [], reason: 'no-matches' };
  } catch {
    return { status: 'fallback', fixtures: [], reason: 'network-error' };
  }
}
