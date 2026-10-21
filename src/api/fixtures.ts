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
    const res = await fetch('/api/fixtures');
    if (!res.ok) {
      return { status: 'fallback', fixtures: [], reason: 'server-error' };
    }

    const data: any = await res.json();
    if (data?.status === 'available' && Array.isArray(data.response) && data.response.length > 0) {
      return { status: 'available', fixtures: data.response };
    }

    return { status: 'fallback', fixtures: [], reason: data?.error || 'no-matches' };
  } catch (err: any) {
    return { status: 'fallback', fixtures: [], reason: err.message };
  }
}
