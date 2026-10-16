// Palette: #FAFAF8, #FFFFFF, #1A1A1A, #666660, #E5E5E0, #C85A32; type: Georgia + Inter/system sans.
// Icons: Lucide outline set, monochrome, 1.5px stroke.
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { createWorker } from 'tesseract.js'
import {
  Activity,
  ArrowDownToLine,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  FileImage,
  Download,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  calculateProbabilities,
  expectedValue,
  MAX_GOAL_RATE,
  MAX_SIMULATION_RUNS,
  MAX_DIXON_COLES_RHO,
  MAX_PICKS_PER_SIMULATION,
  MIN_SIMULATION_RUNS,
  MIN_DIXON_COLES_RHO,
  type FixtureRates,
  type MonteCarloResult,
  type Market,
  type MarketProbabilities,
  type MarketSelection,
  type SimulationPick,
  type SimulationWorkerRequest,
  type SimulationWorkerResponse,
} from './engine/simulation'
import {
  generateSlipPermutations,
  MAX_FOLD_SIZE,
  MAX_GENERATED_SLIPS,
  MAX_PERMUTATION_FIXTURES,
  type GeneratedSlip,
  type PermutationLeg,
} from './engine/permutations'
import { parseBetslipText, type ParsedBetslipFixture } from './engine/betslipParser'
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

type SlipPick = {
  id: string
  fixtureId: string
  fixture: string
  market: Market
  selection: MarketSelection
  probability: number
  odds: number
}

type AttachedScreenshot = {
  id: number
  name: string
  size: number
}

type VerifiedScreenshot = {
  file: File
  attachment: AttachedScreenshot
}

