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

export const GLOBAL_CLUB_REGISTRY = {
  'Premier League': [
    'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion',
    'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Leeds United',
    'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
    'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur', 'West Ham United', 'Wolverhampton Wanderers',
  ],
  'La Liga': [
    'Athletic Club', 'Atlético Madrid', 'Barcelona', 'Celta Vigo', 'Deportivo Alavés',
    'Elche', 'Espanyol', 'Getafe', 'Girona', 'Levante', 'Mallorca', 'Osasuna',
    'Rayo Vallecano', 'Real Betis', 'Real Madrid', 'Real Oviedo', 'Real Sociedad',
    'Sevilla', 'Valencia', 'Villarreal',
  ],
  'Serie A': [
    'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Cremonese', 'Fiorentina', 'Genoa',
    'Hellas Verona', 'Inter Milan', 'Juventus', 'Lazio', 'Lecce', 'AC Milan',
    'Napoli', 'Parma', 'Pisa', 'Roma', 'Sassuolo', 'Torino', 'Udinese',
  ],
  Bundesliga: [
    'Augsburg', 'Bayer Leverkusen', 'Bayern Munich', 'Borussia Dortmund',
    'Borussia Mönchengladbach', 'Eintracht Frankfurt', 'FC Heidenheim', 'Hamburger SV',
    'Hoffenheim', 'Mainz 05', 'RB Leipzig', 'SC Freiburg', 'St. Pauli',
    'Union Berlin', 'VfB Stuttgart', 'VfL Wolfsburg', 'Werder Bremen', 'FC Köln',
  ],
  'Ligue 1': [
    'Angers', 'Auxerre', 'Brest', 'Le Havre', 'Lens', 'Lille', 'Lorient',
    'Lyon', 'Marseille', 'Metz', 'Monaco', 'Nantes', 'Nice', 'Paris FC',
    'Paris Saint-Germain', 'Rennes', 'Strasbourg', 'Toulouse',
  ],
  Eredivisie: [
    'Ajax', 'AZ Alkmaar', 'Excelsior', 'FC Groningen', 'FC Twente', 'FC Utrecht',
    'Feyenoord', 'Fortuna Sittard', 'Go Ahead Eagles', 'Heracles Almelo',
    'NAC Breda', 'NEC Nijmegen', 'PEC Zwolle', 'PSV Eindhoven', 'SC Heerenveen',
    'Sparta Rotterdam', 'Telstar', 'Willem II',
  ],
  'Primeira Liga': [
    'Arouca', 'AVS Futebol SAD', 'Benfica', 'Boavista', 'Casa Pia', 'Estoril',
    'Estrela da Amadora', 'FC Porto', 'Famalicão', 'Gil Vicente', 'Moreirense',
    'Nacional', 'Rio Ave', 'Santa Clara', 'Sporting CP', 'Tondela', 'Vitória de Guimarães',
  ],
  'Scottish Premiership': [
    'Aberdeen', 'Celtic', 'Dundee', 'Dundee United', 'Falkirk', 'Heart of Midlothian',
    'Hibernian', 'Kilmarnock', 'Livingston', 'Motherwell', 'Rangers', 'St Mirren',
  ],
  'Süper Lig': [
    'Alanyaspor', 'Antalyaspor', 'Başakşehir', 'Beşiktaş', 'Eyüpspor', 'Fatih Karagümrük',
    'Fenerbahçe', 'Galatasaray', 'Gaziantep FK', 'Gençlerbirliği', 'Göztepe',
    'Kasımpaşa', 'Kayserispor', 'Kocaelispor', 'Konyaspor', 'Rizespor',
    'Samsunspor', 'Trabzonspor',
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
