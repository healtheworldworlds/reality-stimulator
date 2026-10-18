// Palette: #FAFAF8, #FFFFFF, #1A1A1A, #666660, #E5E5E0, #C85A32; type: Georgia + Inter/system sans.
// Icons: Lucide outline set, monochrome, 1.5px stroke.
import { useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowDownToLine,
  CircleHelp,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  calculateProbabilities,
  calibrateGoalMarket,
  expectedValue,
  sampleScoreline,
  MAX_GOAL_RATE,
  MAX_DIXON_COLES_RHO,
  MIN_DIXON_COLES_RHO,
  type AutomatedMarket,
  type Market,
  type MarketProbabilities,
  type MarketSelection,
} from './engine/simulation'
import { generateKickoffTimes, generateUniqueClubMatchups } from './engine/clubs'
import { formatKickoff, kickoffDateForToday } from './engine/kickoff'
import { fetchTodaysFixtures, type LiveFixture } from './api/fixtures'
import { LiveCodesHub } from './LiveCodesHub'
import './App.css'

type Fixture = {
  id: string
  competition: string
  kickoff: string
  kickoffDate?: string
  home: string
  away: string
  homePrior: number
  awayPrior: number
  homeRecent: number
  awayRecent: number
  recentAgeDays: number
  odds: Record<Market, number>
}

type RoundResult = {
  homeGoals: number
  awayGoals: number
  firstHalfGoals: number
  secondHalfGoals: number
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
const MAX_CUSTOM_TEAM_NAME_LENGTH = 80
const MAX_CUSTOM_KICKOFF_LENGTH = 64
const MAX_FIXTURE_POOL_SIZE = 100
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

const automatedMarketLabels: Record<AutomatedMarket, string> = {
  over15: 'Over 1.5 Goals',
  secondHalfHighest: 'Second Half Highest Scoring',
  over25: 'Over 2.5 Goals',
}

function allocateHalfGoals(homeGoals: number, awayGoals: number, secondHalfShare: number) {
  let firstHalfGoals = 0
  let secondHalfGoals = 0
  for (let goal = 0; goal < homeGoals + awayGoals; goal += 1) {
    if (Math.random() < secondHalfShare) secondHalfGoals += 1
    else firstHalfGoals += 1
  }
  return { firstHalfGoals, secondHalfGoals }
}

function marketHit(market: AutomatedMarket, result: RoundResult) {
  if (market === 'over15') return result.homeGoals + result.awayGoals >= 2
  if (market === 'over25') return result.homeGoals + result.awayGoals >= 3
  return result.secondHalfGoals > result.firstHalfGoals
}

function parseClockTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function selectLiveFixtures(fixtures: LiveFixture[], count: number, startMinute: number) {
  const shuffled = [...fixtures]
  for (let index = 0; index < Math.min(count, shuffled.length); index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (shuffled.length - index))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count).sort((left, right) => {
    const minuteOfDay = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }
    return (minuteOfDay(left.kickoff) - startMinute + 1440) % 1440 -
      (minuteOfDay(right.kickoff) - startMinute + 1440) % 1440
  })
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

function selectionProbability(probabilities: MarketProbabilities, market: Market) {
  return probabilities[marketForSelection[market]]
}

function App() {
  return <Workbench />
}