type OcrProgress = {
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

type BookingSlip = GeneratedSlip & { referenceCode: string }

const MIN_HALF_LIFE_DAYS = 7
const MAX_HALF_LIFE_DAYS = 90
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_SCREENSHOTS = 5
const MAX_PASTED_TEXT_LENGTH = 5000
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

function randomToken() {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function csvCell(value: string | number) {
  const normalized = String(value)
  const firstMeaningfulCharacter = normalized.trimStart().charAt(0)
  const safeValue = typeof value === 'string' && ['=', '+', '-', '@'].includes(firstMeaningfulCharacter)
    ? `'${normalized}`
    : normalized
  return `"${safeValue.replace(/"/g, '""')}"`
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

function App() {
  const [halfLifeDays, setHalfLifeDays] = useState(30)
  const [rho, setRho] = useState(-0.05)
  const [runs, setRuns] = useState(25000)
  const [isSimulating, setIsSimulating] = useState(false)
  const [fixturePool, setFixturePool] = useState(fixtures)
  const [customDraft, setCustomDraft] = useState<CustomFixtureDraft>(emptyCustomFixture)
  const [customRatePreset, setCustomRatePreset] = useState('balanced')
  const [customFormOpen, setCustomFormOpen] = useState(true)
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<string[]>([])
  const [selectedMarkets, setSelectedMarkets] = useState<Map<string, Market>>(() => new Map())
  const [targetSlips, setTargetSlips] = useState(10)
  const [foldSize, setFoldSize] = useState(4)
  const [minimumConfidence, setMinimumConfidence] = useState(0.65)
  const [positiveEvOnly, setPositiveEvOnly] = useState(false)
  const [permutations, setPermutations] = useState<GeneratedSlip[]>([])
  const [bookingSlips, setBookingSlips] = useState<BookingSlip[]>([])
  const [isQueueRunning, setIsQueueRunning] = useState(false)
  const [activeGroup, setActiveGroup] = useState<keyof typeof marketGroups>('result')
  const [slip, setSlip] = useState<SlipPick[]>([])
  const [betText, setBetText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedScreenshot[]>([])
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const [simulation, setSimulation] = useState<MonteCarloResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const attachmentIdRef = useRef(0)
  const attachedFilesRef = useRef<AttachedScreenshot[]>([])
  const isOcrRunningRef = useRef(false)
  const nextFixtureIdRef = useRef(1)
  const queueCancelledRef = useRef(false)
  const queueRunIdRef = useRef(0)

  useEffect(() => () => {
    workerRef.current?.terminate()
    queueRunIdRef.current += 1
    queueCancelledRef.current = true
  }, [])

  function cancelSimulation() {
    workerRef.current?.terminate()
    workerRef.current = null
    setIsSimulating(false)
    setSimulation(null)
  }

  function cancelBookingQueue() {
    queueRunIdRef.current += 1
    queueCancelledRef.current = true
    setIsQueueRunning(false)
  }

  function clearGeneratedSlips() {
    cancelBookingQueue()
    setPermutations([])
    setBookingSlips([])
  }

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
  const calibratedSlip = useMemo(
    () =>
      slip.map((pick) => {
        const fixture = preparedFixtures.find((item) => item.id === pick.fixtureId)
        if (!fixture) throw new Error(`No fixture rates found for selected market "${pick.id}".`)
        return {
          ...pick,
          probability: selectionProbability(fixture.probabilities, pick.market),
          odds: fixture.odds[pick.market],
        }
      }),
    [preparedFixtures, slip],
  )

  function addPick(fixtureId: string, market: Market) {
    const fixture = preparedFixtures.find((item) => item.id === fixtureId)
    if (!fixture) return
    const pickId = `${fixtureId}:${market}`
    if (!slip.some((item) => item.id === pickId) && slip.length >= MAX_PICKS_PER_SIMULATION) {
      setStatus(`A simulation can include at most ${MAX_PICKS_PER_SIMULATION} picks.`)
      return
    }
    const pick: SlipPick = {
      id: pickId,
      fixtureId,
      fixture: `${fixture.home} v ${fixture.away}`,
      market,
      selection: marketForSelection[market],
      probability: selectionProbability(fixture.probabilities, market),
      odds: fixture.odds[market],
    }
    cancelSimulation()
    setSlip((current) => {
      const next = current.filter((item) => item.id !== pick.id)
      return [...next, pick]
    })
    setStatus(`${fixture.home} v ${fixture.away} — ${selectionLabels[market]} added to simulation slip.`)
  }

  function updateRuns(value: string) {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric >= MIN_SIMULATION_RUNS && numeric <= MAX_SIMULATION_RUNS) {
      cancelSimulation()
      setRuns(Math.round(numeric))
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
        const parsedOdds = parsed.odds[index]
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

    const availableSelections = Math.max(0, MAX_PERMUTATION_FIXTURES - selectedFixtureIds.length)
    const selectedFixtures = fixturesToAdd.slice(0, availableSelections)
    setFixturePool((current) => [...current, ...fixturesToAdd])
    if (selectedFixtures.length > 0) {
      setSelectedFixtureIds((current) => [...current, ...selectedFixtures.map((fixture) => fixture.id)])
      setSelectedMarkets((current) => {
        const next = new Map(current)
        selectedFixtures.forEach((fixture) => next.set(fixture.id, 'home'))
        return next
      })
    }
    cancelSimulation()
    clearGeneratedSlips()
    return {
      added: fixturesToAdd.length,
      duplicates: parsedFixtures.length - unique.length,
      omitted: unique.length - fixturesToAdd.length + fixturesToAdd.length - selectedFixtures.length,
      defaultRateFixtures,
    }
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
      let scanErrors = 0
      let cleanupError = false
      let currentFileName = accepted[0].attachment.name
      setOcrProgress({ fileName: currentFileName, percent: 0, stage: 'Preparing OCR' })
      let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null
      try {
        ocrWorker = await createWorker('eng', 1, {
          logger: ({ status: stage, progress }) => {
            const recognizing = stage.toLocaleLowerCase().includes('recognizing')
            const percent = recognizing ? Math.round(Math.max(0, Math.min(1, progress)) * 100) : 0
            setOcrProgress((current) => ({
              fileName: currentFileName,
              percent: recognizing && current?.fileName === currentFileName
                ? Math.max(current.percent, percent)
                : percent,
              stage,
            }))
          },
        })
        for (const item of accepted) {
          currentFileName = item.attachment.name
          setOcrProgress({ fileName: currentFileName, percent: 0, stage: 'Recognizing text' })
          try {
            const { data } = await ocrWorker.recognize(item.file)
            parsedFixtures.push(...parseBetslipText(data.text))
          } catch {
            scanErrors += 1
          }
        }
      } catch {
        scanErrors += accepted.length
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
      if (result.omitted > 0) summary.push(`${result.omitted} fixture${result.omitted === 1 ? '' : 's'} could not be added or selected due to pool limits`)
      if (parsedFixtures.length === 0 && scanErrors === 0) summary.push('No matchups were recognized')
      if (scanErrors > 0) summary.push(`${scanErrors} screenshot${scanErrors === 1 ? '' : 's'} could not be scanned`)
      if (cleanupError) summary.push('OCR worker cleanup failed')
      if (summary.length === 0) summary.push('No new fixtures were found')
      const defaultsNote = result.defaultRateFixtures > 0
        ? ` Goal rates defaulted to λ ${OCR_DEFAULT_LAMBDA.toFixed(2)} / μ ${OCR_DEFAULT_MU.toFixed(2)} for ${result.defaultRateFixtures} fixture${result.defaultRateFixtures === 1 ? '' : 's'}.`
        : ''
      setStatus(`OCR complete: ${summary.join('; ')}.${defaultsNote}`)
    } finally {
      isOcrRunningRef.current = false
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = event.clipboardData.files
    if (files.length > 0) addFiles(files)
  }

  function runSimulation() {
    if (calibratedSlip.length === 0) {
      setStatus('Add at least one market selection before running a simulation.')
      return
    }
    cancelSimulation()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    let worker: Worker
    try {
      worker = new Worker(new URL('./engine/simulation.worker.ts', import.meta.url), { type: 'module' })
    } catch (error) {
      setStatus(`Could not start the simulation worker: ${error instanceof Error ? error.message : 'unknown error'}`)
      return
    }
    workerRef.current = worker
    setIsSimulating(true)
    setStatus(`Running ${runs.toLocaleString()} trials in a background worker.`)
    worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
      if (workerRef.current !== worker || event.data.requestId !== requestId) return
      worker.terminate()
      workerRef.current = null
      setIsSimulating(false)
      if (event.data.type === 'error') {
        setSimulation(null)
        setStatus(`Simulation failed: ${event.data.message}`)
        return
      }
      setSimulation(event.data.result)
      setStatus(`Simulation complete: ${runs.toLocaleString()} trials across ${calibratedSlip.length} selected edge${calibratedSlip.length === 1 ? '' : 's'}.`)
    }
    worker.onerror = (event) => {
      event.preventDefault()
      if (workerRef.current !== worker) return
      worker.terminate()
      workerRef.current = null
      setIsSimulating(false)
      setSimulation(null)
      setStatus(`Simulation worker failed: ${event.message || 'unknown worker error'}`)
    }
    const selectedIds = new Set(calibratedSlip.map((pick) => pick.fixtureId))
    const workerFixtures: FixtureRates[] = preparedFixtures.filter(({ id }) => selectedIds.has(id)).map(({ id, home, away, lambda, mu }) => ({
      id, home, away, lambda, mu,
    }))
    const workerPicks: SimulationPick[] = calibratedSlip.map(({ id, fixtureId, fixture, market, selection, probability, odds }) => ({
      id, fixtureId, fixture, market, selection, probability, odds,
    }))
    const request: SimulationWorkerRequest = { requestId, fixtures: workerFixtures, picks: workerPicks, runs, rho }
    try {
      worker.postMessage(request)
    } catch (error) {
      worker.terminate()
      workerRef.current = null
      setIsSimulating(false)
      setStatus(`Could not send simulation inputs to the background worker: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  function removePick(id: string) {
    cancelSimulation()
    setSlip((current) => current.filter((pick) => pick.id !== id))
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
    setSelectedFixtureIds((current) => [...current, id])
    setSelectedMarkets((current) => new Map(current).set(id, 'home'))
    setCustomDraft(emptyCustomFixture)
    setCustomRatePreset('balanced')
    cancelSimulation()
    setPermutations([])
    setBookingSlips([])
    cancelBookingQueue()
    setStatus(`${home} v ${away} added to the fixture board and permutation pool.`)
  }

  function togglePermutationFixture(fixtureId: string) {
    const isSelected = selectedFixtureIds.includes(fixtureId)
    if (!isSelected && selectedFixtureIds.length >= MAX_PERMUTATION_FIXTURES) {
      setStatus(`Select no more than ${MAX_PERMUTATION_FIXTURES} fixtures for permutations.`)
      return
    }
    if (isSelected) {
      setSelectedFixtureIds((current) => current.filter((id) => id !== fixtureId))
    } else {
      setSelectedFixtureIds((current) => [...current, fixtureId])
      if (!selectedMarkets.has(fixtureId)) {
        setSelectedMarkets((markets) => {
          if (markets.has(fixtureId)) return markets
          const next = new Map(markets)
          next.set(fixtureId, 'home')
          return next
        })
      }
    }
    setPermutations([])
    setBookingSlips([])
    cancelBookingQueue()
  }

  function generatePermutations() {
    const legs: PermutationLeg[] = selectedFixtureIds.flatMap((fixtureId) => {
      const fixture = preparedFixtures.find((item) => item.id === fixtureId)
      const market = selectedMarkets.get(fixtureId)
      if (!fixture || !market) return []
      const probability = selectionProbability(fixture.probabilities, market)
      const odds = fixture.odds[market]
      return [{
        fixtureId,
        fixture: `${fixture.home} v ${fixture.away}`,
        market,
        selection: selectionLabels[market],
        probability,
        odds,
        ev: expectedValue(probability, odds),
      }]
    })
    try {
      const generated = generateSlipPermutations(legs, {
        target: targetSlips,
        foldSize,
        minimumConfidence,
        positiveEvOnly,
      })
      setPermutations(generated)
      setBookingSlips([])
      cancelBookingQueue()
      setStatus(`Generated ${generated.length} unique ${foldSize}-fold slips from ${legs.length} selected fixtures.`)
    } catch (error) {
      setPermutations([])
      setStatus(`Could not generate slips: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  async function generateSportyBetCodes() {
    if (permutations.length === 0) {
      setStatus('Generate slip permutations before starting the reference-code queue.')
      return
    }
    cancelBookingQueue()
    queueCancelledRef.current = false
    const queueRunId = queueRunIdRef.current
    setBookingSlips([])
    setIsQueueRunning(true)
    setStatus(`Preparing ${permutations.length} simulated reference codes at 400 ms intervals.`)
    const queued: BookingSlip[] = []
    for (const [index, slipItem] of permutations.entries()) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 400))
      if (queueCancelledRef.current || queueRunIdRef.current !== queueRunId) {
        setIsQueueRunning(false)
        setStatus(`Reference-code queue paused after ${queued.length} of ${permutations.length} slips.`)
        return
      }
      try {
        queued.push({ ...slipItem, referenceCode: `SB-REF-${randomToken()}` })
      } catch (error) {
        setIsQueueRunning(false)
        setStatus(`Could not generate a secure reference code: ${error instanceof Error ? error.message : 'unknown error'}`)
        return
      }
      setBookingSlips([...queued])
      setStatus(`Preparing reference codes: ${index + 1} of ${permutations.length}.`)
    }
    setIsQueueRunning(false)
    setStatus(`Prepared ${queued.length} local reference codes. These are not SportyBet booking codes and cannot place bets.`)
  }

  async function copyReferenceCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setStatus('Reference code copied.')
    } catch (error) {
      setStatus(`Could not copy the reference code: ${error instanceof Error ? error.message : 'clipboard unavailable'}`)
    }
  }

  async function copyAllReferenceCodes() {
    if (bookingSlips.length === 0) return
    await copyReferenceCode(bookingSlips.map((ticket, index) => `${index + 1}. ${ticket.referenceCode}`).join('\n'))
  }

  function exportSlips(format: 'csv' | 'text') {
    if (bookingSlips.length === 0) {
      setStatus('Generate reference codes before exporting the slip portfolio.')
      return
    }
    const content = format === 'csv'
      ? [
          ['Slip #', 'Matches / picks', 'Combined odds', 'Simulated hit %', 'Portfolio EV', 'Reference code'].map(csvCell).join(','),
          ...bookingSlips.map((ticket, index) => [
            String(index + 1),
            ticket.legs.map((leg) => `${leg.fixture}: ${leg.selection}`).join(' | '),
            ticket.combinedOdds.toFixed(2),
            formatProbability(ticket.probability),
            `${ticket.ev >= 0 ? '+' : ''}${(ticket.ev * 100).toFixed(2)}%`,
            ticket.referenceCode,
          ].map(csvCell).join(',')),
        ].join('\r\n')
      : bookingSlips.map((ticket, index) =>
          `Slip ${index + 1} | ${ticket.legs.map((leg) => `${leg.fixture}: ${leg.selection}`).join(' / ')} | Odds ${ticket.combinedOdds.toFixed(2)} | Hit ${formatProbability(ticket.probability)} | EV ${ticket.ev >= 0 ? '+' : ''}${(ticket.ev * 100).toFixed(2)}% | Ref ${ticket.referenceCode}`,
        ).join('\n')
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reality-simulator-slips.${format}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setStatus(`Exported ${bookingSlips.length} slips as ${format.toUpperCase()}.`)
  }

  function renderMarkets(fixture: (typeof preparedFixtures)[number]) {
    return marketGroups[activeGroup].markets.map((market) => {
      const probability = selectionProbability(fixture.probabilities, market)
      const ev = expectedValue(probability, fixture.odds[market])
      const isSelected = slip.some((pick) => pick.id === `${fixture.id}:${market}`)
      return (
        <button
          className={`market-option${isSelected ? ' is-selected' : ''}`}
          key={market}
          type="button"
          onClick={() => addPick(fixture.id, market)}
          aria-label={`Add ${selectionLabels[market]} for ${fixture.home} versus ${fixture.away}, model probability ${formatProbability(probability)}, odds ${fixture.odds[market]}`}
        >
          <span className="market-option__name">{selectionLabels[market]}</span>
          <span className="market-option__probability">{formatProbability(probability)}</span>
          <span className="market-option__odds">{fixture.odds[market].toFixed(2)}</span>
          <span className={`market-option__ev${ev > 0 ? ' is-positive' : ''}`}>EV {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%</span>
          <span className="market-option__add" aria-hidden="true">{isSelected ? <Check size={14} /> : <Plus size={14} />}</span>
        </button>
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
        <div className="topbar__title">— Dixon-Coles & Monte Carlo Workbench</div>
        <nav className="topbar__nav" aria-label="Main navigation">
          <a className="nav-link is-active" href="#fixtures">Workbench</a>
          <a className="nav-link" href="#method">Method</a>
          <span className="live-indicator"><span />Model ready</span>
        </nav>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">Football modelling / Research desk 01</p>
          <h1>Price the match.<br /><em>Test the edge.</em></h1>
        </div>
        <div className="intro__aside">
          <p>A probability workbench for expected goals, low-score dependence and market value.</p>
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
            <input type="range" min={MIN_HALF_LIFE_DAYS} max={MAX_HALF_LIFE_DAYS} step="1" value={halfLifeDays} onChange={(event) => { cancelSimulation(); clearGeneratedSlips(); setHalfLifeDays(Number(event.target.value)) }} />
            <span className="control__caption">Recent-form signal fades against team priors over time.</span>
          </label>
          <label className="control">
            <span className="control__top"><span>Dixon–Coles ρ correction</span><strong>{rho.toFixed(2)}</strong></span>
            <input type="range" min={MIN_DIXON_COLES_RHO} max={MAX_DIXON_COLES_RHO} step="0.01" value={rho} onChange={(event) => { cancelSimulation(); clearGeneratedSlips(); setRho(Number(event.target.value)) }} />
            <span className="control__caption">Reweights 0–0, 0–1, 1–0 and 1–1 scorelines.</span>
          </label>
          <label className="control control--runs">
            <span className="control__top"><span>Monte Carlo volume</span><strong>{runs.toLocaleString()} runs</strong></span>
            <input type="range" min={MIN_SIMULATION_RUNS} max={MAX_SIMULATION_RUNS} step="1000" value={runs} onChange={(event) => updateRuns(event.target.value)} />
            <span className="control__caption">Set the number of simulated scoreline trials.</span>
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
            <button className="quiet-button" type="button" onClick={() => { cancelSimulation(); setStatus('Fixture probabilities refreshed from the current calibration inputs.') }}>
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
                  <label className="fixture-select">
                    <input
                      type="checkbox"
                      checked={selectedFixtureIds.includes(fixture.id)}
                      disabled={!selectedFixtureIds.includes(fixture.id) && selectedFixtureIds.length >= MAX_PERMUTATION_FIXTURES}
                      onChange={() => togglePermutationFixture(fixture.id)}
                    />
                    <span>Use in permutations</span>
                  </label>
                  {selectedFixtureIds.includes(fixture.id) && (
                    <label className="fixture-market-select">
                      <span>Selection</span>
                      <select
                        value={selectedMarkets.get(fixture.id) ?? 'home'}
                        onChange={(event) => {
                          const market = event.target.value as Market
                          if (!Object.hasOwn(selectionLabels, market)) return
                          clearGeneratedSlips()
                          setSelectedMarkets((current) => new Map(current).set(fixture.id, market))
                        }}
                      >
                        {(Object.keys(selectionLabels) as Market[]).map((market) => (
                          <option key={market} value={market}>{selectionLabels[market]}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className={`fixture__markets fixture__markets--${activeGroup}`}>
                  {renderMarkets(fixture)}
                </div>
              </article>
            ))}
          </div>
          <p className="data-note"><CircleHelp size={13} /> Select up to {MAX_PERMUTATION_FIXTURES} matches for slip generation. Fixture odds are illustrative, not live prices or betting advice.</p>
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
                <div className="ocr-progress__label"><span>{ocrProgress.stage.toLocaleLowerCase().includes('recognizing') ? 'Scanning image' : 'Preparing OCR'}: {ocrProgress.percent}%</span><span>{ocrProgress.fileName}</span></div>
                <progress value={ocrProgress.percent} max={100} aria-label={`Scanning ${ocrProgress.fileName}`} />
                <small>{ocrProgress.stage}</small>
              </div>
            )}
            {attachedFiles.length > 0 && (
              <ul className="attachment-list" aria-label="Attached screenshots">
                {attachedFiles.map((file) => <li key={file.id} title={`${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`}><FileImage size={14} /><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(file.id)}><Trash2 size={13} /></button></li>)}
              </ul>
            )}
            <label className="paste-label" htmlFor="bet-text">Paste selections or notes</label>
            <textarea id="bet-text" value={betText} maxLength={MAX_PASTED_TEXT_LENGTH} onChange={(event) => setBetText(sanitizeBetText(event.target.value))} onPaste={handlePaste} placeholder={'Arsenal — Over 2.5 — 1.76\nPaste your betslip text here'} rows={3} />
            <p className="intake-note">Recognized matchups are added to the fixture board and permutation pool. Review OCR team names and prices before use.</p>
          </section>

          <section className="slip-section" aria-labelledby="slip-heading">
            <div className="side-heading side-heading--slip">
              <div><p className="eyebrow">05 / Decision log</p><h2 id="slip-heading">Simulation slip <span className="count-badge">{slip.length}</span></h2></div>
              {slip.length > 0 && <button className="icon-button" type="button" onClick={() => { cancelSimulation(); setSlip([]) }} aria-label="Clear simulation slip"><Trash2 size={15} /></button>}
            </div>
            <section className="permutation-tool" aria-labelledby="permutation-heading">
              <div className="permutation-heading">
                <div>
                  <p className="eyebrow">05 / Multi-match portfolio</p>
                  <h3 id="permutation-heading">Permutation generator</h3>
                </div>
                <span className="section-note">{selectedFixtureIds.length} / {MAX_PERMUTATION_FIXTURES} matches</span>
              </div>
              <p className="permutation-intro">Choose fixtures and one market per match on the board. Each ticket uses a unique combination of fixtures.</p>
              <div className="permutation-controls">
                <label className="form-field">
                  <span>Target slips</span>
                  <input type="number" min="1" max={MAX_GENERATED_SLIPS} step="1" value={targetSlips} onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isInteger(value) && value >= 1 && value <= MAX_GENERATED_SLIPS) {
                      clearGeneratedSlips()
                      setTargetSlips(value)
                    }
                  }} />
                </label>
                <label className="form-field">
                  <span>Fold size</span>
                  <select value={foldSize} onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isInteger(value) && value >= 1 && value <= MAX_FOLD_SIZE) {
                      clearGeneratedSlips()
                      setFoldSize(value)
                    }
                  }}>
                    {[4, 5, 6, 7, 8].map((size) => <option key={size} value={size}>{size}-fold</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>Minimum confidence</span>
                  <select value={minimumConfidence} onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isFinite(value) && value >= 0 && value <= 1) {
                      clearGeneratedSlips()
                      setMinimumConfidence(value)
                    }
                  }}>
                    <option value="0.50">50%+</option>
                    <option value="0.60">60%+</option>
                    <option value="0.65">65%+</option>
                    <option value="0.70">70%+</option>
                    <option value="0.75">75%+</option>
                  </select>
                </label>
              </div>
              <label className="filter-toggle">
                <input type="checkbox" checked={positiveEvOnly} onChange={(event) => {
                  clearGeneratedSlips()
                  setPositiveEvOnly(event.target.checked)
                }} />
                <span>Positive expected value only</span>
              </label>
              <button className="quiet-button permutation-generate" type="button" onClick={generatePermutations}>
                <RefreshCw size={14} /> Generate unique slips
              </button>
            </section>
            {permutations.length > 0 && (
              <section className="permutation-results" aria-label="Generated slip combinations">
                <div className="permutation-summary">
                  <div><span>Unique slips</span><strong>{permutations.length}</strong></div>
                  <div><span>Mean portfolio EV</span><strong className={permutations.reduce((sum, ticket) => sum + ticket.ev, 0) > 0 ? 'is-positive' : ''}>{(permutations.reduce((sum, ticket) => sum + ticket.ev, 0) / permutations.length * 100).toFixed(2)}%</strong></div>
                </div>
                <div className="export-controls">
                  <button className="quiet-button" type="button" onClick={() => exportSlips('csv')}><Download size={13} /> Export CSV</button>
                  <button className="quiet-button" type="button" onClick={() => exportSlips('text')}><Download size={13} /> Export text</button>
                </div>
                <div className="permutation-list">
                  {permutations.map((ticket, index) => (
                    <article className="permutation-ticket" key={ticket.id}>
                      <div className="permutation-ticket__head">
                        <strong>Slip {index + 1}</strong>
                        <span>{ticket.legs.length}-fold</span>
                      </div>
                      <ul>{ticket.legs.map((leg) => <li key={`${leg.fixtureId}:${leg.market}`}>{leg.fixture} · {leg.selection}</li>)}</ul>
                      <div className="permutation-ticket__metrics">
                        <span>Odds <strong>{ticket.combinedOdds.toFixed(2)}</strong></span>
                        <span>Hit <strong>{formatProbability(ticket.probability)}</strong></span>
                        <span>EV <strong className={ticket.ev > 0 ? 'is-positive' : ''}>{ticket.ev > 0 ? '+' : ''}{(ticket.ev * 100).toFixed(2)}%</strong></span>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="booking-queue">
                  <div className="booking-queue__heading">
                    <div><p className="eyebrow">06 / Local preparation queue</p><h3>SportyBet reference codes</h3></div>
                    {isQueueRunning
                      ? <button className="quiet-button" type="button" onClick={cancelBookingQueue}>Pause queue</button>
                      : <button className="run-button booking-trigger" type="button" onClick={() => void generateSportyBetCodes()}><RefreshCw size={14} /> Generate codes</button>}
                  </div>
                  <p className="booking-disclaimer">Simulated local reference strings only. These are not official SportyBet booking codes and cannot submit or place bets. Jobs are prepared sequentially at 400 ms intervals.</p>
                  {bookingSlips.length > 0 && (
                    <>
                      <div className="export-controls">
                        <span className="section-note">{bookingSlips.length} / {permutations.length} prepared</span>
                        <button className="quiet-button" type="button" onClick={() => void copyAllReferenceCodes()}><Copy size={13} /> Copy all refs</button>
                      </div>
                      <div className="booking-table-wrap">
                        <table className="booking-table">
                          <thead><tr><th>Slip #</th><th>Matches / picks</th><th>Odds</th><th>Hit</th><th>Reference</th></tr></thead>
                          <tbody>{bookingSlips.map((ticket, index) => (
                            <tr key={ticket.id}>
                              <td>{index + 1}</td>
                              <td>{ticket.legs.map((leg) => `${leg.fixture} · ${leg.selection}`).join(' / ')}</td>
                              <td>{ticket.combinedOdds.toFixed(2)}</td>
                              <td>{formatProbability(ticket.probability)}</td>
                              <td><button className="reference-code" type="button" title="Copy simulated reference code" onClick={() => void copyReferenceCode(ticket.referenceCode)}>{ticket.referenceCode} <Copy size={12} /></button></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}
            {slip.length === 0 ? (
              <div className="empty-slip"><p>Select a market from the fixture board to add it here.</p><span>Model probability × decimal odds − 1 = EV</span></div>
            ) : (
              <div className="slip-picks">
                {calibratedSlip.map((pick) => {
                  const ev = expectedValue(pick.probability, pick.odds)
                  return (
                    <article className="slip-pick" key={pick.id}>
                      <div className="slip-pick__title"><div><strong>{pick.fixture}</strong><span>{selectionLabels[pick.market]}</span></div><button className="icon-button" type="button" onClick={() => removePick(pick.id)} aria-label={`Remove ${selectionLabels[pick.market]} for ${pick.fixture}`}><Trash2 size={14} /></button></div>
                      <div className="slip-pick__math"><span>{formatProbability(pick.probability)} × {pick.odds.toFixed(2)} − 1</span><strong className={ev > 0 ? 'is-positive' : ''}>{ev > 0 ? '+' : ''}{(ev * 100).toFixed(2)}%</strong></div>
                    </article>
                  )
                })}
                <button className="run-button" type="button" onClick={runSimulation} disabled={isSimulating}>{isSimulating ? 'Simulation running…' : 'Run simulation'} <ChevronDown size={16} /></button>
              </div>
            )}
            {simulation && (
              <div className="simulation-results" aria-live="polite">
                <div className="simulation-results__heading"><span>Monte Carlo result</span><b>{simulation.runs.toLocaleString()} trials</b></div>
                {simulation.results.map((result) => (
                  <div className="simulation-result" key={result.id}>
                    <span>{result.fixture} · {selectionLabels[result.market]}</span>
                    <strong>{formatProbability(result.simulatedProbability)} simulated</strong>
                    <small>{result.wins.toLocaleString()} hits · exact EV {result.ev > 0 ? '+' : ''}{(result.ev * 100).toFixed(2)}%</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="method-section" id="method">
        <div><p className="eyebrow">07 / Method note</p><h2>From rates to<br /><em>realized outcomes.</em></h2></div>
        <div className="method-copy">
          <p>Independent Poisson goal rates form the score matrix. Dixon–Coles τ corrections adjust the four low-scoring outcomes, then the normalized matrix yields 1X2, totals and BTTS probabilities.</p>
          <p>Each selected price is evaluated as <strong>EV = (model probability × decimal odds) − 1</strong>. Monte Carlo trials sample from that same corrected score distribution; simulated hit rates are diagnostics, while EV remains the exact model calculation.</p>
          <p>Half-life blends illustrative recent-form rates against team priors. All fixture inputs and prices in this prototype are examples, not a live data feed.</p>
        </div>
      </section>
      <footer className="page-footer"><span>Reality Simulator</span><span>Research prototype · Model outputs are estimates</span></footer>
      <div className="sr-only" aria-live="polite">{status}</div>
    </main>
  )
}

export default App
