import type { ClubMatchup } from '../engine/clubs'
import { isSportyBetLeague } from '../engine/leagues'

type ApiFootballFixture = {
  fixture?: {
    id?: number
    date?: string
    status?: { short?: string }
  }
  league?: { id?: number, name?: string }
  teams?: {
    home?: { name?: string }
    away?: { name?: string }
  }
}

type ApiFootballResponse = {
  errors?: unknown
  response?: ApiFootballFixture[]
}

export type LiveFixture = ClubMatchup & {
  id: number
  kickoff: string
  kickoffDate: string
}

export type LiveFixtureResult =
  | { status: 'available'; fixtures: LiveFixture[] }
  | { status: 'fallback'; reason: 'api-unavailable' | 'no-matches' }

export function isKickoffInWindow(kickoff: string, startMinute: number, endMinute: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(kickoff)
  if (!match) return false
  const minute = Number(match[1]) * 60 + Number(match[2])
  const duration = endMinute >= startMinute ? endMinute - startMinute : endMinute + 1440 - startMinute
  const offset = (minute - startMinute + 1440) % 1440
  return offset <= duration
}

function parseFixture(item: ApiFootballFixture): LiveFixture | null {
  const id = item.fixture?.id
  const date = item.fixture?.date
  const home = item.teams?.home?.name?.trim()
  const away = item.teams?.away?.name?.trim()
  if (!isSportyBetLeague(item.league?.id) || item.fixture?.status?.short !== 'NS' || typeof id !== 'number' || !Number.isInteger(id) || !date || !home || !away || home === away) {
    return null
  }
  const kickoffDate = new Date(date)
  if (!Number.isFinite(kickoffDate.getTime())) return null
  return {
    id,
    competition: item.league?.name?.trim() || 'Football',
    home,
    away,
    kickoff: `${String(kickoffDate.getUTCHours()).padStart(2, '0')}:${String(kickoffDate.getUTCMinutes()).padStart(2, '0')}`,
    kickoffDate: kickoffDate.toISOString(),
  }
}

export async function fetchTodaysFixtures(
  startMinute: number,
  endMinute: number,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<LiveFixtureResult> {
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
  const query = new URLSearchParams({ date, timezone: 'UTC' })

  try {
    const response = await fetcher(`/api/fixtures?${query.toString()}`)
    if (!response.ok) return { status: 'fallback', reason: 'api-unavailable' }
    const payload = await response.json() as ApiFootballResponse
    const hasApiErrors = Array.isArray(payload.errors)
      ? payload.errors.length > 0
      : typeof payload.errors === 'object' && payload.errors !== null && Object.keys(payload.errors).length > 0
    if (hasApiErrors) {
      return { status: 'fallback', reason: 'api-unavailable' }
    }
    const seenFixtures = new Set<number>()
    const seenMatchups = new Set<string>()
    const fixtures = (Array.isArray(payload.response) ? payload.response : [])
      .map(parseFixture)
      .filter((fixture): fixture is LiveFixture => fixture !== null)
        .filter((fixture) => Date.parse(fixture.kickoffDate) > now.getTime())
        .filter((fixture) => isKickoffInWindow(fixture.kickoff, startMinute, endMinute))
      .filter((fixture) => {
        const matchup = [fixture.home.toLocaleLowerCase(), fixture.away.toLocaleLowerCase()].sort().join('\u0000')
        if (seenFixtures.has(fixture.id) || seenMatchups.has(matchup)) return false
        seenFixtures.add(fixture.id)
        seenMatchups.add(matchup)
        return true
      })
    if (fixtures.length === 0) return { status: 'fallback', reason: 'no-matches' }
    return { status: 'available', fixtures }
  } catch {
    return { status: 'fallback', reason: 'api-unavailable' }
  }
}
