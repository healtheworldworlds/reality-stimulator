export interface LiveFixture {
  id: string;
  kickoff: string;
  kickoffDate: string;
  status: string;
  competition: string;
  teams: {
    home: string;
    away: string;
  };
}

export interface FixtureFetchResult {
  status: 'available' | 'fallback';
  fixtures?: LiveFixture[];
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
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/fixtures?date=${today}&timezone=UTC`);
    
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { status: 'fallback', reason: 'api-unavailable' };
    }

    const data = await res.json();
    if (data?.status === 'available' && Array.isArray(data.response)) {
      const sanitized: LiveFixture[] = data.response.map((f: LiveFixture) => ({
        ...f,
        teams: {
          home: cleanTeamName(f.teams?.home || ''),
          away: cleanTeamName(f.teams?.away || '')
        }
      }));
      return { status: 'available', fixtures: sanitized };
    }
    return { status: 'fallback', reason: 'no-matches' };
  } catch {
    return { status: 'fallback', reason: 'network-error' };
  }
}
