// Palette: #FAFAF8, #FFFFFF, #1A1A1A, #666660, #E5E5E0, #C85A32; type: Georgia + Inter/system sans.
// Icons: Lucide outline set, monochrome, 1.5px stroke.
import { useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { createWorker } from 'tesseract.js'
import {
  Activity,
  ArrowDownToLine,
  CircleHelp,
  Clipboard,
  FileImage,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { verifyPasscode } from './security/passcode'
import {
  calculateProbabilities,
  expectedValue,
  sampleScoreline,
  MAX_GOAL_RATE,
  MAX_DIXON_COLES_RHO,
  MIN_DIXON_COLES_RHO,
  type Market,
  type MarketProbabilities,
  type MarketSelection,
} from './engine/simulation'
import { parseBatchMatchList, parseBetslipText, type ParsedBetslipFixture } from './engine/betslipParser'
import './App.css'

type Fixture = {
  id: string
  competition: string
  kickoff: string
  home: string
  away: string
  homePrior: number
  awayPrior: number
  homeRecent: number
  awayRecent: number
  recentAgeDays: number
  odds: Record<Market, number>
}

type AttachedScreenshot = {
  id: number
  name: string
  size: number
  ocrStatus: string
}

type VerifiedScreenshot = {
  file: File
  attachment: AttachedScreenshot
}

type OcrProgress = {
  attachmentId: number
  fileName: string
  percent: number
  stage: string
}

type CustomFixtureDraft = {
  home: string
  away: string
  kickoff: string
  lambda: string
  mu: string
  homeOdds: string
  drawOdds: string
  awayOdds: string
}

const MIN_HALF_LIFE_DAYS = 7
const MAX_HALF_LIFE_DAYS = 90
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_SCREENSHOTS = 5
const MAX_PASTED_TEXT_LENGTH = 5000
const MAX_OCR_TEXT_LENGTH = 20_000
const MAX_CUSTOM_TEAM_NAME_LENGTH = 80
const MAX_CUSTOM_KICKOFF_LENGTH = 64
const MAX_FIXTURE_POOL_SIZE = 100
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const DEFAULT_CUSTOM_ODDS: Record<Market, number> = {
  home: 1.01,
  draw: 1.01,
  away: 1.01,
  over15: 1.32,
  under15: 3.4,
  over25: 1.9,
  under25: 1.95,
  bttsYes: 1.85,
  bttsNo: 1.9,
}
const OCR_DEFAULT_LAMBDA = 1.65
const OCR_DEFAULT_MU = 1.15

const emptyCustomFixture: CustomFixtureDraft = {
  home: '',
  away: '',
  kickoff: '',
  lambda: '1.65',
  mu: '1.15',
  homeOdds: '',
  drawOdds: '',
  awayOdds: '',
}

const fixtures: Fixture[] = [
  {
    id: 'arsenal-palace',
    competition: 'Premier League',
    kickoff: 'Today, 12:30',
    home: 'Arsenal',
    away: 'Crystal Palace',
    homePrior: 1.82,
    awayPrior: 0.91,
    homeRecent: 2.04,
    awayRecent: 0.82,
    recentAgeDays: 18,
    odds: { home: 1.48, draw: 4.45, away: 7.2, over15: 1.26, under15: 3.85, over25: 1.76, under25: 2.14, bttsYes: 1.92, bttsNo: 1.83 },
  },
  {
    id: 'girona-betis',
    competition: 'La Liga',
    kickoff: 'Today, 15:00',
    home: 'Girona',
    away: 'Real Betis',
    homePrior: 1.55,
    awayPrior: 1.18,
    homeRecent: 1.76,
    awayRecent: 1.08,
    recentAgeDays: 24,
    odds: { home: 2.22, draw: 3.36, away: 3.28, over15: 1.35, under15: 3.1, over25: 2.02, under25: 1.82, bttsYes: 1.81, bttsNo: 1.95 },
  },
  {
    id: 'brighton-forest',
    competition: 'Premier League',
    kickoff: 'Today, 17:30',
    home: 'Brighton',
    away: 'Nottingham Forest',
    homePrior: 1.61,
    awayPrior: 1.12,
    homeRecent: 1.48,
    awayRecent: 1.26,
    recentAgeDays: 14,
    odds: { home: 2.05, draw: 3.55, away: 3.65, over15: 1.3, under15: 3.4, over25: 1.88, under25: 1.96, bttsYes: 1.8, bttsNo: 1.96 },
  },
  {
    id: 'sociedad-valencia',
    competition: 'La Liga',
    kickoff: 'Tomorrow, 13:00',
    home: 'Real Sociedad',
    away: 'Valencia',
    homePrior: 1.47,
    awayPrior: 0.92,
    homeRecent: 1.58,
    awayRecent: 1.01,
    recentAgeDays: 31,
    odds: { home: 1.84, draw: 3.4, away: 4.9, over15: 1.41, under15: 2.85, over25: 2.42, under25: 1.56, bttsYes: 2.25, bttsNo: 1.61 },
  },
]

const marketGroups: Record<string, { label: string; markets: Market[] }> = {
  result: { label: 'Match result', markets: ['home', 'draw', 'away'] },
  goals: { label: 'Goal totals', markets: ['over15', 'under15', 'over25', 'under25'] },
  btts: { label: 'Both teams score', markets: ['bttsYes', 'bttsNo'] },
}

const selectionLabels: Record<Market, string> = {
  home: 'Home win',
  draw: 'Draw',
  away: 'Away win',
  over15: 'Over 1.5',
  under15: 'Under 1.5',
  over25: 'Over 2.5',
  under25: 'Under 2.5',
  bttsYes: 'Yes',
  bttsNo: 'No',
}

const marketForSelection: Record<Market, MarketSelection> = {
  home: 'home',
  draw: 'draw',
  away: 'away',
  over15: 'over15',
  under15: 'under15',
  over25: 'over25',
  under25: 'under25',
  bttsYes: 'bttsYes',
  bttsNo: 'bttsNo',
}

function formatProbability(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function getRate(prior: number, recent: number, ageDays: number, halfLifeDays: number) {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays < MIN_HALF_LIFE_DAYS || halfLifeDays > MAX_HALF_LIFE_DAYS) {
    throw new RangeError(`Half-life must be between ${MIN_HALF_LIFE_DAYS} and ${MAX_HALF_LIFE_DAYS} days.`)
  }
  if (![prior, recent, ageDays].every(Number.isFinite) || prior < 0 || recent < 0 || ageDays < 0 || prior > MAX_GOAL_RATE || recent > MAX_GOAL_RATE) {
    throw new RangeError(`Goal rates must be between 0 and ${MAX_GOAL_RATE}; age must be non-negative.`)
  }
  const recentWeight = 0.5 ** (ageDays / halfLifeDays)
  return prior * (1 - recentWeight) + recent * recentWeight
}

function sanitizeBetText(value: string) {
  return Array.from(value.slice(0, MAX_PASTED_TEXT_LENGTH * 2))
    .filter((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined &&
        !((codePoint <= 0x08) || (codePoint >= 0x0b && codePoint <= 0x1f) ||
          (codePoint >= 0x7f && codePoint <= 0x9f) || (codePoint >= 0x202a && codePoint <= 0x202e) ||
          (codePoint >= 0x2066 && codePoint <= 0x2069))
    })
    .join('')
    .slice(0, MAX_PASTED_TEXT_LENGTH)
}

function sanitizePlainText(value: string, maxLength: number) {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined &&
        !((codePoint <= 0x1f) || (codePoint >= 0x7f && codePoint <= 0x9f) ||
          (codePoint >= 0x202a && codePoint <= 0x202e) || (codePoint >= 0x2066 && codePoint <= 0x2069))
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function sanitizeFileName(value: string) {
  const basename = value.slice(0, 512).split(/[\\/]/).pop() ?? ''
  const safeName = basename
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._() -]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 100)
  return safeName || 'screenshot'
}

async function hasSupportedImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  }
  if (file.type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (file.type === 'image/webp') {
    return bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  }
  return false
}

