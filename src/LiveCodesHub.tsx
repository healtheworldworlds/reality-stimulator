import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type LiveCode = {
  id: string
  code: string
  odds: number | null
  time: string
  bookie: 'sportybet'
  channel: string
  countryCode?: 'GHANA'
  source?: 'telegram' | 'generated' | 'manual'
  ocr?: boolean
  legs?: Array<{ market: string; pick: string; odds: number }>
}

type FeedPayload = {
  success?: boolean
  error?: string
  updatedAt?: string
  sportybet?: LiveCode[]
  warnings?: string[]
}

function relativeTime(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function LiveCodesHub() {
  const [feed, setFeed] = useState<FeedPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/live-codes?refresh=${Date.now()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as FeedPayload | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error ?? `Feed unavailable (HTTP ${response.status}).`)
      setFeed(payload)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Feed unavailable.')
    } finally {
      setLoading(false)
      setNow(Date.now())
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0)
    return () => clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const timer = setInterval(() => void refresh(), 60_000)
    return () => clearInterval(timer)
  }, [autoRefresh, refresh])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!copiedId) return undefined
    const timer = setTimeout(() => setCopiedId(null), 2000)
    return () => clearTimeout(timer)
  }, [copiedId])

  async function copyCode(item: LiveCode) {
    try {
      await navigator.clipboard.writeText(item.code)
      setCopiedId(item.id)
    } catch {
      setError('Could not copy the code. Select it manually instead.')
    }
  }

  const items = (feed?.sportybet ?? []).filter((item) =>
    item.bookie === 'sportybet' && (item.countryCode ?? 'GHANA') === 'GHANA')

  return (
    <section className="live-codes" aria-labelledby="live-codes-heading">
      <div className="side-heading">
        <div><p className="eyebrow">Community feed</p><h2 id="live-codes-heading">Live community booking codes</h2></div>
      </div>
      <div className="live-codes__toolbar">
        <button className="quiet-button" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'is-spinning' : undefined} /> Refresh Feed
        </button>
      </div>
      <label className="live-codes__auto">
        <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
        Auto-refresh every 60 seconds
      </label>
      <p className="live-codes__guide">Available booking codes for SportyBet Ghana (GH).</p>
      {error && <p className="live-codes__error" role="alert">{error}</p>}
      {feed?.warnings?.map((warning) => <p className="live-codes__warning" key={warning}>{warning}</p>)}
      {!error && !loading && items.length === 0 && <p className="live-codes__empty">No SportyBet GH codes found right now.</p>}
      <ul className="live-codes__list">
        {items.map((item) => (
          <li className="live-code" key={item.id}>
            <div className="live-code__main">
              <strong className="live-code__code">{item.code}</strong>
              <span className="live-code__country">SPORTYBET GH</span>
              <span className="live-code__country">
                {item.countryCode ?? 'GHANA'}
              </span>
              <span className="live-code__country">{item.source === 'manual' ? 'MANUAL' : 'GENERATED'}</span>
            </div>
            <div className="live-code__tags">
              {typeof item.odds === 'number' && item.odds > 0 && <span className="live-code__odds">{item.odds} Odds</span>}
              {item.legs && item.legs.length > 0 && <span className="live-code__odds">{item.legs.length} legs</span>}
              {item.legs && <span className="live-code__channel">{[...new Set(item.legs.map((leg) => leg.market))].join(', ')}</span>}
              <span className="live-code__time">{relativeTime(item.time, now)}</span>
            </div>
            <div className="live-code__actions">
              <button className="quiet-button" type="button" onClick={() => void copyCode(item)}>
                {copiedId === item.id ? '✓ Code Copied!' : 'Copy Code'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
