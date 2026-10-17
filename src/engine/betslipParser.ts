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

export type BatchParsedFixture = ParsedBetslipFixture & {
  index: number
  defaultedOdds: number
}

export const DEFAULT_MISSING_ODD = 2.5
const MAX_BATCH_FIXTURES = 50
const BATCH_PLACEHOLDER = '(?:tbd|n\\/a|na|covered|locked|suspended|lock|\\*+|🔒|[-–—])'
const BATCH_PLACEHOLDER_FIELD = new RegExp(`^${BATCH_PLACEHOLDER}$`, 'iu')
const BATCH_LABELLED_ODD = new RegExp(`(?<![\\w.])(1|x|2|home|draw|away)\\s*[:=@]\\s*(\\d{1,3}(?:[.,]\\d{1,2})?|${BATCH_PLACEHOLDER})(?![\\w.])`, 'giu')
const BATCH_TIME = /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:AM|PM))?(?![\w:])/i
const BATCH_DECIMAL = /(?<![\d.,])\d{1,3}[.,]\d{1,2}(?![\d])/g
const BATCH_VERSUS = /^(.+?)\s+(?:vs?\.?|[-–—])\s+(.+)$/iu
const BATCH_MARKET_WORDS = /\b(?:over|under|btts|gg|ng|both teams|double chance|correct score|handicap)\b/i
const BATCH_LABEL_PREFIX = /^\s*(?:time|kick.?off|ko|date)\s*[:\-]?/i

type OneXTwo = 'home' | 'draw' | 'away'

type ScannedLine = {
  index?: number
  texts: string[]
  labelled: Partial<Record<OneXTwo, number>>
  bare: number[]
  time?: string
  hasMarketWord: boolean
}

function toOdd(raw: string) {
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) && value >= 1.01 && value <= 1000 ? value : Number.NaN
}

function labelToMarket(label: string): OneXTwo {
  const key = label.toLowerCase()
  return key === '1' || key === 'home' ? 'home' : key === '2' || key === 'away' ? 'away' : 'draw'
}

