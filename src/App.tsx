import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { DailyFixtureBoard } from './DailyFixtureBoard'
import { LiveCodesHub } from './LiveCodesHub'
import { MediaIngestGate } from './MediaIngestGate'
import { AdminModal, VisitorUnlockModal } from './AdminModal'
import type { LiveFixture } from './api/fixtures'
import './App.css'

function App() {
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [retrySettings, setRetrySettings] = useState(0)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [ingestedFixtures, setIngestedFixtures] = useState<LiveFixture[]>([])
  const [adminStatus, setAdminStatus] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await fetch('/api/auth-settings')
        const payload = await response.json().catch(() => null) as { passwordRequired?: boolean; error?: string } | null
        if (!response.ok || typeof payload?.passwordRequired !== 'boolean') {
          throw new Error(payload?.error ?? `Could not load access settings (HTTP ${response.status}).`)
        }
        const sessionUnlocked = payload.passwordRequired && sessionStorage.getItem('app_unlocked') === 'true'
        if (active) {
          setPasswordRequired(payload.passwordRequired)
          setUnlocked(!payload.passwordRequired || sessionUnlocked)
          setSettingsError('')
          setSettingsLoaded(true)
        }
      } catch (error) {
        if (active) {
          setSettingsError(error instanceof Error ? error.message : 'Could not load access settings.')
          setSettingsLoaded(true)
        }
      }
    })()
    return () => { active = false }
  }, [retrySettings])

  if (!settingsLoaded) {
    return <main className="auth-page-status" role="status">Loading access settings…</main>
  }
  if (settingsError) {
    return (
      <main className="auth-page-status" role="alert">
        <p>{settingsError}</p>
        <button className="quiet-button" type="button" onClick={() => { setSettingsLoaded(false); setRetrySettings((value) => value + 1) }}>
          Retry
        </button>
      </main>
    )
  }
  if (passwordRequired && !unlocked) {
    return <VisitorUnlockModal onUnlocked={() => setUnlocked(true)} />
  }

  return (
    <>
      <main className="workbench daily-app">
        <header className="topbar">
          <a className="wordmark" href="#top" aria-label="Reality Simulator home">
            <span className="wordmark__mark">RS</span>
            <span>Reality Simulator</span>
          </a>
          <nav className="topbar__nav" aria-label="Main navigation">
            <a className="nav-link is-active" href="#fixtures">Today’s picks</a>
            <button className="quiet-button" type="button" onClick={() => setIsAdminOpen(true)}>
              <LockKeyhole size={13} /> Admin
            </button>
          </nav>
        </header>

        <section className="daily-app__intro" id="top">
          <p className="eyebrow">Daily football fixtures</p>
          <h1>Today’s Over 1.5 Goals picks</h1>
          <p>Ten upcoming matches selected from recent scoring form, with kickoff details and estimated odds.</p>
        </section>

        <DailyFixtureBoard />
        <LiveCodesHub />

        {adminKey && (
          <section className="admin-tools" aria-labelledby="admin-tools-heading">
            <div className="admin-tools__heading">
              <div>
                <p className="eyebrow">Private controls</p>
                <h2 id="admin-tools-heading">Admin tools</h2>
              </div>
              <button
                className="quiet-button"
                type="button"
                onClick={() => { setAdminKey(null); setIngestedFixtures([]); setAdminStatus('') }}
              >
                Lock admin mode
              </button>
            </div>
            <MediaIngestGate
              adminKey={adminKey}
              onFixtures={(fixtures, fileName) => {
                setIngestedFixtures(fixtures)
                setAdminStatus(`${fixtures.length} match${fixtures.length === 1 ? '' : 'es'} scanned from ${fileName}.`)
              }}
            />
            {adminStatus && <p className="media-ingest__status" role="status">{adminStatus}</p>}
            {ingestedFixtures.length > 0 && (
              <ul className="admin-tools__fixtures">
                {ingestedFixtures.map((fixture) => (
                  <li key={fixture.id}>
                    <strong>{fixture.home} vs {fixture.away}</strong>
                    <span>{fixture.competition} · {fixture.kickoff}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <footer className="page-footer">
          <span>Reality Simulator</span>
        </footer>
      </main>

      {isAdminOpen && (
        <AdminModal
          passwordRequired={passwordRequired}
          onClose={() => setIsAdminOpen(false)}
          onSaved={setPasswordRequired}
          onAdminVerified={setAdminKey}
        />
      )}
    </>
  )
}

export default App
