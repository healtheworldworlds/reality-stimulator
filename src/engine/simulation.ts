export type Market =
  | 'home'
  | 'draw'
  | 'away'
  | 'over15'
  | 'under15'
  | 'over25'
  | 'under25'
  | 'bttsYes'
  | 'bttsNo'

export type MarketSelection = Market

export type MarketProbabilities = Record<Market, number>

export type AutomatedMarket = 'over15' | 'secondHalfHighest' | 'over25'

export type GoalMarketCalibration = {
  lambda: number
  mu: number
  secondHalfShare: number
  probability: number
  odds: number
}

export type ScorelineCell = {
  homeGoals: number
  awayGoals: number
  probability: number
}

export type FixtureRates = {
  id: string
  home: string
  away: string
  lambda: number
  mu: number
}

export type SimulationPick = {
  id: string
  fixtureId: string
  fixture: string
  market: Market
  selection: MarketSelection
  probability: number
  odds: number
}

export type SimulationResult = {
  id: string
  fixture: string
  market: Market
  wins: number
  simulatedProbability: number
  modelProbability: number
  odds: number
  ev: number
}

export type MonteCarloResult = {
  runs: number
  results: SimulationResult[]
}

export type SimulationWorkerRequest = {
  requestId: number
  fixtures: FixtureRates[]
  picks: SimulationPick[]
  runs: number
  rho: number
}

export type SimulationWorkerResponse =
  | { requestId: number; type: 'complete'; result: MonteCarloResult }
  | { requestId: number; type: 'error'; message: string }

const VALID_MARKETS: ReadonlySet<string> = new Set([
  'home',
  'draw',
  'away',
  'over15',
  'under15',
  'over25',
  'under25',
  'bttsYes',
  'bttsNo',
])

export const MIN_SIMULATION_RUNS = 1000
export const MAX_SIMULATION_RUNS = 100000
export const MAX_GOAL_RATE = 10
export const MIN_DIXON_COLES_RHO = -0.15
export const MAX_DIXON_COLES_RHO = 0.15
export const MAX_FIXTURES_PER_SIMULATION = 100
export const MAX_PICKS_PER_SIMULATION = 500
export const MAX_TOTAL_FIXTURE_TRIALS = 1_000_000
export const MAX_TOTAL_PICK_TRIALS = 5_000_000
export const DEFAULT_MAX_GOALS = 10
export const MAX_SCORELINE_GOALS = 20

function assertFiniteNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_GOAL_RATE) {
    throw new RangeError(`${name} must be a finite number between 0 and ${MAX_GOAL_RATE}.`)
  }
}

function poissonSeries(rate: number, maxGoals: number) {
  const probabilities = new Array<number>(maxGoals + 1)
  probabilities[0] = Math.exp(-rate)
  for (let goals = 1; goals <= maxGoals; goals += 1) {
    probabilities[goals] = (probabilities[goals - 1] * rate) / goals
  }
  return probabilities
}

function dependenceCorrection(homeGoals: number, awayGoals: number, lambda: number, mu: number, rho: number) {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambda * mu * rho
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambda * rho
  if (homeGoals === 1 && awayGoals === 0) return 1 + mu * rho
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho
  return 1
}

