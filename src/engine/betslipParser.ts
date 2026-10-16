import type { Market } from './simulation'

export type ParsedBetslipFixture = {
  home: string
  away: string
  kickoff: string
  odds: number[]
  marketOdds: Partial<Record<Market, number>>
  lambda?: number
  mu?: number
}

type MatchCandidate = {
  home: string
  away: string
  lineIndex: number
  lineCount: number
}

const MAX_OCR_TEXT_LENGTH = 20_000
const MAX_PARSED_FIXTURES = 20
const INLINE_MATCH_PATTERN = new RegExp(`^\\s*(.{2,60}?)\\s+(?:vs?\\.?|v\\.?|[-–—])\\s+(.{2,60})$`, 'iu')
const KICKOFF_PATTERN = /\b(?:([01]?\d|2[0-3]):([0-5]\d))\b/
const DECIMAL_PATTERN = /\b\d{1,3}(?:[.,]\d{1,2})\b/g
const GOAL_RATE_PATTERN = /(?:λ|μ|lambda|mu|home\s+xg|away\s+xg)\s*[:=]?\s*\d{1,2}(?:[.,]\d{1,2})?/giu
const TEAM_BLACKLIST = /\b(?:premier league|champions league|la liga|serie a|bundesliga|sportybet|bet slip|betslip|total odds|potential win|stake|balance|over|under|home|away|draw|btts|both teams|kick.?off|full.?time|double chance|correct score)\b/i

const RESULT_MARKETS: Market[] = ['home', 'draw', 'away']

