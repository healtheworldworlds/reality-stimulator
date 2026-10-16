export type ParsedBetslipFixture = {
  home: string
  away: string
  kickoff: string
  odds: number[]
  lambda?: number
  mu?: number
}

const MAX_OCR_TEXT_LENGTH = 20_000
const MAX_PARSED_FIXTURES = 20
const MATCHUP_PATTERN = /([\p{L}\p{N}][\p{L}\p{N}.'’&() -]{0,59}?)\s+(?:vs?\.?|v\.?)\s+([\p{L}\p{N}][\p{L}\p{N}.'’&() -]{0,59}?)\s*(?:\d{1,3}[.,]\d{1,2}|$)/iu
const KICKOFF_PATTERN = /\b(?:([01]?\d|2[0-3]):([0-5]\d))\b/
const DECIMAL_PATTERN = /\b\d{1,3}(?:[.,]\d{1,2})\b/g
const GOAL_RATE_PATTERN = /(?:λ|μ|lambda|mu|home\s+xg|away\s+xg)\s*[:=]?\s*\d{1,2}(?:[.,]\d{1,2})?/giu

function cleanTeamName(value: string) {
  return value
    .replace(KICKOFF_PATTERN, ' ')
    .replace(/(?:λ|μ|lambda|mu|home\s+xg|away\s+xg)\s*[:=]?/giu, ' ')
    .replace(/\b\d{1,3}[.,]\d{1,2}\b/g, ' ')
    .replace(/^[\s|,;:–—-]+|[\s|,;:–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function findMatchup(value: string) {
  return MATCHUP_PATTERN.exec(value.replace(KICKOFF_PATTERN, ' '))
}

function extractOdds(lines: string[]) {
  const odds: number[] = []
  for (const line of lines) {
    for (const token of line.replace(KICKOFF_PATTERN, ' ').replace(GOAL_RATE_PATTERN, ' ').matchAll(DECIMAL_PATTERN)) {
      const value = Number(token[0].replace(',', '.'))
      if (Number.isFinite(value) && value >= 1.01 && value <= 1000 && !odds.includes(value)) {
        odds.push(value)
        if (odds.length === 3) return odds
      }
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
  const lines = text.slice(0, MAX_OCR_TEXT_LENGTH).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const parsed: ParsedBetslipFixture[] = []
  const seen = new Set<string>()

  for (let index = 0; index < lines.length && parsed.length < MAX_PARSED_FIXTURES; index += 1) {
    const matchup = findMatchup(lines[index])
    if (!matchup) continue

    const home = cleanTeamName(matchup[1])
    const away = cleanTeamName(matchup[2])
    if (!home || !away || home.toLocaleLowerCase() === away.toLocaleLowerCase()) continue

    const pairKey = `${home.toLocaleLowerCase()}\u0000${away.toLocaleLowerCase()}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)

    const context = [lines[index]]
    for (let next = index + 1; next < Math.min(lines.length, index + 3); next += 1) {
      if (findMatchup(lines[next])) break
      context.push(lines[next])
    }
    const kickoff = [lines[index], ...(index > 0 && !findMatchup(lines[index - 1]) ? [lines[index - 1]] : [])]
      .map((line) => KICKOFF_PATTERN.exec(line)?.[0])
      .find(Boolean) ?? 'Kickoff TBD'
    parsed.push({
      home,
      away,
      kickoff,
      odds: extractOdds(context),
      lambda: extractGoalRate(context, 'home'),
      mu: extractGoalRate(context, 'away'),
    })
  }

  return parsed
}
