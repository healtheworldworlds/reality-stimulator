export type ClubMatchup = {
  competition: string
  home: string
  away: string
}

export function generateKickoffTimes(count: number, start: number, end: number, random: () => number = Math.random): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    throw new RangeError('Generated kickoff count must be an integer between 1 and 30.')
  }
  if (!Number.isInteger(start) || start < 0 || start >= 1440 || !Number.isInteger(end) || end < 0 || end >= 1440) {
    throw new RangeError('Kickoff times must be integer minutes within a day.')
  }

  const duration = end >= start ? end - start : end + 1440 - start
  return Array.from({ length: count }, (_, index) => {
    const lower = Math.floor((index * duration) / count)
    const upper = index === count - 1
      ? duration
      : Math.floor(((index + 1) * duration) / count) - 1
    const draw = random()
    assertRandomValue(draw)
    const offset = upper < lower ? lower : lower + Math.floor(draw * (upper - lower + 1))
    const minute = (start + offset) % 1440
    return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  })
}

// Marquee clubs from SportyBet-covered leagues only, so fallback pairings are always bookable.
export const GLOBAL_CLUB_REGISTRY = {
  'Premier League': [
    'Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United',
    'Newcastle United', 'Tottenham Hotspur', 'Aston Villa', 'West Ham United',
  ],
  'La Liga': [
    'Real Madrid', 'Barcelona', 'Atl?tico Madrid', 'Sevilla', 'Real Sociedad',
    'Athletic Club', 'Villarreal', 'Real Betis',
  ],
  'Serie A': [
    'Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina',
  ],
  Bundesliga: [
    'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
    'Eintracht Frankfurt', 'VfB Stuttgart', 'Borussia M?nchengladbach', 'VfL Wolfsburg',
  ],
  'Ligue 1': [
    'Paris Saint-Germain', 'Marseille', 'Lyon', 'Monaco', 'Lille', 'Nice', 'Lens', 'Rennes',
  ],
  Eredivisie: [
    'Ajax', 'PSV Eindhoven', 'Feyenoord', 'AZ Alkmaar', 'FC Twente', 'FC Utrecht',
  ],
  'Primeira Liga': [
    'Benfica', 'FC Porto', 'Sporting CP', 'Braga', 'Vit?ria de Guimar?es', 'Boavista',
  ],
} as const

function assertRandomValue(value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a finite value in the range [0, 1).')
  }
}

export function generateUniqueClubMatchups(count: number, random: () => number = Math.random): ClubMatchup[] {
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    throw new RangeError('Generated match count must be an integer between 1 and 30.')
  }

  const candidates: ClubMatchup[] = []
  for (const [competition, clubs] of Object.entries(GLOBAL_CLUB_REGISTRY)) {
    for (let homeIndex = 0; homeIndex < clubs.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < clubs.length; awayIndex += 1) {
        candidates.push({
          competition,
          home: clubs[homeIndex],
          away: clubs[awayIndex],
        })
      }
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const draw = random()
    assertRandomValue(draw)
    const swapIndex = Math.floor(draw * (index + 1))
    ;[candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]]
  }

  return candidates.slice(0, count).map((matchup) => {
    const draw = random()
    assertRandomValue(draw)
    return draw < 0.5
      ? matchup
      : { ...matchup, home: matchup.away, away: matchup.home }
  })
}
