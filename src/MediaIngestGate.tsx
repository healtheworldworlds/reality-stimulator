import { useState, type FormEvent } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { MediaIngestDropzone } from './MediaIngestDropzone'
import type { LiveFixture } from './api/fixtures'

type MediaIngestGateProps = {
  onFixtures: (fixtures: LiveFixture[], fileName: string) => void
}

// Gates the screenshot/video scanner behind the admin key. The key is verified
// against /api/auth-settings?action=verify-master and held only in memory —
// never in localStorage — then sent as the x-admin-key header on each upload.
export function MediaIngestGate({ onFixtures }: MediaIngestGateProps) {
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (verifying || !draft) return
    setVerifying(true)
    setError('')
    try {
      const response = await fetch('/api/auth-settings?action=verify-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: draft }),
      })
      const result = (await response.json().catch(() => null)) as { valid?: boolean; error?: string } | null
      if (!response.ok) throw new Error(result?.error ?? `Verification unavailable (HTTP ${response.status}).`)
      if (!result?.valid) {
        setError('Incorrect admin key. Try again.')
        setDraft('')
        return
      }
      setAdminKey(draft)
      setDraft('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not verify the admin key.')
    } finally {
      setVerifying(false)
    }
  }

  if (adminKey === null) {
    return (
      <div className="media-ingest">
        <div className="media-ingest__locked">
          <Lock size={16} aria-hidden />
          <span className="media-ingest__label">Screenshot &amp; video scanning is admin-only</span>
          <span className="media-ingest__hint">Enter the admin key to unlock media scanning for this session.</span>
          <form className="media-ingest__unlock" onSubmit={unlock}>
            <input
              type="password"
              autoComplete="off"
              maxLength={128}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Admin key"
              aria-label="Admin key"
              required
            />
            <button className="quiet-button" type="submit" disabled={verifying || !draft}>
              {verifying ? 'Verifying…' : 'Unlock'}
            </button>
          </form>
        </div>
        {error && <p className="media-ingest__status is-error" role="alert">{error}</p>}
      </div>
    )
  }

  return (
    <div className="media-ingest">
      <MediaIngestDropzone adminKey={adminKey} onFixtures={onFixtures} />
      <button
        className="quiet-button media-ingest__lock"
        type="button"
        onClick={() => { setAdminKey(null); setError('') }}
      >
        <LockOpen size={12} /> Lock media scanning
      </button>
    </div>
  )
}