function normalizeLine(value: string) {
  return value
    .replace(/[|]/g, ' ')
    .replace(KICKOFF_PATTERN, ' ')
    .replace(GOAL_RATE_PATTERN, ' ')
    .replace(/\b\d{1,3}(?:[.,]\d{1,2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTeamName(value: string) {
  return normalizeLine(value)
    .replace(/^[\s|,;:–—-]+|[\s|,;:–—-]+$/g, '')
    .trim()
    .slice(0, 80)
}

function isTeamCandidate(value: string) {
  const name = cleanTeamName(value)
  return name.length >= 2 &&
    name.length <= 60 &&
    /[\p{L}]/u.test(name) &&
    !TEAM_BLACKLIST.test(name) &&
    !/^(?:[1-3]|[12X])$/i.test(name)
}

function findInlineMatch(value: string) {
  const normalized = value.replace(KICKOFF_PATTERN, ' ').replace(DECIMAL_PATTERN, ' ')
    .replace(/\b(?:home|draw|away|over|under|btts|gg|ng|yes|no)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const match = INLINE_MATCH_PATTERN.exec(normalized)
  if (!match) return undefined
  const home = cleanTeamName(match[1])
  const away = cleanTeamName(match[2])
  if (!isTeamCandidate(home) || !isTeamCandidate(away) || home.toLocaleLowerCase() === away.toLocaleLowerCase()) return undefined
  return { home, away }
}

function findCandidates(lines: string[]) {
  const candidates: MatchCandidate[] = []
  for (let index = 0; index < lines.length && candidates.length < MAX_PARSED_FIXTURES; index += 1) {
    const inline = findInlineMatch(lines[index])
    if (inline) {
      candidates.push({ ...inline, lineIndex: index, lineCount: 1 })
      continue
    }

    const home = cleanTeamName(lines[index])
    const away = cleanTeamName(lines[index + 1] ?? '')
    if (!isTeamCandidate(home) || !isTeamCandidate(away) || home.toLocaleLowerCase() === away.toLocaleLowerCase()) continue
    const following = lines.slice(index + 2, index + 7).join(' ')
    if (!/(?:\d{1,3}[.,]\d{1,2}|1x2|1\s+x\s+2|over|under|btts|both teams|gg|ng)/i.test(following)) continue
    candidates.push({ home, away, lineIndex: index, lineCount: 2 })
    index += 1
  }
  return candidates
}

function extractPriceValues(line: string) {
  const withoutRates = line.replace(GOAL_RATE_PATTERN, ' ')
  const withoutTotals = withoutRates.replace(/\b(?:over|under|o|u)\s*[012]?[.,]?[05]\b/gi, ' ')
  const values: number[] = []
  for (const match of withoutTotals.matchAll(DECIMAL_PATTERN)) {
    const value = Number(match[0].replace(',', '.'))
    if (Number.isFinite(value) && value >= 1.01 && value <= 1000) values.push(value)
  }
  return values
}

function identifyMarkets(value: string, bothTeamsContext: boolean): Market[] {
  const normalized = value.trim().toLowerCase()
  const resultText = normalized.replace(/\b(?:over|under|o|u)\s*[12]?[.,]?[05]\b/gi, ' ').replace(DECIMAL_PATTERN, ' ')
  const markets: Market[] = []
  if (/\b(?:over|o)\s*[12]?[.,]?[05]\b/i.test(normalized)) {
    const total = /\b(?:over|o)\s*([12]?[.,]?[05])\b/i.exec(normalized)?.[1]?.replace(',', '.')
    if (total === '1.5' || total === '15') markets.push('over15')
    if (total === '2.5' || total === '25') markets.push('over25')
  }
  if (/\b(?:under|u)\s*[12]?[.,]?[05]\b/i.test(normalized)) {
    const total = /\b(?:under|u)\s*([12]?[.,]?[05])\b/i.exec(normalized)?.[1]?.replace(',', '.')
    if (total === '1.5' || total === '15') markets.push('under15')
    if (total === '2.5' || total === '25') markets.push('under25')
  }
  if (/\b(?:gg|yes)\b/i.test(normalized) || (bothTeamsContext && /\byes\b/i.test(normalized))) markets.push('bttsYes')
  if (/\b(?:ng|no)\b/i.test(normalized) || (bothTeamsContext && /\bno\b/i.test(normalized))) markets.push('bttsNo')

  const resultToken = /\b(?:home|draw|away|1|x|2)\b/gi
  for (const match of resultText.matchAll(resultToken)) {
    const token = match[0].toLowerCase()
    const market = token === 'home' || token === '1' ? 'home'
      : token === 'draw' || token === 'x' ? 'draw'
        : token === 'away' || token === '2' ? 'away'
          : undefined
    if (market && !markets.includes(market)) markets.push(market)
  }
  return markets
}

function extractMarketOdds(lines: string[]) {
  const odds: Partial<Record<Market, number>> = {}
  let bothTeamsContext = false
  let pendingMarkets: Market[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/\b(?:btts|both teams to score|both teams score)\b/i.test(line)) bothTeamsContext = true
    const markets = identifyMarkets(line, bothTeamsContext)
    const prices = extractPriceValues(line)

    if (markets.length > 0 && prices.length > 0) {
      markets.forEach((market, marketIndex) => {
        if (odds[market] === undefined && prices[marketIndex] !== undefined) odds[market] = prices[marketIndex]
      })
      pendingMarkets = []
      continue
    }

    if (markets.length > 0) {
      pendingMarkets = markets
      continue
    }

    if (prices.length > 0 && pendingMarkets.length > 0) {
      pendingMarkets.forEach((market, marketIndex) => {
        if (odds[market] === undefined && prices[marketIndex] !== undefined) odds[market] = prices[marketIndex]
      })
      pendingMarkets = []
      continue
    }

    if (prices.length >= 3) {
      RESULT_MARKETS.forEach((market, marketIndex) => {
        if (odds[market] === undefined) odds[market] = prices[marketIndex]
      })
    } else if (prices.length === 1 && index > 0) {
      const previousMarkets = identifyMarkets(lines[index - 1], bothTeamsContext)
      if (previousMarkets.length === 1 && odds[previousMarkets[0]] === undefined) odds[previousMarkets[0]] = prices[0]
    }
  }

  return odds
}

function extractGoalRate(lines: string[], label: 'home' | 'away') {
  const names = label === 'home' ? '(?:λ|lambda|home\\s+xg)' : '(?:μ|mu|away\\s+xg)'
  const pattern = new RegExp(`${names}\\s*[:=]?\\s*(\\d{1,2}(?:[.,]\\d{1,2})?)`, 'iu')
  for (const line of lines) {
    const match = pattern.exec(line)
    if (!match) continue
    const value = Number(match[1].replace(',', '.'))
    if (Number.isFinite(value) && value >= 0 && value <= 2.5) return value
  }
  return undefined
}

export function parseBetslipText(text: string): ParsedBetslipFixture[] {
  const lines = text.slice(0, MAX_OCR_TEXT_LENGTH).split(/\r?\n/)
    .map((line) => line.replace(/\b((?:over|under|o|u)\s*[12][.,]5)(?=\s*[1-9]\d?[.,]\d{1,2}\b)/gi, '$1 ')
      .trim())
    .filter(Boolean)
  const candidates = findCandidates(lines)
  const parsed: ParsedBetslipFixture[] = []
  const seen = new Set<string>()

  for (const [candidateIndex, candidate] of candidates.entries()) {
    const nextIndex = candidates[candidateIndex + 1]?.lineIndex ?? lines.length
    const end = Math.min(nextIndex, candidate.lineIndex + candidate.lineCount + 10)
    const context = lines.slice(candidate.lineIndex, end)
    const pairKey = `${candidate.home.toLocaleLowerCase()}\u0000${candidate.away.toLocaleLowerCase()}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)

    const precedingLine = lines[candidate.lineIndex - 1]
    const kickoff = [lines[candidate.lineIndex], precedingLine]
      .filter((line): line is string => Boolean(line))
      .map((line) => KICKOFF_PATTERN.exec(line)?.[0])
      .find(Boolean) ?? 'Kickoff TBD'
    const marketOdds = extractMarketOdds(context)
    const odds = RESULT_MARKETS.map((market) => marketOdds[market]).filter((value): value is number => value !== undefined)
    parsed.push({
      home: candidate.home,
      away: candidate.away,
      kickoff,
      odds,
      marketOdds,
      lambda: extractGoalRate(context, 'home'),
      mu: extractGoalRate(context, 'away'),
    })
  }

  return parsed
}
