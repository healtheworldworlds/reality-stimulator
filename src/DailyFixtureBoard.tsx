import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchTodaysFixtures, type LiveFixture } from './api/fixtures'

const DAILY_PICK_COUNT = 10

function isFeaturedFixture(fixture: LiveFixture) {
  if (!fixture || typeof fixture !== 'object') return false
  return typeof fixture.over15Probability === 'number' &&
    fixture.over15Probability > 0 &&
    fixture.over15Probability <= 1 &&
    typeof fixture.over15Odds === 'number' &&
    Number.isFinite(fixture.over15Odds) &&
    fixture.over15Odds >= 1 &&
    typeof fixture.kickoffDate === 'string' &&
    typeof fixture.home === 'string' &&
    fixture.home.length > 0 &&
    typeof fixture.away === 'string' &&
    fixture.away.length > 0
}

export function DailyFixtureBoard() {
  const [fixtures, setFixtures] = useState<LiveFixture[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    void fetchTodaysFixtures().then((result) => {
      if (!active) return
      if (result.status === 'fallback') {
        setFixtures([])
        setError(result.reason ?? 'Today’s fixtures are not available right now.')
        return
      }
      setFixtures(result.fixtures.filter(isFeaturedFixture))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [refreshKey])

  const picks = useMemo(
    () => [...fixtures]
      .sort((left, right) =>
        (right.over15Probability ?? 0) - (left.over15Probability ?? 0) ||
        left.kickoffDate.localeCompare(right.kickoffDate),
      )
      .slice(0, DAILY_PICK_COUNT),
    [fixtures],
  )

  return (
    <section className="daily-board" id="fixtures" aria-labelledby="daily-board-heading">
      <div className="daily-board__heading">
        <div>
          <p className="eyebrow">Today’s matches</p>
          <h2 id="daily-board-heading">Over 1.5 Goals picks</h2>
          <p className="daily-board__intro">The 10 strongest fixtures by recent scoring form.</p>
        </div>
        <button
          className="quiet-button daily-board__refresh"
          type="button"
          onClick={() => {
            setLoading(true)
            setError('')
            setRefreshKey((key) => key + 1)
          }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'is-spinning' : undefined} />
          {loading ? 'Loading fixtures' : 'Refresh'}
        </button>
      </div>

      {error && <p className="daily-board__message is-error" role="alert">{error}</p>}
      {!loading && !error && picks.length === 0 && (
        <p className="daily-board__message" role="status">No qualifying fixtures are available today.</p>
      )}
      {loading && <p className="daily-board__message" role="status">Loading today’s fixtures…</p>}
      {picks.length > 0 && (
        <ol className="daily-picks">
          {picks.map((fixture) => (
            <li className="daily-pick" key={fixture.id}>
              <div className="daily-pick__details">
                <span className="daily-pick__league">{fixture.competition}</span>
                <time dateTime={fixture.kickoffDate}>{fixture.kickoff}</time>
              </div>
              <div className="daily-pick__teams">
                <span>{fixture.home}</span>
                <span className="daily-pick__versus">vs</span>
                <span>{fixture.away}</span>
              </div>
              <div className="daily-pick__selection">
                <span className="daily-pick__badge">Over 1.5 Goals</span>
                <span className="daily-pick__odds">Est. odds {fixture.over15Odds?.toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      {picks.length > 0 && (
        <p className="daily-board__note">
          Showing {picks.length} of {DAILY_PICK_COUNT} picks where available. Estimated odds use each team’s recent results and are not live bookmaker prices.
        </p>
      )}
    </section>
  )
}