export function buildScoreMatrix(lambda: number, mu: number, rho = -0.05, maxGoals = DEFAULT_MAX_GOALS): ScorelineCell[] {
  assertFiniteNonNegative('lambda', lambda)
  assertFiniteNonNegative('mu', mu)
  if (!Number.isFinite(rho) || rho < MIN_DIXON_COLES_RHO || rho > MAX_DIXON_COLES_RHO) {
    throw new RangeError(`rho must be between ${MIN_DIXON_COLES_RHO} and ${MAX_DIXON_COLES_RHO}.`)
  }
  if (!Number.isInteger(maxGoals) || maxGoals < 1 || maxGoals > MAX_SCORELINE_GOALS) {
    throw new RangeError(`maxGoals must be an integer between 1 and ${MAX_SCORELINE_GOALS}.`)
  }

  const homeDistribution = poissonSeries(lambda, maxGoals)
  const awayDistribution = poissonSeries(mu, maxGoals)
  const unnormalized: ScorelineCell[] = []
  let totalProbability = 0

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const correction = dependenceCorrection(homeGoals, awayGoals, lambda, mu, rho)
      if (correction < 0) {
        throw new RangeError('rho produces a negative Dixon–Coles scoreline probability.')
      }
      const probability = homeDistribution[homeGoals] * awayDistribution[awayGoals] * correction
      unnormalized.push({ homeGoals, awayGoals, probability })
      totalProbability += probability
    }
  }

  if (totalProbability <= 0 || !Number.isFinite(totalProbability)) {
    throw new RangeError('The score matrix could not be normalized.')
  }

  return unnormalized.map((cell) => ({ ...cell, probability: cell.probability / totalProbability }))
}

export function probabilitiesFromMatrix(matrix: ScorelineCell[]): MarketProbabilities {
  const probabilities: MarketProbabilities = {
    home: 0,
    draw: 0,
    away: 0,
    over15: 0,
    under15: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0,
  }

  for (const cell of matrix) {
    const totalGoals = cell.homeGoals + cell.awayGoals
    if (cell.homeGoals > cell.awayGoals) probabilities.home += cell.probability
    else if (cell.homeGoals === cell.awayGoals) probabilities.draw += cell.probability
    else probabilities.away += cell.probability

    if (totalGoals > 1) probabilities.over15 += cell.probability
    else probabilities.under15 += cell.probability
    if (totalGoals > 2) probabilities.over25 += cell.probability
    else probabilities.under25 += cell.probability
    if (cell.homeGoals > 0 && cell.awayGoals > 0) probabilities.bttsYes += cell.probability
    else probabilities.bttsNo += cell.probability
  }

  return probabilities
}

export function calculateProbabilities(lambda: number, mu: number, rho = -0.05, maxGoals = DEFAULT_MAX_GOALS) {
  return probabilitiesFromMatrix(buildScoreMatrix(lambda, mu, rho, maxGoals))
}

export function calculateSecondHalfHighestProbability(lambda: number, mu: number, secondHalfShare = 0.56, rho = -0.05) {
  if (!Number.isFinite(secondHalfShare) || secondHalfShare <= 0 || secondHalfShare >= 1) {
    throw new RangeError('secondHalfShare must be between 0 and 1.')
  }
  const matrix = buildScoreMatrix(lambda, mu, rho)
  const halfProbabilityByTotal = new Map<number, number>()
  let probability = 0
  for (const cell of matrix) {
    const totalGoals = cell.homeGoals + cell.awayGoals
    let halfProbability = halfProbabilityByTotal.get(totalGoals)
    if (halfProbability === undefined) {
      let binomialProbability = (1 - secondHalfShare) ** totalGoals
      halfProbability = 0
      for (let secondHalfGoals = 0; secondHalfGoals <= totalGoals; secondHalfGoals += 1) {
        if (secondHalfGoals > totalGoals / 2) halfProbability += binomialProbability
        if (secondHalfGoals < totalGoals) {
          binomialProbability *= ((totalGoals - secondHalfGoals) / (secondHalfGoals + 1)) * (secondHalfShare / (1 - secondHalfShare))
        }
      }
      halfProbabilityByTotal.set(totalGoals, halfProbability)
    }
    probability += cell.probability * halfProbability
  }
  return probability
}

