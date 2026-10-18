// API-Football competition IDs covered on SportyBet Ghana.
export const SPORTYBET_LEAGUE_IDS = [
  // England
  39, // Premier League
  40, // Championship
  41, // League One
  45, // FA Cup
  48, // EFL Cup
  // Spain
  140, // La Liga
  141, // La Liga 2
  143, // Copa del Rey
  // Italy
  135, // Serie A
  136, // Serie B
  137, // Coppa Italia
  // Germany
  78, // Bundesliga
  79, // 2. Bundesliga
  81, // DFB Pokal
  // France
  61, // Ligue 1
  62, // Ligue 2
  // European competitions
  2, // UEFA Champions League
  3, // UEFA Europa League
  848, // UEFA Europa Conference League
  // Other major leagues
  88, // Netherlands Eredivisie
  94, // Portugal Primeira Liga
  253, // USA Major League Soccer
  71, // Brazil Serie A
  128, // Argentina Primera División
  288, // South Africa PSL
  570, // Ghana Premier League
]

export function isSportyBetLeague(leagueId: number | undefined) {
  return typeof leagueId === 'number' && SPORTYBET_LEAGUE_IDS.includes(leagueId)
}
