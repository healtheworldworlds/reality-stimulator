export interface LiveFixture {
  id: string
  kickoff: string
  kickoffDate: string
  status: string
  competition: string
  home: string
  away: string
  marketType?: '1X2' | 'Over1.5' | 'Over2.5' | 'SHH'
  selectedOption?: '1' | 'X' | '2'
  sportyOdd?: number
  generatedId?: string
  homeScoringStreak?: number
  awayScoringStreak?: number
  streakDataAvailable?: boolean
  source?: 'api-football' | 'sportybet'
  teams?: {
    home: string
    away: string
  }
}

export interface FixtureFetchResult {
  status: 'available' | 'fallback'
  fixtures: LiveFixture[]
  reason?: string
}

type FixturesApiResponse = {
  status?: 'available' | 'fallback'
  response?: LiveFixture[]
  error?: string
  source?: string
}

function noFixturesFallback(reason: string): FixtureFetchResult {
  return {
    status: 'fallback',
    fixtures: [],
    reason,
  }
}

export async function fetchTodaysFixtures(_start?: unknown, _end?: unknown): Promise<FixtureFetchResult> {
  try {
    const date = new Date().toISOString().slice(0, 10)
    const response = await fetch(`/api/fixtures?date=${date}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null) as FixturesApiResponse | null
    if (response.ok && payload?.status === 'available' && Array.isArray(payload.response) && payload.response.length > 0) {
      return { status: 'available', fixtures: payload.response }
    }
    if (payload?.error) return noFixturesFallback(payload.error)
    return noFixturesFallback(`Fixture service unavailable (HTTP ${response.status}).`)
  } catch (error) {
    return noFixturesFallback(error instanceof Error ? error.message : 'Fixture service unavailable.')
  }
}
