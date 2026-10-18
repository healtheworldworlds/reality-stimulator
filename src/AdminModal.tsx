import { useState, type FormEvent } from 'react'

type AuthSettingsResponse = {
  valid?: boolean
  success?: boolean
  passwordRequired?: boolean
  error?: string
}

type AdminModalProps = {
  passwordRequired: boolean
  onClose: () => void
  onSaved: (passwordRequired: boolean) => void
}

type VisitorUnlockModalProps = {
  onUnlocked: () => void
}

async function postAuthAction(action: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/auth-settings?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null) as AuthSettingsResponse | null
  if (!response.ok) throw new Error(result?.error ?? `Request failed (HTTP ${response.status}).`)
  return result
}

export function VisitorUnlockModal({ onUnlocked }: VisitorUnlockModalProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await postAuthAction('verify', { code })
      if (!result?.valid) {
        setError('Incorrect passcode. Try again.')
        setCode('')
        return
      }
      sessionStorage.setItem('app_unlocked', 'true')
      onUnlocked()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not verify the passcode.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-overlay">
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="visitor-auth-title">
        <p className="eyebrow">Visitor access</p>
        <h2 id="visitor-auth-title">Enter Passcode to Enter</h2>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="visitor-access-code">Passcode</label>
          <input
            id="visitor-access-code"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="run-button" type="submit" disabled={submitting || code.length === 0}>
            {submitting ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </section>
    </div>
  )
}

export function AdminModal({ passwordRequired: initialPasswordRequired, onClose, onSaved }: AdminModalProps) {
  const [masterKey, setMasterKey] = useState('')
  const [verified, setVerified] = useState(false)
  const [passwordRequired, setPasswordRequired] = useState(initialPasswordRequired)
  const [newAccessCode, setNewAccessCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function verifyMasterKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await postAuthAction('verify-master', { masterKey })
      if (!result?.valid) {
        setError('Master key is incorrect.')
        setMasterKey('')
        return
      }
      setVerified(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not verify the master key.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await postAuthAction('update', { masterKey, passwordRequired, newAccessCode })
      if (!result?.success) throw new Error(result?.error ?? 'Could not save settings.')
      onSaved(passwordRequired)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="admin-auth-title">
        <div className="auth-modal__heading">
          <div>
            <p className="eyebrow">Private controls</p>
            <h2 id="admin-auth-title">Admin Access Control</h2>
          </div>
          <button className="auth-modal__close" type="button" onClick={onClose} aria-label="Close admin access control">✕</button>
        </div>
        {!verified ? (
          <form className="auth-form" onSubmit={(event) => void verifyMasterKey(event)}>
            <label htmlFor="admin-master-key">Enter Master Key</label>
            <input
              id="admin-master-key"
              type="password"
              value={masterKey}
              onChange={(event) => setMasterKey(event.target.value)}
              autoComplete="off"
              autoFocus
              required
            />
            <p className="auth-help">Type REGINA to unlock admin controls.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="run-button" type="submit" disabled={busy || masterKey.length === 0}>
              {busy ? 'Verifying…' : 'Unlock admin controls'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => void saveSettings(event)}>
            <label className="auth-toggle">
              <input type="checkbox" checked={passwordRequired} onChange={(event) => setPasswordRequired(event.target.checked)} />
              <span>Enable Visitor Password Protection</span>
            </label>
            <label htmlFor="new-visitor-code">Visitor Access Code</label>
            <input
              id="new-visitor-code"
              type="password"
              value={newAccessCode}
              onChange={(event) => setNewAccessCode(event.target.value)}
              autoComplete="new-password"
              placeholder="Leave blank to keep the current code"
            />
            <p className="auth-help">Enter a new code to change it. Leave blank to keep the current code.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="run-button" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
