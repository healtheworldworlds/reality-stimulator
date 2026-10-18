import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type Bookie = 'sportybet' | 'betway'

type LiveCode = {
  id: string
  code: string
  odds: number | null
  time: string
  bookie: Bookie
  channel: string
}

type FeedPayload = {
  success?: boolean
  error?: string
  updatedAt?: string
  sportybet?: LiveCode[]
  betway?: LiveCode[]
  warnings?: string[]
}

const BOOKIES: Record<Bookie, { label: string, loadLabel: string, url: string }> = {
  sportybet: { label: 'SportyBet GH', loadLabel: 'Load on SportyBet', url: 'https://www.sportybet.com/gh/' },
  betway: { label: 'Betway', loadLabel: 'Load on Betway', url: 'https://www.betway.com.gh/' },
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
  const [bookie, setBookie] = useState<Bookie>('sportybet')
  const [feed, setFeed] = useState<FeedPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/live-codes')
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
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(timer)
  }, [toast])

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

  function convertCode(item: LiveCode) {
    window.open('https://convertbetcodes.com/', '_blank', 'noopener,noreferrer')
    void navigator.clipboard.writeText(item.code).then(
      () => setToast('Code copied! Opening universal converter...'),
      () => setError('Could not copy the code. Select it manually instead.'),
    )
  }

  const items = feed?.[bookie] ?? []
  const meta = BOOKIES[bookie]

  return (
    <section className="live-codes" aria-labelledby="live-codes-heading">
      <div className="side-heading">
        <div><p className="eyebrow">Community feed</p><h2 id="live-codes-heading">Live community booking codes</h2></div>
      </div>
      <div className="live-codes__toolbar">
        <div className="live-codes__tabs" role="group" aria-label="Bookmaker">
          {(Object.keys(BOOKIES) as Bookie[]).map((key) => (
            <button key={key} type="button" className={`live-codes__tab${bookie === key ? ' is-active' : ''}`} aria-pressed={bookie === key} onClick={() => setBookie(key)}>
              {BOOKIES[key].label}
            </button>
          ))}
        </div>
        <button className="quiet-button" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'is-spinning' : undefined} /> Refresh Feed
        </button>
      </div>
      <label className="live-codes__auto">
        <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
        Auto-refresh every 60 seconds
      </label>
      <p className="live-codes__guide">Works with all SportyBet codes (NG, KE, GH, UG) and Betway. Click 'Convert Code ⇄' to convert any foreign slip directly for your account.</p>
      {toast && <p className="live-codes__toast" role="status">{toast}</p>}
      {error && <p className="live-codes__error" role="alert">{error}</p>}
      {feed?.warnings?.map((warning) => <p className="live-codes__warning" key={warning}>Some channels could not refresh: {warning}</p>)}
      {!error && !loading && items.length === 0 && <p className="live-codes__empty">No {meta.label} codes found right now.</p>}
      <ul className="live-codes__list">
        {items.map((item) => (
          <li className="live-code" key={item.id}>
            <div className="live-code__main">
              <strong className="live-code__code">{item.code}</strong>
              <div className="live-code__tags">
                {item.odds !== null && <span className="live-code__odds">{item.odds} Odds</span>}
                <span className="live-code__time">{relativeTime(item.time, now)}</span>
                <span className="live-code__channel">@{item.channel}</span>
              </div>
            </div>
            <div className="live-code__actions">
              <button className="quiet-button" type="button" onClick={() => void copyCode(item)}>
                {copiedId === item.id ? '✓ Code Copied!' : 'Copy Code'}
              </button>
              <button className="quiet-button" type="button" onClick={() => convertCode(item)}>Convert Code ⇄</button>
              <a className="live-code__load" href={meta.url} target="_blank" rel="noopener noreferrer">{meta.loadLabel} ↗</a>
            </div>
          </li>
        ))}
      </ul>
      <p className="live-codes__note">Codes are scraped from public Telegram previews. They are unverified and may be expired. Never pay for codes.</p>
    </section>
  )
}
