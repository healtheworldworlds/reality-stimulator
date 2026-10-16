export type PermutationLeg = {
  fixtureId: string
  fixture: string
  market: string
  selection: string
  probability: number
  odds: number
  ev: number
}

export type GeneratedSlip = {
  id: string
  legs: PermutationLeg[]
  probability: number
  combinedOdds: number
  ev: number
}

export type PermutationOptions = {
  target: number
  foldSize: number
  minimumConfidence: number
  positiveEvOnly: boolean
}

export const MAX_PERMUTATION_FIXTURES = 14
export const MAX_GENERATED_SLIPS = 100
export const MAX_FOLD_SIZE = 8

function assertRandomValue(value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a finite value in the range [0, 1).')
  }
}

export function generateSlipPermutations(
  inputLegs: PermutationLeg[],
  options: PermutationOptions,
  random: () => number = Math.random,
): GeneratedSlip[] {
  const { target, foldSize, minimumConfidence, positiveEvOnly } = options
  if (!Number.isInteger(target) || target < 1 || target > MAX_GENERATED_SLIPS) {
    throw new RangeError(`Target slips must be between 1 and ${MAX_GENERATED_SLIPS}.`)
  }
  if (!Number.isInteger(foldSize) || foldSize < 1 || foldSize > MAX_FOLD_SIZE) {
    throw new RangeError(`Fold size must be between 1 and ${MAX_FOLD_SIZE}.`)
  }
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new RangeError('Minimum confidence must be between 0 and 1.')
  }
  const uniqueFixtures = new Set(inputLegs.map((leg) => leg.fixtureId))
  if (uniqueFixtures.size > MAX_PERMUTATION_FIXTURES) {
    throw new RangeError(`Permutation generation supports at most ${MAX_PERMUTATION_FIXTURES} fixtures.`)
  }
  const legs = inputLegs.filter((leg) => {
    if (typeof leg.fixtureId !== 'string' || leg.fixtureId.length > 128 ||
      typeof leg.fixture !== 'string' || leg.fixture.length > 256 ||
      typeof leg.market !== 'string' || leg.market.length > 32 ||
      typeof leg.selection !== 'string' || leg.selection.length > 80) {
      throw new RangeError('Permutation leg labels exceed their allowed length.')
    }
    if (!Number.isFinite(leg.probability) || leg.probability < 0 || leg.probability > 1 ||
      !Number.isFinite(leg.odds) || leg.odds < 1 || leg.odds > 1000 ||
      !Number.isFinite(leg.ev)) {
      throw new RangeError('Permutation legs must have valid probability, odds and EV values.')
    }
    return leg.probability >= minimumConfidence && (!positiveEvOnly || leg.ev > 0)
  })
  const legsByFixture = new Map<string, PermutationLeg[]>()
  for (const leg of legs) {
    const fixtureLegs = legsByFixture.get(leg.fixtureId) ?? []
    fixtureLegs.push(leg)
    legsByFixture.set(leg.fixtureId, fixtureLegs)
  }
  const eligibleLegs = [...legsByFixture.values()].flatMap((fixtureLegs) => fixtureLegs.slice(0, 1))
  if (foldSize > eligibleLegs.length) {
    throw new RangeError(`Only ${eligibleLegs.length} fixtures meet the current filter; reduce the fold size or filter.`)
  }

  const combinations: PermutationLeg[][] = []
  const current: PermutationLeg[] = []
  function visit(start: number) {
    if (current.length === foldSize) {
      combinations.push([...current])
      return
    }
    const remaining = foldSize - current.length
    for (let index = start; index <= eligibleLegs.length - remaining; index += 1) {
      current.push(eligibleLegs[index])
      visit(index + 1)
      current.pop()
    }
  }
  visit(0)
  if (combinations.length < target) {
    throw new RangeError(`Only ${combinations.length} unique slips are possible with this fold size and filter.`)
  }
  for (let index = combinations.length - 1; index > 0; index -= 1) {
    const draw = random()
    assertRandomValue(draw)
    const swapIndex = Math.floor(draw * (index + 1))
    ;[combinations[index], combinations[swapIndex]] = [combinations[swapIndex], combinations[index]]
  }

  return combinations.slice(0, target).map((combination) => {
    const probability = combination.reduce((total, leg) => total * leg.probability, 1)
    const combinedOdds = combination.reduce((total, leg) => total * leg.odds, 1)
    return {
      id: combination.map((leg) => `${leg.fixtureId}:${leg.market}`).join('|'),
      legs: combination,
      probability,
      combinedOdds,
      ev: probability * combinedOdds - 1,
    }
  })
}