function cleanBatchTeam(value: string) {
  return value
    .replace(/^[\s|,;:@–—-]+|[\s|,;:@–—-]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

function scanLine(rawLine: string): ScannedLine {
  let line = rawLine.trim()
  let index: number | undefined
  const numbered = /^(\d{1,3})\s*[.)]\s+(?=\S)/.exec(line)
  if (numbered) {
    index = Number(numbered[1])
    line = line.slice(numbered[0].length)
  }
  const delimited = /\t|\||,\s/.test(line)
  const fields = (delimited ? line.split(/\t|\||,\s+/) : [line]).map((field) => field.trim()).filter(Boolean)
  if (index === undefined && delimited && fields.length > 1 && /^\d{1,3}$/.test(fields[0])) {
    index = Number(fields.shift())
  }

  const scanned: ScannedLine = { index, texts: [], labelled: {}, bare: [], hasMarketWord: BATCH_MARKET_WORDS.test(line) }
  for (const field of fields) {
    let work = field
    work = work.replace(BATCH_LABELLED_ODD, (_all, label: string, value: string) => {
      const market = labelToMarket(label)
      if (scanned.labelled[market] === undefined) scanned.labelled[market] = BATCH_PLACEHOLDER_FIELD.test(value) ? Number.NaN : toOdd(value)
      return ' '
    })
    const time = BATCH_TIME.exec(work)
    if (time) {
      scanned.time ??= time[0].replace(/\s+/g, ' ').trim().toUpperCase()
      work = work.replace(BATCH_TIME, ' ')
    }
    work = work.trim()
    if (BATCH_PLACEHOLDER_FIELD.test(work)) {
      if (!/^[-–—]$/.test(work) || delimited) scanned.bare.push(Number.NaN)
      continue
    }
    if (!scanned.hasMarketWord) {
      for (const match of work.matchAll(BATCH_DECIMAL)) scanned.bare.push(toOdd(match[0]))
    }
    work = work.replace(BATCH_DECIMAL, ' ')
      .replace(BATCH_LABEL_PREFIX, ' ')
      .replace(new RegExp(`\\s+${BATCH_PLACEHOLDER}\\s*$`, 'iu'), ' ')
    work = cleanBatchTeam(work)
    if (/\p{L}/u.test(work)) scanned.texts.push(work)
  }
  return scanned
}

function findBatchTeams(scanned: ScannedLine) {
  let home: string | undefined
  let away: string | undefined
  if (scanned.texts.length === 1) {
    const match = BATCH_VERSUS.exec(scanned.texts[0])
    if (match) [home, away] = [cleanBatchTeam(match[1]), cleanBatchTeam(match[2])]
  } else if (scanned.texts.length >= 2) {
    const hasOddsOrIndex = scanned.index !== undefined || scanned.bare.length > 0 || Object.keys(scanned.labelled).length > 0
    if (hasOddsOrIndex) [home, away] = [cleanBatchTeam(scanned.texts[0]), cleanBatchTeam(scanned.texts[1])]
  }
  if (!home || !away || !isTeamCandidate(home) || !isTeamCandidate(away)) return undefined
  if (home.toLocaleLowerCase() === away.toLocaleLowerCase()) return undefined
  return { home, away }
}

/**
 * Parses pasted multi-line match lists: numbered fixtures with detail lines,
 * CSV/tab/pipe rows, and plain betslip summaries. Missing 1X2 odds fall back to 2.50.
 */
export function parseBatchMatchList(text: string): BatchParsedFixture[] {
  type Block = { index?: number; home: string; away: string; time?: string; labelled: ScannedLine['labelled']; bare: number[] }
  const blocks: Block[] = []
  let current: Block | undefined

  for (const rawLine of text.slice(0, MAX_OCR_TEXT_LENGTH).split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    const scanned = scanLine(rawLine)
    const teams = findBatchTeams(scanned)
    if (teams) {
      if (blocks.length >= MAX_BATCH_FIXTURES) break
      current = { index: scanned.index, ...teams, time: scanned.time, labelled: { ...scanned.labelled }, bare: [...scanned.bare] }
      blocks.push(current)
    } else if (current) {
      current.time ??= scanned.time
      for (const [market, value] of Object.entries(scanned.labelled) as [OneXTwo, number][]) {
        if (current.labelled[market] === undefined) current.labelled[market] = value
      }
      current.bare.push(...scanned.bare)
    }
  }

  const results: BatchParsedFixture[] = []
  const seen = new Set<string>()
  for (const block of blocks) {
    const key = `${block.home.toLocaleLowerCase()}\u0000${block.away.toLocaleLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const hasLabels = Object.keys(block.labelled).length > 0
    let defaultedOdds = 0
    const marketOdds: Partial<Record<Market, number>> = {}
    RESULT_MARKETS.forEach((market, position) => {
      const value = hasLabels ? block.labelled[market as OneXTwo] : block.bare[position]
      if (value !== undefined && Number.isFinite(value)) {
        marketOdds[market] = value
      } else {
        marketOdds[market] = DEFAULT_MISSING_ODD
        defaultedOdds += 1
      }
    })
    results.push({
      index: block.index ?? results.length + 1,
      home: block.home,
      away: block.away,
      kickoff: block.time ?? 'TBD',
      odds: RESULT_MARKETS.map((market) => marketOdds[market] as number),
      marketOdds,
      defaultedOdds,
    })
  }

  if (results.length > 0) return results
  return parseBetslipText(text).map((fixture, position) => {
    const marketOdds = { ...fixture.marketOdds }
    let defaultedOdds = 0
    for (const [offset, market] of RESULT_MARKETS.entries()) {
      const value = marketOdds[market] ?? fixture.odds[offset]
      if (value !== undefined) marketOdds[market] = value
      else {
        marketOdds[market] = DEFAULT_MISSING_ODD
        defaultedOdds += 1
      }
    }
    return {
      ...fixture,
      index: position + 1,
      kickoff: fixture.kickoff === 'Kickoff TBD' ? 'TBD' : fixture.kickoff,
      odds: RESULT_MARKETS.map((market) => marketOdds[market] as number),
      marketOdds,
      defaultedOdds,
    }
  })
}