export function calibrateGoalMarket(
  market: AutomatedMarket,
  minOdds: number,
  maxOdds: number,
  rho = -0.05,
): GoalMarketCalibration | null {
  if (!Number.isFinite(minOdds) || !Number.isFinite(maxOdds) || minOdds <= 1 || maxOdds <= minOdds || maxOdds > 1000) {
    throw new RangeError('The odds range must be finite, greater than 1, and have a maximum above its minimum.')
  }
  if (!Number.isFinite(rho) || rho < MIN_DIXON_COLES_RHO || rho > MAX_DIXON_COLES_RHO) {
    throw new RangeError(`rho must be between ${MIN_DIXON_COLES_RHO} and ${MAX_DIXON_COLES_RHO}.`)
  }

  const targetOdds = (minOdds + maxOdds) / 2
  const targetProbability = 1 / targetOdds
  if (market !== 'secondHalfHighest') {
    const selection = market
    let low = 0
    let high = 5
    if (calculateProbabilities(high / 2, high / 2, rho)[selection] < targetProbability) return null
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const totalRate = (low + high) / 2
      if (calculateProbabilities(totalRate / 2, totalRate / 2, rho)[selection] < targetProbability) low = totalRate
      else high = totalRate
    }
    const lambda = (low + high) / 4
    const mu = lambda
    const probability = calculateProbabilities(lambda, mu, rho)[selection]
    const odds = 1 / probability
    if (odds <= minOdds || odds >= maxOdds) return null
    return { lambda, mu, secondHalfShare: 0.56, probability, odds }
  }

  let best: GoalMarketCalibration | null = null
  let bestBaselineDistance = Number.POSITIVE_INFINITY
  for (let totalRate = 0.25; totalRate <= 5; totalRate += 0.025) {
    const lambda = totalRate / 2
    const mu = totalRate / 2
    let lowShare = 0.56
    let highShare = 0.95
    const lowProbability = calculateSecondHalfHighestProbability(lambda, mu, lowShare, rho)
    const highProbability = calculateSecondHalfHighestProbability(lambda, mu, highShare, rho)
    if (targetProbability < lowProbability || targetProbability > highProbability) continue
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const share = (lowShare + highShare) / 2
      if (calculateSecondHalfHighestProbability(lambda, mu, share, rho) < targetProbability) lowShare = share
      else highShare = share
    }
    const secondHalfShare = (lowShare + highShare) / 2
    const probability = calculateSecondHalfHighestProbability(lambda, mu, secondHalfShare, rho)
    const odds = 1 / probability
    if (odds <= minOdds || odds >= maxOdds) continue
    const baselineDistance = Math.abs(secondHalfShare - 0.56)
    if (baselineDistance < bestBaselineDistance) {
      bestBaselineDistance = baselineDistance
      best = { lambda, mu, secondHalfShare, probability, odds }
    }
  }
  return best
}

export function expectedValue(probability: number, decimalOdds: number) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError('probability must be between 0 and 1.')
  }
  if (!Number.isFinite(decimalOdds) || decimalOdds < 1 || decimalOdds > 1000) {
    throw new RangeError('decimalOdds must be a finite number between 1 and 1000.')
  }
  return probability * decimalOdds - 1
}

function sampleCell(matrix: ScorelineCell[], random: number) {
  let cumulativeProbability = 0
  for (const cell of matrix) {
    cumulativeProbability += cell.probability
    if (random < cumulativeProbability) return cell
  }
  return matrix[matrix.length - 1]
}

export function sampleScoreline(
  lambda: number,
  mu: number,
  rho = -0.05,
  random: () => number = Math.random,
): ScorelineCell {
  const draw = random()
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new RangeError('random must return a finite value in the range [0, 1).')
  }
  return sampleCell(buildScoreMatrix(lambda, mu, rho), draw)
}

function selectionWins(homeGoals: number, awayGoals: number, selection: MarketSelection) {
  const totalGoals = homeGoals + awayGoals
  switch (selection) {
    case 'home': return homeGoals > awayGoals
    case 'draw': return homeGoals === awayGoals
    case 'away': return homeGoals < awayGoals
    case 'over15': return totalGoals > 1
    case 'under15': return totalGoals <= 1
    case 'over25': return totalGoals > 2
    case 'under25': return totalGoals <= 2
    case 'bttsYes': return homeGoals > 0 && awayGoals > 0
    case 'bttsNo': return homeGoals === 0 || awayGoals === 0
  }
}