function Workbench() {
  const [halfLifeDays, setHalfLifeDays] = useState(30)
  const [rho, setRho] = useState(-0.05)
  const [fixturePool, setFixturePool] = useState(fixtures)
  const [generatedFixtures, setGeneratedFixtures] = useState<Fixture[]>([])
  const [customDraft, setCustomDraft] = useState<CustomFixtureDraft>(emptyCustomFixture)
  const [customRatePreset, setCustomRatePreset] = useState('balanced')
  const [customFormOpen, setCustomFormOpen] = useState(true)
  const [fixtureBoardOpen, setFixtureBoardOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<keyof typeof marketGroups>('result')
  const [generatorMarket, setGeneratorMarket] = useState<AutomatedMarket>('over15')
  const [roundMarket, setRoundMarket] = useState<AutomatedMarket>('over15')
  const [matchCount, setMatchCount] = useState('17')
  const [minimumOdds, setMinimumOdds] = useState('1.20')
  const [maximumOdds, setMaximumOdds] = useState('1.50')
  const [kickoffStart, setKickoffStart] = useState('22:00')
  const [kickoffEnd, setKickoffEnd] = useState('00:00')
  const [roundSecondHalfShare, setRoundSecondHalfShare] = useState(0.56)
  const [marketGeneratorSummary, setMarketGeneratorSummary] = useState('')
  const [isGeneratingMatches, setIsGeneratingMatches] = useState(false)
  const [roundFixtureIds, setRoundFixtureIds] = useState<string[]>([])
  const [roundNumber, setRoundNumber] = useState(0)
  const [roundResults, setRoundResults] = useState<Map<string, RoundResult>>(() => new Map())
  const [status, setStatus] = useState('')
  const nextFixtureIdRef = useRef(1)

  const preparedFixtures = useMemo(
    () =>
      [...fixturePool, ...generatedFixtures].map((fixture) => {
        const lambda = getRate(fixture.homePrior, fixture.homeRecent, fixture.recentAgeDays, halfLifeDays)
        const mu = getRate(fixture.awayPrior, fixture.awayRecent, fixture.recentAgeDays, halfLifeDays)
        return {
          ...fixture,
          lambda,
          mu,
          probabilities: calculateProbabilities(lambda, mu, rho),
        }
      }),
    [fixturePool, generatedFixtures, halfLifeDays, rho],
  )

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
    const results = new Map<string, RoundResult>()
    selected.forEach((fixture) => {
      const score = sampleScoreline(fixture.lambda, fixture.mu, rho)
      const halves = allocateHalfGoals(score.homeGoals, score.awayGoals, roundSecondHalfShare)
      results.set(fixture.id, { homeGoals: score.homeGoals, awayGoals: score.awayGoals, ...halves })
    })
    setRoundResults(results)
    setRoundNumber((current) => current + 1)
    setStatus(`Round ${roundNumber + 1} generated for ${selected.length} match${selected.length === 1 ? '' : 'es'}.`)
  }

  async function generateMarketMatches(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const count = Number(matchCount)
    const min = Number(minimumOdds)
    const max = Number(maximumOdds)
    const start = parseClockTime(kickoffStart)
    const end = parseClockTime(kickoffEnd)
    if (!Number.isInteger(count) || count < 3 || count > 30) {
      setMarketGeneratorSummary('Choose a whole match count from 3 to 30.')
      return
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 1 || max <= min || max > 1000) {
      setMarketGeneratorSummary('Enter valid decimal odds with a maximum greater than the minimum.')
      return
    }
    if (start === null || end === null) {
      setMarketGeneratorSummary('Enter valid 24-hour kickoff start and end times.')
      return
    }

    const calibration = calibrateGoalMarket(generatorMarket, min, max, rho)
    if (!calibration) {
      setMarketGeneratorSummary(`The model could not calibrate ${automatedMarketLabels[generatorMarket]} strictly inside ${min.toFixed(2)}–${max.toFixed(2)} with the supported goal-rate range. Try a wider odds bracket.`)
      return
    }
    const probabilities = calculateProbabilities(calibration.lambda, calibration.mu, rho)
    setIsGeneratingMatches(true)
    try {
      const liveResult = await fetchTodaysFixtures(start, end)
      const liveMatchups = liveResult.status === 'available'
        ? selectLiveFixtures(liveResult.fixtures, count, start)
        : []
      const useLiveFixtures = liveMatchups.length > 0
      const fallbackKickoffTimes = useLiveFixtures ? [] : generateKickoffTimes(count, start, end)
      const matchups: Array<{ competition: string; home: string; away: string; kickoff: string; kickoffDate: string; generatedId: string }> = useLiveFixtures
        ? liveMatchups.map((matchup) => ({
            ...matchup,
            generatedId: `market-api-${matchup.id}`,
          }))
        : generateUniqueClubMatchups(count).map((matchup, index) => ({
            ...matchup,
            kickoff: fallbackKickoffTimes[index],
            kickoffDate: kickoffDateForToday(fallbackKickoffTimes[index], start) ?? new Date().toISOString(),
            generatedId: `market-gen-${nextFixtureIdRef.current++}`,
          }))
      const generated = matchups.map((matchup): Fixture => ({
        id: matchup.generatedId,
        competition: matchup.competition,
        kickoff: matchup.kickoff,
        kickoffDate: matchup.kickoffDate,
        home: matchup.home,
        away: matchup.away,
        homePrior: calibration.lambda,
        awayPrior: calibration.mu,
        homeRecent: calibration.lambda,
        awayRecent: calibration.mu,
        recentAgeDays: 0,
        odds: {
          ...DEFAULT_CUSTOM_ODDS,
          home: 1 / probabilities.home,
          draw: 1 / probabilities.draw,
          away: 1 / probabilities.away,
          over15: 1 / probabilities.over15,
          under15: 1 / probabilities.under15,
          over25: 1 / probabilities.over25,
          under25: 1 / probabilities.under25,
          bttsYes: 1 / probabilities.bttsYes,
          bttsNo: 1 / probabilities.bttsNo,
        },
      }))
      setGeneratedFixtures(generated)
      setRoundFixtureIds(generated.map((fixture) => fixture.id))
      setRoundResults(new Map())
      setRoundNumber(0)
      setRoundMarket(generatorMarket)
      setRoundSecondHalfShare(calibration.secondHalfShare)
      const fallbackReason = liveResult.status === 'fallback' ? liveResult.reason : 'no-matches'
      const source = useLiveFixtures
        ? `Using ${generated.length}${generated.length < count ? ` of ${count} requested` : ''} live fixtures`
        : `Using registry fallback (${fallbackReason === 'no-matches' ? 'no live matches in this window' : 'live API unavailable or server key not configured'})`
      setMarketGeneratorSummary(
        `${source} · ${automatedMarketLabels[generatorMarket]} model odds ${calibration.odds.toFixed(3)} · λ ${calibration.lambda.toFixed(2)} / μ ${calibration.mu.toFixed(2)}${generatorMarket === 'secondHalfHighest' ? ` · second-half allocation ${(calibration.secondHalfShare * 100).toFixed(1)}%` : ''}.`,
      )
      setStatus(`${generated.length} ${useLiveFixtures ? 'live' : 'sample'} matches added to the round lineup in kickoff order.`)
    } finally {
      setIsGeneratingMatches(false)
    }
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

          <section className={`fixture-section${fixtureBoardOpen ? ' is-open' : ''}`} id="fixtures" aria-labelledby="fixture-heading">
          <div className="section-heading section-heading--fixture">
            <div>
              <p className="eyebrow">03 / Upcoming markets</p>
              <h2 id="fixture-heading">Fixture board</h2>
            </div>
            <div className="fixture-section__actions">
              <button className="quiet-button fixture-board-toggle" type="button" aria-expanded={fixtureBoardOpen} aria-controls="fixture-board-content" onClick={() => setFixtureBoardOpen((open) => !open)}>
                Toggle Fixture Board
              </button>
              <button className="quiet-button fixture-recalculate" type="button" onClick={() => { setStatus('Fixture probabilities refreshed from the current calibration inputs.') }}>
                <RefreshCw size={14} /> Recalculate
              </button>
            </div>
          </div>
          <div className="fixture-section__content" id="fixture-board-content">
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
          </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="market-generator" aria-labelledby="market-generator-heading">
            <div className="side-heading">
              <div><p className="eyebrow">04 / Automated market generator</p><h2 id="market-generator-heading">Build a priced round</h2></div>
            </div>
            <form className="market-generator__form" onSubmit={generateMarketMatches}>
              <label className="form-field market-generator__market">
                <span>Market selector</span>
                <select value={generatorMarket} onChange={(event) => {
                  const value = event.target.value
                  if (value !== 'over15' && value !== 'secondHalfHighest' && value !== 'over25') return
                  setGeneratorMarket(value)
                  setMinimumOdds(value === 'secondHalfHighest' ? '1.80' : '1.20')
                  setMaximumOdds(value === 'secondHalfHighest' ? '2.30' : '1.50')
                }}>
                  <option value="over15">Over 1.5 Goals</option>
                  <option value="secondHalfHighest">Second Half Highest Scoring</option>
                  <option value="over25">Over 2.5 Goals</option>
                </select>
              </label>
              <label className="form-field">
                <span>Match count</span>
                <input type="number" min="3" max="30" step="1" value={matchCount} onChange={(event) => setMatchCount(event.target.value)} required />
              </label>
              <div className="market-generator__odds">
                <label className="form-field">
                  <span>Min odds</span>
                  <input type="number" inputMode="decimal" min="1.01" max="1000" step="0.01" value={minimumOdds} onChange={(event) => setMinimumOdds(event.target.value)} required />
                </label>
                <label className="form-field">
                  <span>Max odds</span>
                  <input type="number" inputMode="decimal" min="1.01" max="1000" step="0.01" value={maximumOdds} onChange={(event) => setMaximumOdds(event.target.value)} required />
                </label>
              </div>
              <div className="market-generator__kickoff">
                <label className="form-field">
                  <span>Kickoff window · start</span>
                  <input type="time" value={kickoffStart} onChange={(event) => setKickoffStart(event.target.value)} required />
                </label>
                <label className="form-field">
                  <span>End</span>
                  <input type="time" value={kickoffEnd} onChange={(event) => setKickoffEnd(event.target.value)} required />
                </label>
              </div>
              <button className="run-button market-generator__submit" type="submit" disabled={isGeneratingMatches}>
                <Plus size={14} /> {isGeneratingMatches ? 'Fetching today’s fixtures…' : 'Generate Matches'}
              </button>
            </form>
            <p className="market-generator__note">Uses today’s API-Football fixtures in UTC when available. If the API is unavailable, registry fallback pairings and kickoff times are illustrative, not scheduled fixtures.</p>
            {marketGeneratorSummary && <p className={`market-generator__summary${marketGeneratorSummary.startsWith('The model could not') || marketGeneratorSummary.startsWith('Choose') || marketGeneratorSummary.startsWith('Enter') ? ' is-error' : ''}`} role="status" aria-live="polite">{marketGeneratorSummary}</p>}
          </section>

          <section className="slip-section" aria-labelledby="slip-heading">
            <div className="side-heading side-heading--slip">
                <div><p className="eyebrow">06 / Round generator</p><h2 id="slip-heading">Round outcomes <span className="count-badge">{roundFixtureIds.length}</span></h2></div>
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
                  <div className="empty-slip"><p>Add matches from the fixture board to build your round lineup.</p></div>
                ) : (
                  <div className="round-fixtures" aria-live="polite">
                    {roundFixtureIds.map((fixtureId, index) => {
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
                      const selectedMarketHit = result ? marketHit(roundMarket, result) : null
                      return (
                        <article className="round-fixture" key={fixture.id}>
                          <div className="round-fixture__heading">
                            <div className="round-fixture__head">
                              <div className="round-fixture__title">
                                <span className="round-fixture__index">{index + 1}.</span>
                                <strong>{fixture.home} vs {fixture.away}</strong>
                              </div>
                              <button className="icon-button" type="button" onClick={() => toggleRoundFixture(fixture.id)} aria-label={`Remove ${fixture.home} versus ${fixture.away} from round lineup`}><Trash2 size={13} /></button>
                            </div>
                            <time className="round-fixture__kickoff" dateTime={fixture.kickoffDate}>{formatKickoff(fixture.kickoff, fixture.kickoffDate)}</time>
                          </div>
                          <div className="round-fixture__score" aria-label={result ? `Simulated final score ${result.homeGoals} to ${result.awayGoals}` : 'Score pending'}>
                            {result ? `${result.homeGoals} - ${result.awayGoals}` : '— - —'}
                          </div>
                          {result && roundMarket === 'secondHalfHighest' && (
                            <p className="round-fixture__halves">1st half {result.firstHalfGoals} – {result.secondHalfGoals} 2nd half</p>
                          )}
                          <span className={`round-fixture__market-badge${selectedMarketHit === null ? ' is-pending' : selectedMarketHit ? ' is-hit' : ' is-miss'}`}>
                            {automatedMarketLabels[roundMarket]} · {selectedMarketHit === null ? 'Pending' : selectedMarketHit ? 'Hit' : 'Miss'}
                          </span>
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
                </div>
              </section>
          </section>
          <LiveCodesHub />
        </aside>
      </div>

      <section className="method-section" id="method">
        <div><p className="eyebrow">07 / Method note</p><h2>From rates to<br /><em>realized outcomes.</em></h2></div>
        <div className="method-copy">
          <p>Independent Poisson goal rates form the score matrix. Dixon–Coles τ corrections adjust the four low-scoring outcomes, then the normalized matrix yields 1X2, totals and BTTS probabilities.</p>
          <p>Each round draws one independent scoreline per selected fixture from its corrected Dixon–Coles matrix. The second-half market allocates each goal to a half at the calibrated share; a tie is not a second-half win. The fixture lineup remains fixed between rounds so outcomes can be regenerated and copied.</p>
          <p>The automated generator calibrates model odds inside the requested range and uses scheduled API-Football fixtures when available. Its offline registry fallback creates illustrative, unscheduled matchups. Kickoff times and availability depend on the selected UTC window. All model prices in this prototype are estimates, not bookmaker odds.</p>
        </div>
      </section>
      <footer className="page-footer"><span>Reality Simulator</span><span>Research prototype · Model outputs are estimates</span></footer>
      <div className="sr-only" aria-live="polite">{status}</div>
    </main>
  )
}

export default App