function selectionProbability(probabilities: MarketProbabilities, market: Market) {
  return probabilities[marketForSelection[market]]
}

const AUTH_STORAGE_KEY = 'reality-simulator:unlocked'

function getStoredAuthentication() {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function PasscodeLock({ onUnlock }: { onUnlock: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [message, setMessage] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isChecking) return
    setIsChecking(true)
    setMessage('')
    try {
      if (!await verifyPasscode(passcode)) {
        setMessage('Incorrect passcode')
        setPasscode('')
        return
      }
      try {
        window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
      } catch {
        setMessage('Could not save this device session. Check browser storage settings and try again.')
        return
      }
      onUnlock()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Passcode verification failed.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <main className="lock-screen">
      <section className="lock-panel" aria-labelledby="lock-heading">
        <p className="lock-eyebrow">Reality Simulator · Private Workbench</p>
        <div className="lock-rule" />
        <h1 id="lock-heading">A considered pause<br />before the numbers.</h1>
        <p className="lock-description">Enter your passcode to open the modelling workbench.</p>
        <form className="lock-form" onSubmit={handleSubmit}>
          <label htmlFor="workbench-passcode">Passcode</label>
          <input
            id="workbench-passcode"
            type="password"
            value={passcode}
            onChange={(event) => { setPasscode(event.target.value); setMessage('') }}
            autoComplete="current-password"
            autoFocus
            maxLength={64}
            required
            aria-invalid={message === 'Incorrect passcode'}
            aria-describedby={message ? 'passcode-message' : undefined}
          />
          {message && <p className="lock-message" id="passcode-message" role="alert">{message}</p>}
          <button type="submit" disabled={isChecking || passcode.length === 0}>
            {isChecking ? 'Checking…' : 'Unlock workbench'}
          </button>
        </form>
        <p className="lock-footnote">Access is remembered on this device.</p>
      </section>
    </main>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredAuthentication)
  return isAuthenticated
    ? <Workbench />
    : <PasscodeLock onUnlock={() => setIsAuthenticated(true)} />
}

function Workbench() {
  const [halfLifeDays, setHalfLifeDays] = useState(30)
  const [rho, setRho] = useState(-0.05)
  const [fixturePool, setFixturePool] = useState(fixtures)
  const [customDraft, setCustomDraft] = useState<CustomFixtureDraft>(emptyCustomFixture)
  const [customRatePreset, setCustomRatePreset] = useState('balanced')
  const [customFormOpen, setCustomFormOpen] = useState(true)
  const [activeGroup, setActiveGroup] = useState<keyof typeof marketGroups>('result')
  const [roundFixtureIds, setRoundFixtureIds] = useState<string[]>([])
  const [roundNumber, setRoundNumber] = useState(0)
  const [roundResults, setRoundResults] = useState<Map<string, { homeGoals: number; awayGoals: number }>>(() => new Map())
  const [betText, setBetText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedScreenshot[]>([])
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const [ocrError, setOcrError] = useState('')
  const [rawScannedText, setRawScannedText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentIdRef = useRef(0)
  const attachedFilesRef = useRef<AttachedScreenshot[]>([])
  const isOcrRunningRef = useRef(false)
  const nextFixtureIdRef = useRef(1)

  const preparedFixtures = useMemo(
    () =>
      fixturePool.map((fixture) => {
        const lambda = getRate(fixture.homePrior, fixture.homeRecent, fixture.recentAgeDays, halfLifeDays)
        const mu = getRate(fixture.awayPrior, fixture.awayRecent, fixture.recentAgeDays, halfLifeDays)
        return {
          ...fixture,
          lambda,
          mu,
          probabilities: calculateProbabilities(lambda, mu, rho),
        }
      }),
    [fixturePool, halfLifeDays, rho],
  )
  const parsedBatch = useMemo(() => parseBatchMatchList(betText), [betText])

  // Fits λ/μ so the Dixon–Coles 1X2 probabilities match the de-margined bookmaker odds.
  function fitGoalRates(odds: number[]) {
    const implied = odds.map((value) => 1 / value)
    const total = implied.reduce((sum, value) => sum + value, 0)
    const target = implied.map((value) => value / total)
    const error = (lambda: number, mu: number) => {
      const p = calculateProbabilities(lambda, mu, rho)
      return (p.home - target[0]) ** 2 + (p.draw - target[1]) ** 2 + (p.away - target[2]) ** 2
    }
    let best = { lambda: OCR_DEFAULT_LAMBDA, mu: OCR_DEFAULT_MU, error: Number.POSITIVE_INFINITY }
    const search = (lambdaFrom: number, lambdaTo: number, muFrom: number, muTo: number, step: number) => {
      for (let lambda = lambdaFrom; lambda <= lambdaTo + 1e-9; lambda += step) {
        for (let mu = muFrom; mu <= muTo + 1e-9; mu += step) {
          const value = error(lambda, mu)
          if (value < best.error) best = { lambda, mu, error: value }
        }
      }
    }
    search(0.3, 3, 0.3, 3, 0.1)
    search(Math.max(0.1, best.lambda - 0.1), best.lambda + 0.1, Math.max(0.1, best.mu - 0.1), best.mu + 0.1, 0.02)
    return { lambda: Number(best.lambda.toFixed(2)), mu: Number(best.mu.toFixed(2)) }
  }

  function loadPastedMatches() {
    if (parsedBatch.length === 0) {
      setStatus('No matches were recognized in the pasted text.')
      return
    }
    const withRates = parsedBatch.map((parsed) => parsed.defaultedOdds === 0 && parsed.lambda === undefined && parsed.mu === undefined
      ? { ...parsed, ...fitGoalRates(parsed.odds) }
      : parsed)
    const result = addParsedFixtures(withRates)
    const existingIds = withRates.flatMap(({ home, away }) => {
      const match = fixturePool.find((fixture) => fixture.home.toLocaleLowerCase() === home.toLocaleLowerCase() && fixture.away.toLocaleLowerCase() === away.toLocaleLowerCase())
      return match ? [match.id] : []
    })
    if (existingIds.length > 0) setRoundFixtureIds((current) => [...current, ...existingIds.filter((id) => !current.includes(id))])
    const total = result.added + existingIds.length
    const notes = [`${total} match${total === 1 ? '' : 'es'} loaded into the board and round lineup`]
    if (result.omitted > 0) notes.push(`${result.omitted} skipped because the fixture pool is full`)
    setStatus(`${notes.join('; ')}. Click Generate Round Results to simulate.`)
  }

  function toggleRoundFixture(fixtureId: string) {
    const fixture = preparedFixtures.find((item) => item.id === fixtureId)
    if (!fixture) return
    if (roundFixtureIds.includes(fixtureId)) {
      setRoundFixtureIds((current) => current.filter((id) => id !== fixtureId))
      setRoundResults((results) => {
        const next = new Map(results)
        next.delete(fixtureId)
        return next
      })
      setStatus(`${fixture.home} v ${fixture.away} removed from the round lineup.`)
      return
    }
    setRoundFixtureIds((current) => [...current, fixtureId])
    setStatus(`${fixture.home} v ${fixture.away} added to the round lineup.`)
  }

  function generateRoundResults() {
    const selected = roundFixtureIds
      .map((id) => preparedFixtures.find((fixture) => fixture.id === id))
      .filter((fixture): fixture is (typeof preparedFixtures)[number] => fixture !== undefined)
    if (selected.length === 0) {
      setStatus('Add at least one match to the round lineup before generating results.')
      return
    }
    const results = new Map<string, { homeGoals: number; awayGoals: number }>()
    selected.forEach((fixture) => {
      const score = sampleScoreline(fixture.lambda, fixture.mu, rho)
      results.set(fixture.id, { homeGoals: score.homeGoals, awayGoals: score.awayGoals })
    })
    setRoundResults(results)
    setRoundNumber((current) => current + 1)
    setStatus(`Round ${roundNumber + 1} generated for ${selected.length} match${selected.length === 1 ? '' : 'es'}.`)
  }

  async function copyRoundOutcomes() {
    if (roundNumber === 0 || roundFixtureIds.length === 0 || roundResults.size !== roundFixtureIds.length) {
      setStatus('Generate a round before copying its outcomes.')
      return
    }
    const lines = roundFixtureIds.flatMap((id) => {
      const fixture = preparedFixtures.find((item) => item.id === id)
      const result = roundResults.get(id)
      if (!fixture || !result) return []
      const totalGoals = result.homeGoals + result.awayGoals
      const outcome = result.homeGoals > result.awayGoals
        ? 'Home Win'
        : result.homeGoals === result.awayGoals ? 'Draw' : 'Away Win'
      const totals = (line: number) => totalGoals > line ? `Over ${line}.5` : `Under ${line}.5`
      const bothScored = result.homeGoals > 0 && result.awayGoals > 0 ? 'GG' : 'NG'
      return [`${fixture.home} vs ${fixture.away} | ${result.homeGoals} - ${result.awayGoals} | ${outcome} | ${totals(1)} | ${totals(2)} | ${bothScored}`]
    })
    try {
      await navigator.clipboard.writeText([`Round ${roundNumber}`, ...lines].join('\n'))
      setStatus(`Round ${roundNumber} outcomes copied.`)
    } catch (error) {
      setStatus(`Could not copy round outcomes: ${error instanceof Error ? error.message : 'clipboard unavailable'}`)
    }
  }

  function addParsedFixtures(parsedFixtures: ParsedBetslipFixture[]) {
    const existing = new Set(fixturePool.map((fixture) => `${fixture.home.toLocaleLowerCase()}\u0000${fixture.away.toLocaleLowerCase()}`))
    const unique = parsedFixtures.filter(({ home, away }) => {
      const key = `${home.toLocaleLowerCase()}\u0000${away.toLocaleLowerCase()}`
      if (existing.has(key)) return false
      existing.add(key)
      return true
    })
    const capacity = Math.max(0, MAX_FIXTURE_POOL_SIZE - fixturePool.length)
    let defaultRateFixtures = 0
    const fixturesToAdd = unique.slice(0, capacity).map((parsed) => {
      const lambda = parsed.lambda ?? OCR_DEFAULT_LAMBDA
      const mu = parsed.mu ?? OCR_DEFAULT_MU
      if (parsed.lambda === undefined || parsed.mu === undefined) defaultRateFixtures += 1
      const probabilities = calculateProbabilities(lambda, mu, rho)
      const fallbackOdds: Record<Market, number> = {
        ...DEFAULT_CUSTOM_ODDS,
        home: Math.min(1000, 1 / probabilities.home),
        draw: Math.min(1000, 1 / probabilities.draw),
        away: Math.min(1000, 1 / probabilities.away),
      }
      for (const [index, market] of (['home', 'draw', 'away'] as const).entries()) {
        const parsedOdds = parsed.marketOdds[market] ?? parsed.odds[index]
        if (parsedOdds !== undefined) fallbackOdds[market] = parsedOdds
      }
      for (const market of ['over15', 'under15', 'over25', 'under25', 'bttsYes', 'bttsNo'] as const) {
        const parsedOdds = parsed.marketOdds[market]
        if (parsedOdds !== undefined) fallbackOdds[market] = parsedOdds
      }
      const id = `ocr-${nextFixtureIdRef.current}`
      nextFixtureIdRef.current += 1
      return {
        id,
        competition: 'Scanned betslip',
        kickoff: sanitizePlainText(parsed.kickoff, MAX_CUSTOM_KICKOFF_LENGTH) || 'Kickoff TBD',
        home: sanitizePlainText(parsed.home, MAX_CUSTOM_TEAM_NAME_LENGTH),
        away: sanitizePlainText(parsed.away, MAX_CUSTOM_TEAM_NAME_LENGTH),
        homePrior: lambda,
        awayPrior: mu,
        homeRecent: lambda,
        awayRecent: mu,
        recentAgeDays: 0,
        odds: fallbackOdds,
      } satisfies Fixture
    }).filter((fixture) => fixture.home && fixture.away && fixture.home !== fixture.away)

    if (fixturesToAdd.length === 0) {
      return { added: 0, duplicates: unique.length === 0 ? parsedFixtures.length : 0, omitted: unique.length, defaultRateFixtures: 0 }
    }

    setFixturePool((current) => [...current, ...fixturesToAdd])
    setRoundFixtureIds((current) => [...current, ...fixturesToAdd.map((fixture) => fixture.id)])
    return {
      added: fixturesToAdd.length,
      duplicates: parsedFixtures.length - unique.length,
      omitted: unique.length - fixturesToAdd.length,
      defaultRateFixtures,
    }
  }

  function updateAttachmentStatus(id: number, ocrStatus: string) {
    setAttachedFiles((current) => {
      const next = current.map((file) => file.id === id ? { ...file, ocrStatus } : file)
      attachedFilesRef.current = next
      return next
    })
  }

  function errorDetails(error: unknown) {
    if (error instanceof Error && error.message) return sanitizePlainText(error.message, 400)
    if (typeof error === 'string' && error.trim() && error !== 'undefined' && error !== '[object Event]') {
      return sanitizePlainText(error, 400)
    }
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
      return sanitizePlainText(error.message, 400)
    }
    return 'OCR worker could not load. Check the deployed /ocr assets and Content-Security-Policy.'
  }

  async function addFiles(fileList: FileList | File[]) {
    if (isOcrRunningRef.current) {
      setStatus('Wait for the current screenshot scan to finish before adding more images.')
      return
    }
    isOcrRunningRef.current = true
    const files = Array.from(fileList)
    const verified: VerifiedScreenshot[] = []
    let rejected = 0
    let inspectionErrors = 0
    try {
      for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
          rejected += 1
          continue
        }
        try {
          if (!await hasSupportedImageSignature(file)) {
            rejected += 1
            continue
          }
        } catch {
          inspectionErrors += 1
          continue
        }
        attachmentIdRef.current += 1
        verified.push({
          file,
          attachment: {
            id: attachmentIdRef.current,
            name: sanitizeFileName(file.name),
            size: file.size,
            ocrStatus: 'Initializing OCR...',
          },
        })
      }
      const available = Math.max(0, MAX_SCREENSHOTS - attachedFilesRef.current.length)
      const accepted = verified.slice(0, available)
      const capped = verified.length - accepted.length
      attachedFilesRef.current = [...attachedFilesRef.current, ...accepted.map(({ attachment }) => attachment)]
      setAttachedFiles(attachedFilesRef.current)
      const messages: string[] = []
      if (accepted.length > 0) messages.push(`${accepted.length} verified screenshot${accepted.length === 1 ? '' : 's'} attached`)
      if (rejected > 0) messages.push(`${rejected} file${rejected === 1 ? '' : 's'} rejected (PNG, JPEG or WebP up to 10 MB only)`)
      if (capped > 0) messages.push(`maximum ${MAX_SCREENSHOTS} screenshots allowed`)
      if (inspectionErrors > 0) messages.push(`${inspectionErrors} file${inspectionErrors === 1 ? '' : 's'} could not be inspected`)
      if (messages.length > 0) setStatus(messages.join('. ') + '.')
      if (accepted.length === 0) return

      const parsedFixtures: ParsedBetslipFixture[] = []
      const scanErrors: string[] = []
      let cleanupError = false
      let workerFailureReason: unknown
      let currentFileName = accepted[0].attachment.name
      let currentAttachmentId = accepted[0].attachment.id
      setOcrError('')
      setRawScannedText('')
      setOcrProgress({ attachmentId: currentAttachmentId, fileName: currentFileName, percent: 0, stage: 'Initializing OCR...' })
      let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null
      try {
        ocrWorker = await createWorker('eng', 1, {
          workerPath: new URL('ocr/worker.min.js', new URL(import.meta.env.BASE_URL, window.location.href)).href,
          corePath: new URL('ocr/core/tesseract-core-lstm.wasm.js', new URL(import.meta.env.BASE_URL, window.location.href)).href,
          langPath: new URL('ocr/lang/', new URL(import.meta.env.BASE_URL, window.location.href)).href,
          gzip: true,
          workerBlobURL: false,
          errorHandler: (error: unknown) => { workerFailureReason = error },
          logger: ({ status: stage, progress }) => {
            const recognizing = stage.toLocaleLowerCase().includes('recognizing')
            const percent = recognizing ? Math.round(Math.max(0, Math.min(1, progress)) * 100) : 0
            const visibleStage = recognizing ? `Scanning ${percent}%...` : `${stage.charAt(0).toUpperCase()}${stage.slice(1)}...`
            setOcrProgress((current) => ({
              attachmentId: currentAttachmentId,
              fileName: currentFileName,
              percent: recognizing && current?.fileName === currentFileName
                ? Math.max(current.percent, percent)
                : percent,
              stage: visibleStage,
            }))
            updateAttachmentStatus(currentAttachmentId, visibleStage)
          },
        })
        for (const item of accepted) {
          currentFileName = item.attachment.name
          currentAttachmentId = item.attachment.id
          setOcrProgress({ attachmentId: currentAttachmentId, fileName: currentFileName, percent: 0, stage: 'Scanning 0%...' })
          updateAttachmentStatus(currentAttachmentId, 'Scanning 0%...')
          try {
            const { data } = await ocrWorker.recognize(item.file)
            setOcrProgress({ attachmentId: currentAttachmentId, fileName: currentFileName, percent: 100, stage: 'Parsing lines...' })
            updateAttachmentStatus(currentAttachmentId, 'Parsing lines...')
            setRawScannedText((current) => {
              const section = `--- ${item.attachment.name} ---\n${sanitizeBetText(data.text)}`
              return [current, section].filter(Boolean).join('\n\n').slice(-MAX_OCR_TEXT_LENGTH)
            })
            const parsed = parseBetslipText(data.text)
            parsedFixtures.push(...parsed)
            updateAttachmentStatus(currentAttachmentId, `Extracted ${parsed.length} match${parsed.length === 1 ? '' : 'es'}`)
          } catch (error) {
            const details = errorDetails(error ?? workerFailureReason)
            scanErrors.push(`${item.attachment.name}: ${details}`)
            updateAttachmentStatus(currentAttachmentId, `OCR error: ${details}`)
          }
        }
      } catch (error) {
        const details = errorDetails(error)
        scanErrors.push(details)
        accepted.forEach(({ attachment }) => updateAttachmentStatus(attachment.id, `OCR error: ${details}`))
        setOcrError(details)
      } finally {
        if (ocrWorker) {
          try {
            await ocrWorker.terminate()
          } catch {
            cleanupError = true
          }
        }
        setOcrProgress(null)
        isOcrRunningRef.current = false
      }

      const result = addParsedFixtures(parsedFixtures)
      const summary: string[] = []
      if (result.added > 0) summary.push(`${result.added} fixture${result.added === 1 ? '' : 's'} added to the board`)
      if (result.duplicates > 0) summary.push(`${result.duplicates} duplicate fixture${result.duplicates === 1 ? '' : 's'} skipped`)
      if (result.omitted > 0) summary.push(`${result.omitted} fixture${result.omitted === 1 ? '' : 's'} could not be added because the fixture pool is full`)
      if (parsedFixtures.length === 0 && scanErrors.length === 0) summary.push('No matchups were recognized')
      if (scanErrors.length > 0) summary.push(`${scanErrors.length} screenshot${scanErrors.length === 1 ? '' : 's'} could not be scanned`)
      if (cleanupError) summary.push('OCR worker cleanup failed')
      if (summary.length === 0) summary.push('No new fixtures were found')
      const defaultsNote = result.defaultRateFixtures > 0
        ? ` Goal rates defaulted to λ ${OCR_DEFAULT_LAMBDA.toFixed(2)} / μ ${OCR_DEFAULT_MU.toFixed(2)} for ${result.defaultRateFixtures} fixture${result.defaultRateFixtures === 1 ? '' : 's'}.`
        : ''
      if (scanErrors.length > 0) setOcrError(scanErrors.join('\n'))
      setStatus(`OCR complete: ${summary.join('; ')}.${defaultsNote}`)
    } finally {
      isOcrRunningRef.current = false
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = event.clipboardData.files
    if (files.length > 0) addFiles(files)
  }

  function removeAttachment(id: number) {
    attachedFilesRef.current = attachedFilesRef.current.filter((file) => file.id !== id)
    setAttachedFiles(attachedFilesRef.current)
  }

  function updateCustomField(field: keyof CustomFixtureDraft, value: string) {
    setCustomDraft((current) => ({ ...current, [field]: value.slice(0, field === 'home' || field === 'away' ? 200 : 100) }))
    if (field === 'lambda' || field === 'mu') setCustomRatePreset('custom')
  }

  function applyCustomRatePreset(value: string) {
    setCustomRatePreset(value)
    if (value === 'balanced') setCustomDraft((current) => ({ ...current, lambda: '1.65', mu: '1.15' }))
    if (value === 'home-favourite') setCustomDraft((current) => ({ ...current, lambda: '2.00', mu: '0.80' }))
    if (value === 'even-match') setCustomDraft((current) => ({ ...current, lambda: '1.35', mu: '1.35' }))
  }

  function addCustomFixture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fixturePool.length >= MAX_FIXTURE_POOL_SIZE) {
      setStatus(`The fixture pool is limited to ${MAX_FIXTURE_POOL_SIZE} matches.`)
      return
    }
    const home = sanitizePlainText(customDraft.home, MAX_CUSTOM_TEAM_NAME_LENGTH)
    const away = sanitizePlainText(customDraft.away, MAX_CUSTOM_TEAM_NAME_LENGTH)
    const kickoff = sanitizePlainText(customDraft.kickoff, MAX_CUSTOM_KICKOFF_LENGTH) || 'Kickoff TBD'
    const parseDecimal = (value: string) => {
      const normalized = value.trim()
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return Number.NaN
      return Number(normalized)
    }
    const lambda = parseDecimal(customDraft.lambda)
    const mu = parseDecimal(customDraft.mu)
    const homeOdds = parseDecimal(customDraft.homeOdds)
    const drawOdds = parseDecimal(customDraft.drawOdds)
    const awayOdds = parseDecimal(customDraft.awayOdds)
    if (!home || !away) {
      setStatus('Enter valid home and away team names (up to 80 characters each).')
      return
    }
    if (home === away) {
      setStatus('Home and away team names must be different.')
      return
    }
    if (![lambda, mu].every((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 2.5)) {
      setStatus('Expected goal rates must be decimal numbers between 0 and 2.5.')
      return
    }
    if (![homeOdds, drawOdds, awayOdds].every((odds) => Number.isFinite(odds) && odds >= 1 && odds <= 1000)) {
      setStatus('Home, draw and away decimal odds must each be between 1 and 1000.')
      return
    }
    const probabilities = calculateProbabilities(lambda, mu, rho)
    const odds: Record<Market, number> = {
      ...DEFAULT_CUSTOM_ODDS,
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds,
    }
    for (const market of ['over15', 'under15', 'over25', 'under25', 'bttsYes', 'bttsNo'] as const) {
      if (odds[market] < 1 || !Number.isFinite(probabilities[market])) {
        setStatus('The entered goal rates could not produce valid model probabilities.')
        return
      }
    }
    const id = `custom-${nextFixtureIdRef.current}`
    nextFixtureIdRef.current += 1
    setFixturePool((current) => [...current, {
      id,
      competition: 'Custom fixture',
      kickoff,
      home,
      away,
      homePrior: lambda,
      awayPrior: mu,
      homeRecent: lambda,
      awayRecent: mu,
      recentAgeDays: 0,
      odds,
    }])
    setCustomDraft(emptyCustomFixture)
    setCustomRatePreset('balanced')
    setRoundFixtureIds((current) => [...current, id])
    setStatus(`${home} v ${away} added to the fixture board and round lineup.`)
  }

  function renderMarkets(fixture: (typeof preparedFixtures)[number]) {
    return marketGroups[activeGroup].markets.map((market) => {
      const probability = selectionProbability(fixture.probabilities, market)
      const ev = expectedValue(probability, fixture.odds[market])
      return (
        <div className="market-option" key={market}>
          <span className="market-option__name">{selectionLabels[market]}</span>
          <span className="market-option__probability">{formatProbability(probability)}</span>
          <span className="market-option__odds">{fixture.odds[market].toFixed(2)}</span>
          <span className={`market-option__ev${ev > 0 ? ' is-positive' : ''}`}>EV {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%</span>
        </div>
      )
    })
  }

  return (
    <main className="workbench">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Reality Simulator home">
          <span className="wordmark__mark">RS</span>
          <span>Reality Simulator</span>
        </a>
        <div className="topbar__title">— Dixon–Coles Round Outcome Workbench</div>
        <nav className="topbar__nav" aria-label="Main navigation">
          <a className="nav-link is-active" href="#fixtures">Workbench</a>
          <a className="nav-link" href="#method">Method</a>
          <span className="live-indicator"><span />Model ready</span>
        </nav>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">Football simulation / Research desk 01</p>
          <h1>Simulate the match.<br /><em>Generate the round.</em></h1>
        </div>
        <div className="intro__aside">
          <p>Generate consecutive match outcomes from expected goals and low-score dependence.</p>
          <a href="#method" className="text-link">How the model works <ArrowDownToLine size={14} /></a>
        </div>
      </section>

      <section className="calibration" aria-labelledby="calibration-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / Model inputs</p>
            <h2 id="calibration-heading">Calibration</h2>
          </div>
          <span className="section-note"><Activity size={14} /> Live recalculation</span>
        </div>
        <div className="calibration__controls">
          <label className="control">
            <span className="control__top"><span>Half-life decay</span><strong>{halfLifeDays} days</strong></span>
            <input type="range" min={MIN_HALF_LIFE_DAYS} max={MAX_HALF_LIFE_DAYS} step="1" value={halfLifeDays} onChange={(event) => setHalfLifeDays(Number(event.target.value))} />
            <span className="control__caption">Recent-form signal fades against team priors over time.</span>
          </label>
          <label className="control">
            <span className="control__top"><span>Dixon–Coles ρ correction</span><strong>{rho.toFixed(2)}</strong></span>
            <input type="range" min={MIN_DIXON_COLES_RHO} max={MAX_DIXON_COLES_RHO} step="0.01" value={rho} onChange={(event) => setRho(Number(event.target.value))} />
            <span className="control__caption">Reweights 0–0, 0–1, 1–0 and 1–1 scorelines.</span>
          </label>
        </div>
      </section>

      <div className="main-grid">
        <div className="fixture-column">
          <section className="custom-match-section" aria-labelledby="custom-match-heading">
            <div className="section-heading custom-match-heading">
              <div>
                <p className="eyebrow">02 / Add to match pool</p>
                <h2 id="custom-match-heading">Custom match</h2>
              </div>
              <button className="quiet-button" type="button" aria-expanded={customFormOpen} onClick={() => setCustomFormOpen((open) => !open)}>
                <Plus size={14} /> {customFormOpen ? 'Hide form' : 'Add custom match'}
              </button>
            </div>
            {customFormOpen && (
              <form className="custom-match-form" onSubmit={addCustomFixture}>
                <div className="custom-match-fields">
                  <label className="form-field">
                    <span>Home team</span>
                    <input type="text" autoComplete="off" maxLength={MAX_CUSTOM_TEAM_NAME_LENGTH} value={customDraft.home} onChange={(event) => updateCustomField('home', event.target.value)} placeholder="e.g. Northbridge FC" required />
                  </label>
                  <label className="form-field">
                    <span>Away team</span>
                    <input type="text" autoComplete="off" maxLength={MAX_CUSTOM_TEAM_NAME_LENGTH} value={customDraft.away} onChange={(event) => updateCustomField('away', event.target.value)} placeholder="e.g. Riverside United" required />
                  </label>
                  <label className="form-field">
                    <span>Kickoff</span>
                    <input type="text" autoComplete="off" maxLength={MAX_CUSTOM_KICKOFF_LENGTH} value={customDraft.kickoff} onChange={(event) => updateCustomField('kickoff', event.target.value)} placeholder="Tomorrow, 15:00" />
                  </label>
                  <label className="form-field">
                    <span>Expected home goals (λ)</span>
                    <input type="number" inputMode="decimal" min="0" max="2.5" step="0.01" value={customDraft.lambda} onChange={(event) => updateCustomField('lambda', event.target.value)} required />
                  </label>
                  <label className="form-field">
                    <span>Expected away goals (μ)</span>
                    <input type="number" inputMode="decimal" min="0" max="2.5" step="0.01" value={customDraft.mu} onChange={(event) => updateCustomField('mu', event.target.value)} required />
                  </label>
                  <label className="form-field">
                    <span>Goal-rate preset</span>
                    <select value={customRatePreset} onChange={(event) => applyCustomRatePreset(event.target.value)}>
                      <option value="balanced">Balanced · 1.65 / 1.15</option>
                      <option value="home-favourite">Home favourite · 2.00 / 0.80</option>
                      <option value="even-match">Even match · 1.35 / 1.35</option>
                      <option value="custom">Manual rates</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Bookmaker odds · Home</span>
                    <input type="number" inputMode="decimal" min="1" max="1000" step="0.01" value={customDraft.homeOdds} onChange={(event) => updateCustomField('homeOdds', event.target.value)} placeholder="2.10" required />
                  </label>
                  <label className="form-field">
                    <span>Bookmaker odds · Draw</span>
                    <input type="number" inputMode="decimal" min="1" max="1000" step="0.01" value={customDraft.drawOdds} onChange={(event) => updateCustomField('drawOdds', event.target.value)} placeholder="3.40" required />
                  </label>
                  <label className="form-field">
                    <span>Bookmaker odds · Away</span>
                    <input type="number" inputMode="decimal" min="1" max="1000" step="0.01" value={customDraft.awayOdds} onChange={(event) => updateCustomField('awayOdds', event.target.value)} placeholder="3.60" required />
                  </label>
                </div>
                <div className="custom-match-footer">
                  <button className="run-button custom-match-submit" type="submit"><Plus size={15} /> Add match to board</button>
                  <p>Rates capped at 2.50 to keep Dixon–Coles corrections valid across the full ρ range. Other market prices use illustrative defaults.</p>
                </div>
              </form>
            )}
          </section>

          <section className="fixture-section" id="fixtures" aria-labelledby="fixture-heading">
          <div className="section-heading section-heading--fixture">
            <div>
              <p className="eyebrow">03 / Upcoming markets</p>
              <h2 id="fixture-heading">Fixture board</h2>
            </div>
            <button className="quiet-button" type="button" onClick={() => { setStatus('Fixture probabilities refreshed from the current calibration inputs.') }}>
              <RefreshCw size={14} /> Recalculate
            </button>
          </div>
          <div className="market-tabs" role="tablist" aria-label="Fixture market">
            {(Object.keys(marketGroups) as Array<keyof typeof marketGroups>).map((group) => (
              <button className={`market-tab${activeGroup === group ? ' is-active' : ''}`} key={group} type="button" role="tab" aria-selected={activeGroup === group} onClick={() => setActiveGroup(group)}>
                {marketGroups[group].label}
              </button>
            ))}
          </div>
          <div className="fixture-list">
            {preparedFixtures.map((fixture) => (
              <article className="fixture" key={fixture.id}>
                <div className="fixture__meta">
                  <span>{fixture.competition}</span>
                  <time>{fixture.kickoff}</time>
                </div>
                <div className="fixture__teams">
                  <div className="team-pair">
                    <span>{fixture.home}</span><span className="versus">v</span><span>{fixture.away}</span>
                  </div>
                  <div className="expected-goals">
                    <span><b>λ</b> {fixture.lambda.toFixed(2)}</span>
                    <span><b>μ</b> {fixture.mu.toFixed(2)}</span>
                  </div>
                </div>
                <div className="fixture__pool-controls">
                  <button
                    className={`quiet-button round-fixture-toggle${roundFixtureIds.includes(fixture.id) ? ' is-added' : ''}`}
                    type="button"
                    aria-pressed={roundFixtureIds.includes(fixture.id)}
                    onClick={() => toggleRoundFixture(fixture.id)}
                  >
                    {roundFixtureIds.includes(fixture.id) ? 'Added to round' : 'Add to round'}
                  </button>
                </div>
                <div className={`fixture__markets fixture__markets--${activeGroup}`}>
                  {renderMarkets(fixture)}
                </div>
              </article>
            ))}
          </div>
          <p className="data-note"><CircleHelp size={13} /> Add any listed match to the round lineup. Fixture odds are illustrative, not live prices or betting advice.</p>
          </section>
        </div>

        <aside className="side-column">
          <section className="intake-section" aria-labelledby="intake-heading">
            <div className="side-heading">
              <div><p className="eyebrow">04 / Optional input</p><h2 id="intake-heading">Betslip intake</h2></div>
              <Clipboard size={17} />
            </div>
            <div
              className={`dropzone${isDragging ? ' is-dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click() }}
              role="button"
              tabIndex={0}
              aria-label="Upload betslip screenshot"
            >
              <Upload size={18} />
              <span>Drop a screenshot or <b>browse files</b></span>
              <small>PNG, JPG or WEBP · OCR runs locally in your browser</small>
              <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = '' }} />
            </div>
            {ocrProgress && (
              <div className="ocr-progress" role="status" aria-live="polite">
                <div className="ocr-progress__label"><span>{ocrProgress.stage}</span><span>{ocrProgress.fileName}</span></div>
                <progress value={ocrProgress.percent} max={100} aria-label={`Scanning ${ocrProgress.fileName}`} />
              </div>
            )}
            {ocrError && <div className="ocr-error" role="alert">OCR error: {ocrError}</div>}
            <details className="raw-scan">
              <summary>Raw Scanned Text</summary>
              <pre>{rawScannedText || 'Scanned text will appear here after an image is processed.'}</pre>
            </details>
            {attachedFiles.length > 0 && (
              <ul className="attachment-list" aria-label="Attached screenshots">
                {attachedFiles.map((file) => <li key={file.id} title={`${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`}><FileImage size={14} /><span className="attachment-name">{file.name}</span><span className={`attachment-status${file.ocrStatus.startsWith('OCR error:') ? ' is-error' : ''}`}>{file.ocrStatus}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(file.id)}><Trash2 size={13} /></button></li>)}
              </ul>
            )}
            <label className="paste-label" htmlFor="bet-text">Paste selections or notes</label>
            <textarea id="bet-text" value={betText} maxLength={MAX_PASTED_TEXT_LENGTH} onChange={(event) => setBetText(sanitizeBetText(event.target.value))} onPaste={handlePaste}             placeholder={'1. Arsenal vs Chelsea\nTime: 11:00 AM\n1: 2.30 | X: 3.60 | 2: 2.95\n\nReal Madrid | Barcelona | 2.10 | 3.40 | 3.20'} rows={6} />
                        {betText.trim() && (
                          <p className={`parse-badge${parsedBatch.length === 0 ? ' is-empty' : ''}`} role="status" aria-live="polite">
                            {parsedBatch.length > 0
                              ? `Parsed ${parsedBatch.length} match${parsedBatch.length === 1 ? '' : 'es'} successfully${parsedBatch.some((item) => item.defaultedOdds > 0) ? ' · missing odds set to 2.50' : ''}`
                              : 'No matches recognized yet'}
                          </p>
                        )}
                        <button className="run-button" type="button" onClick={loadPastedMatches} disabled={parsedBatch.length === 0}>
                          <span>Load Pasted Matches into Board</span><Clipboard size={14} />
                        </button>
                        <p className="intake-note">Paste numbered fixtures, CSV / tab / pipe rows or a SportyBet betslip. Matches are added to the fixture board and round lineup.</p>
          </section>

          <section className="slip-section" aria-labelledby="slip-heading">
            <div className="side-heading side-heading--slip">
                <div><p className="eyebrow">05 / Round generator</p><h2 id="slip-heading">Round outcomes <span className="count-badge">{roundFixtureIds.length}</span></h2></div>
                {roundFixtureIds.length > 0 && <button className="icon-button" type="button" onClick={() => { setRoundFixtureIds([]); setRoundResults(new Map()) }} aria-label="Clear round lineup"><Trash2 size={15} /></button>}
            </div>
              <section className="round-generator" aria-label="Round outcome generator">
                <div className="round-generator__heading">
                  <div>
                    <p className="eyebrow">Current round</p>
                    <h3>{roundNumber > 0 ? `Round ${roundNumber}` : 'No round generated'}</h3>
                  </div>
                  <span className="section-note">{roundFixtureIds.length} match{roundFixtureIds.length === 1 ? '' : 'es'} locked in</span>
                </div>
                {roundFixtureIds.length === 0 ? (
                  <div className="empty-slip"><p>Add matches from the fixture board or scan a betslip to build your round lineup.</p></div>
                ) : (
                  <div className="round-fixtures" aria-live="polite">
                    {roundFixtureIds.map((fixtureId) => {
                      const fixture = preparedFixtures.find((item) => item.id === fixtureId)
                      if (!fixture) return null
                      const result = roundResults.get(fixtureId)
                      const totalGoals = result ? result.homeGoals + result.awayGoals : null
                      const resultLabel = result
                        ? result.homeGoals > result.awayGoals ? 'Home Win' : result.homeGoals === result.awayGoals ? 'Draw' : 'Away Win'
                        : 'Pending'
                      const overUnder = (line: number) => totalGoals !== null
                        ? totalGoals > line ? `Over ${line}.5` : `Under ${line}.5`
                        : 'Pending'
                      const bothScored = result
                        ? result.homeGoals > 0 && result.awayGoals > 0 ? 'GG' : 'NG'
                        : 'Pending'
                      return (
                        <article className="round-fixture" key={fixture.id}>
                          <div className="round-fixture__head">
                            <strong>{fixture.home} vs {fixture.away}</strong>
                            <button className="icon-button" type="button" onClick={() => toggleRoundFixture(fixture.id)} aria-label={`Remove ${fixture.home} versus ${fixture.away} from round lineup`}><Trash2 size={13} /></button>
                          </div>
                          <div className="round-fixture__score" aria-label={result ? `Simulated final score ${result.homeGoals} to ${result.awayGoals}` : 'Score pending'}>
                            {result ? `${result.homeGoals} - ${result.awayGoals}` : '— - —'}
                          </div>
                          <div className="round-fixture__outcomes">
                            <p><span>1X2</span><strong>{resultLabel}</strong></p>
                            <p><span>Goals</span><strong>{overUnder(1)} · {overUnder(2)}</strong></p>
                            <p><span>Both score</span><strong>{bothScored}</strong></p>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
                <div className="round-generator__actions">
                  <button className="run-button" type="button" onClick={generateRoundResults} disabled={roundFixtureIds.length === 0}>
                    <RefreshCw size={14} /> Generate Round Results
                  </button>
                  <button className="quiet-button" type="button" onClick={() => void copyRoundOutcomes()} disabled={roundNumber === 0 || roundResults.size !== roundFixtureIds.length || roundFixtureIds.length === 0}>
                    <Copy size={13} /> Copy Round Outcomes
                  </button>
                </div>
              </section>
          </section>
        </aside>
      </div>

      <section className="method-section" id="method">
        <div><p className="eyebrow">07 / Method note</p><h2>From rates to<br /><em>realized outcomes.</em></h2></div>
        <div className="method-copy">
          <p>Independent Poisson goal rates form the score matrix. Dixon–Coles τ corrections adjust the four low-scoring outcomes, then the normalized matrix yields 1X2, totals and BTTS probabilities.</p>
          <p>Each round draws one independent scoreline per selected fixture from its corrected Dixon–Coles matrix. The fixture lineup remains fixed between rounds so consecutive simulated outcomes can be generated and copied.</p>
          <p>Half-life blends illustrative recent-form rates against team priors. All fixture inputs and prices in this prototype are examples, not a live data feed.</p>
        </div>
      </section>
      <footer className="page-footer"><span>Reality Simulator</span><span>Research prototype · Model outputs are estimates</span></footer>
      <div className="sr-only" aria-live="polite">{status}</div>
    </main>
  )
}

export default App