export function runMonteCarlo(
  fixtures: FixtureRates[],
  picks: SimulationPick[],
  runs: number,
  rho = -0.05,
  random: () => number = Math.random,
): MonteCarloResult {
  if (!Number.isInteger(runs) || runs < MIN_SIMULATION_RUNS || runs > MAX_SIMULATION_RUNS) {
    throw new RangeError(`runs must be an integer between ${MIN_SIMULATION_RUNS} and ${MAX_SIMULATION_RUNS}.`)
  }
  if (fixtures.length > MAX_FIXTURES_PER_SIMULATION) {
    throw new RangeError(`A simulation can include at most ${MAX_FIXTURES_PER_SIMULATION} fixtures.`)
  }
  if (picks.length > MAX_PICKS_PER_SIMULATION) {
    throw new RangeError(`A simulation can include at most ${MAX_PICKS_PER_SIMULATION} picks.`)
  }
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
  const matrices = new Map<string, ScorelineCell[]>()
  const winCounts = new Map(picks.map((pick) => [pick.id, 0]))
  const picksByFixture = new Map<string, SimulationPick[]>()
  const seenPickIds = new Set<string>()

  for (const pick of picks) {
    if (typeof pick.id !== 'string' || pick.id.length > 128 || typeof pick.fixtureId !== 'string' || pick.fixtureId.length > 128) {
      throw new RangeError('Simulation pick identifiers must be strings of at most 128 characters.')
    }
    if (typeof pick.fixture !== 'string' || pick.fixture.length > 256) {
      throw new RangeError('Simulation fixture labels must be strings of at most 256 characters.')
    }
    if (!VALID_MARKETS.has(pick.market) || !VALID_MARKETS.has(pick.selection)) {
      throw new RangeError(`Pick "${pick.id}" has an invalid market.`)
    }
    if (seenPickIds.has(pick.id)) throw new RangeError(`Simulation pick identifier "${pick.id}" is duplicated.`)
    seenPickIds.add(pick.id)
    const fixture = fixtureById.get(pick.fixtureId)
    if (!fixture) throw new RangeError(`No fixture rates found for simulation pick "${pick.id}".`)
    if (!matrices.has(fixture.id)) matrices.set(fixture.id, buildScoreMatrix(fixture.lambda, fixture.mu, rho))
    const fixturePicks = picksByFixture.get(fixture.id) ?? []
    fixturePicks.push(pick)
    picksByFixture.set(fixture.id, fixturePicks)
  }
  if (runs * matrices.size > MAX_TOTAL_FIXTURE_TRIALS) {
    throw new RangeError(`Simulation workload cannot exceed ${MAX_TOTAL_FIXTURE_TRIALS} fixture trials.`)
  }
  if (runs * picks.length > MAX_TOTAL_PICK_TRIALS) {
    throw new RangeError(`Simulation workload cannot exceed ${MAX_TOTAL_PICK_TRIALS} pick trials.`)
  }

  for (let iteration = 0; iteration < runs; iteration += 1) {
    for (const [fixtureId, matrix] of matrices) {
      const draw = random()
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
        throw new RangeError('random must return a finite value in the range [0, 1).')
      }
      const cell = sampleCell(matrix, draw)
      for (const pick of picksByFixture.get(fixtureId) ?? []) {
        if (selectionWins(cell.homeGoals, cell.awayGoals, pick.selection)) {
          winCounts.set(pick.id, (winCounts.get(pick.id) ?? 0) + 1)
        }
      }
    }
  }

  return {
    runs,
    results: picks.map((pick) => {
      if (!Number.isFinite(pick.probability) || pick.probability < 0 || pick.probability > 1) {
        throw new RangeError(`Pick "${pick.id}" has an invalid probability.`)
      }
      const wins = winCounts.get(pick.id) ?? 0
      return {
        id: pick.id,
        fixture: pick.fixture,
        market: pick.market,
        wins,
        simulatedProbability: wins / runs,
        modelProbability: pick.probability,
        odds: pick.odds,
        ev: expectedValue(pick.probability, pick.odds),
      }
    }),
  }
}
