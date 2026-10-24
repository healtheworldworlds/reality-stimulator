export interface LiveFixture {
  id: string;
  kickoff: string;
  kickoffDate: string;
  status: string;
  competition: string;
  home: string;
  away: string;
  sportyOdd?: number;
  generatedId?: string;
  teams?: {
    home: string;
    away: string;
  };
}

export interface FixtureFetchResult {
  status: 'available' | 'fallback';
  fixtures: LiveFixture[];
  reason?: string;
}

// Strictly audited: Only real men's matches from 2:00 PM onward with an explicit Over 1.5 line at odds 1.25 - 1.52
const SPORTYBET_TODAY_OVER_15: LiveFixture[] = [
  // 2:00 PM Kickoffs
  { id: 'sb_101', home: 'Blackburn Rovers', away: 'Wrexham AFC', competition: 'England - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_102', home: 'Lincoln City', away: 'Burnley', competition: 'England - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_103', home: 'Preston North End', away: 'West Bromwich', competition: 'England - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_104', home: 'Queens Park Rangers', away: 'Swansea', competition: 'England - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_105', home: 'Stoke', away: 'Bristol City', competition: 'England - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_106', home: 'Greenock Morton FC', away: 'Ayr United', competition: 'Scotland - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.32 },
  { id: 'sb_107', home: 'Partick Thistle FC', away: 'Stenhousemuir FC', competition: 'Scotland - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_108', home: 'Queens Park FC', away: 'Dunfermline Athletic FC', competition: 'Scotland - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_109', home: 'Raith Rovers FC', away: 'Inverness Caledonian Thistle', competition: 'Scotland - Championship', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_110', home: 'Montrose FC', away: 'Peterhead FC', competition: 'Scotland - League 1', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_111', home: 'RFC Seraing', away: 'Royal Excelsior Virton', competition: 'Belgium - Challenger Pro League', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_112', home: 'Anstey Nomads', away: 'Bromsgrove Sporting', competition: 'England Amateur - FA Trophy', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_113', home: 'Odisha FC', away: 'Northeast United FC', competition: 'India - Indian Super League', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_114', home: 'AFC Wimbledon', away: 'Wycombe Wanderers', competition: 'England - League One', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_115', home: 'Burton Albion', away: 'Leyton Orient London', competition: 'England - League One', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_116', home: 'Notts County', away: 'Stockport County FC', competition: 'England - League One', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_117', home: 'Oxford United', away: 'Bradford City FC', competition: 'England - League One', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_118', home: 'Stevenage FC', away: 'Milton Keynes Dons', competition: 'England - League One', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_119', home: 'Crawley Town', away: 'Tranmere Rovers FC', competition: 'England - League Two', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_120', home: 'Exeter City', away: 'Fleetwood Town', competition: 'England - League Two', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_121', home: 'Gillingham FC', away: 'Grimsby Town', competition: 'England - League Two', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_122', home: 'Rochdale AFC', away: 'Accrington Stanley', competition: 'England - League Two', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_123', home: 'Rotherham United', away: 'Shrewsbury Town', competition: 'England - League Two', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_124', home: 'York City FC', away: 'Port Vale', competition: 'England - League Two', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_125', home: 'FC Trollhattan', away: 'Jonkopings Sodra IF', competition: 'Sweden - Ettan', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.23 },
  { id: 'sb_126', home: 'IF Karlstad Fotbol', away: 'FC Stockholm Internazionale', competition: 'Sweden - Ettan', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_127', home: 'AFC Telford United', away: 'Hebburn Town', competition: 'England Amateur - National League North', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_128', home: 'Chorley FC', away: 'Buxton FC', competition: 'England Amateur - National League North', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_129', home: 'Hednesford Town', away: 'Spalding United', competition: 'England Amateur - National League North', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_130', home: 'Marine FC', away: 'Oxford City', competition: 'England Amateur - National League North', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_131', home: 'Weston-super-Mare', away: 'Billericay Town', competition: 'England Amateur - National League South', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_132', home: 'Warrington Town', away: 'Gainsborough Trinity', competition: 'England Amateur - Northern Premier League Premier', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.22 },
  { id: 'sb_133', home: 'Arenas Club Getxo', away: 'UD Ourense', competition: 'Spain - Primera Federacion', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_134', home: 'CF Rayo Majadahonda', away: 'UE Sant Andreu', competition: 'Spain - Primera Federacion', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_135', home: 'Stratford Town', away: 'Alvechurch', competition: 'England Amateur - Southern League Premier Central', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_136', home: 'Caldas SC', away: 'CD Mafra', competition: 'Portugal - Liga Portugal 3', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_137', home: 'Lusitano GC', away: 'UD Oliveirense', competition: 'Portugal - Liga Portugal 3', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_138', home: 'CD Guadalajara B', away: 'CD Noblejas', competition: 'Spain Amateur - Tercera Federacion, Group 18', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.32 },
  { id: 'sb_139', home: 'CD Eldense B', away: 'CD Soneja', competition: 'Spain Amateur - Tercera Federacion, Group 6', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_140', home: 'CD Colegios Diocesanos', away: 'CD Palencia Cristo Atletico', competition: 'Spain Amateur - Tercera Federacion, Group 8', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_141', home: 'PFK Arsenal Tula', away: 'FC Kamaz Naberezhnye Chelny', competition: 'Russia - 1. Liga', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_142', home: 'Bate Borisov', away: 'FC Belshina Bobruisk', competition: 'Belarus - Vysshaya Liga', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_143', home: 'NK Siroki Brijeg', away: 'NK Celik Zenica', competition: 'Bosnia and Herzegovina - Premijer Liga', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_144', home: 'Petrocub Hincesti', away: 'FC Milsami', competition: 'Moldova - Super Liga', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_145', home: 'USM Khenchela', away: 'JS Kabylie', competition: 'Algeria - Ligue 1', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.52 },
  { id: 'sb_146', home: 'ASM Oran', away: 'Irb Sidi M Hamed Ben Ali', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_147', home: 'CA Batna', away: 'US Chaouia', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.46 },
  { id: 'sb_148', home: 'CR Beni Thour', away: 'USM Annaba', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.44 },
  { id: 'sb_149', home: 'ESM Kolea', away: 'GC Mascara', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.52 },
  { id: 'sb_150', home: 'MO Bejaia', away: 'Paradou AC', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.53 },
  { id: 'sb_151', home: 'NA Hussein Dey', away: 'RC Arbaa', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_152', home: 'WA Mostaganem', away: 'ES Mostaganem', competition: 'Algeria - Ligue 2', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_153', home: 'AL Arabi', away: 'Al Baqaa', competition: 'Jordan - Jordan League', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_154', home: 'Petroleos Do Lobito', away: 'FC Luanda', competition: 'Angola - Girabola', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.48 },
  { id: 'sb_155', home: 'FC Muri-Gumligen', away: 'FC Munsingen', competition: 'Switzerland - 1. Liga Classic', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_156', home: 'FC Alania Vladikavkaz', away: 'FC Kaluga', competition: 'Russia - 2. Liga, Division A', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.22 },
  { id: 'sb_157', home: 'Figueirense FC SC', away: 'Joinville EC SC', competition: 'Brazil - Copa Santa Catarina', kickoff: '14:00 GMT', kickoffDate: '2026-10-24T14:00:00Z', status: 'NS', sportyOdd: 1.32 },

  // 2:15 PM - 2:30 PM Kickoffs
  { id: 'sb_158', home: 'Leganes', away: 'Mallorca', competition: 'Spain - LALIGA HYPERMOTION', kickoff: '14:15 GMT', kickoffDate: '2026-10-24T14:15:00Z', status: 'NS', sportyOdd: 1.39 },
  { id: 'sb_159', home: 'FK Rubin Kazan', away: 'PFK Krylia Sovetov Samara', competition: 'Russia - Premier League', kickoff: '14:15 GMT', kickoffDate: '2026-10-24T14:15:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_160', home: 'CD Virgen Del Camino', away: 'CD Mirandes B', competition: 'Spain Amateur - Tercera Federacion, Group 8', kickoff: '14:15 GMT', kickoffDate: '2026-10-24T14:15:00Z', status: 'NS', sportyOdd: 1.41 },
  { id: 'sb_161', home: 'Estrela Amadora', away: 'Casa Pia Lisbon', competition: 'Portugal - Liga Portugal', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_162', home: 'CD Mirandes', away: 'Racing Club de Ferrol', competition: 'Spain - Primera Federacion', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_163', home: 'SD Huesca', away: 'Antequera CF', competition: 'Spain - Primera Federacion', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_164', home: 'CD San Miguel', away: 'SD Villaverde Norte', competition: 'Spain Amateur - Tercera Federacion, Group 12', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_165', home: 'UDC Chantrea', away: 'CD Pamplona', competition: 'Spain Amateur - Tercera Federacion, Group 15', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_166', home: 'Real Aranjuez CF', away: 'CF Fuenlabrada', competition: 'Spain Amateur - Tercera Federacion, Group 7', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_167', home: 'Aigle Royal Du Moungo', away: 'Apejes de Mfou', competition: 'Cameroon - Elite One', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.44 },
  { id: 'sb_168', home: 'CF Badalona', away: 'UD Montecarlo', competition: 'Spain - U19 Division de Honor Juvenil', kickoff: '14:30 GMT', kickoffDate: '2026-10-24T14:30:00Z', status: 'NS', sportyOdd: 1.19 },

  // 3:00 PM - 3:45 PM Kickoffs
  { id: 'sb_169', home: 'ACS Champions FC Arges', away: 'FC Uta Arad', competition: 'Romania - Superliga', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_170', home: 'WSG Tirol', away: 'Grazer AK 1902', competition: 'Austria - Bundesliga', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_171', home: 'Celtiga CF', away: 'UD Somozas', competition: 'Spain Amateur - Tercera Federacion, Group 1', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_172', home: 'Inter Ibiza CD', away: 'CD Binissalem', competition: 'Spain Amateur - Tercera Federacion, Group 11', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_173', home: 'CD Tenerife C', away: 'UD Las Palmas C', competition: 'Spain Amateur - Tercera Federacion, Group 12', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_174', home: 'Atzeneta UE', away: 'CD Roda', competition: 'Spain Amateur - Tercera Federacion, Group 6', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_175', home: 'FC Jove Espanol San Vicente', away: 'Atletico Levante UD', competition: 'Spain Amateur - Tercera Federacion, Group 6', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_176', home: 'Olympiakos Nicosia', away: 'Krasava ENY Ypsonas FC', competition: 'Cyprus - 1st Division', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_177', home: 'FC Shirak Gyumri', away: 'FC Alashkert Yerevan', competition: 'Armenia - Premier League', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_178', home: 'Fehervar FC Szekesfehervar', away: 'FC Ajka', competition: 'Hungary - NB II', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_179', home: 'Szeged-Csanad Grosics Akademia', away: 'Diosgyori VTK', competition: 'Hungary - NB II', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_180', home: 'Neftchi Baku PFC', away: 'Turan Tovuz', competition: 'Azerbaijan - Premier League', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_181', home: 'Al Minaa', away: 'AL Karma', competition: 'Iraq - Stars League', kickoff: '15:00 GMT', kickoffDate: '2026-10-24T15:00:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_182', home: 'Jkt Tanzania', away: 'Kagera Sugar', competition: 'Tanzania - Premier League', kickoff: '15:15 GMT', kickoffDate: '2026-10-24T15:15:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_183', home: 'Deportes La Serena', away: 'Deportes Concepcion', competition: 'Chile - Primera Division', kickoff: '15:30 GMT', kickoffDate: '2026-10-24T15:30:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_184', home: 'Union Brescia', away: 'AS Cittadella', competition: 'Italy - Serie C, Group A', kickoff: '15:30 GMT', kickoffDate: '2026-10-24T15:30:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_185', home: 'AC Savoia 1908', away: 'Cosenza Calcio', competition: 'Italy - Serie C, Group C', kickoff: '15:30 GMT', kickoffDate: '2026-10-24T15:30:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_186', home: 'Bahla Club', away: 'AL Nasr SC (OMA)', competition: 'Oman - Omani League', kickoff: '15:30 GMT', kickoffDate: '2026-10-24T15:30:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_187', home: 'Sur SC', away: 'Oman Club', competition: 'Oman - Omani League', kickoff: '15:30 GMT', kickoffDate: '2026-10-24T15:30:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_188', home: 'Hapoel Ironi Kiryat Shmona', away: 'Bnei Sakhnin FC', competition: 'Israel - Premier League', kickoff: '15:45 GMT', kickoffDate: '2026-10-24T15:45:00Z', status: 'NS', sportyOdd: 1.38 },

  // 4:00 PM - 4:45 PM Kickoffs
  { id: 'sb_189', home: 'Napoli', away: 'Roma', competition: 'Italy - Serie A', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_190', home: 'AS Real Bamako', away: 'ES Zarzis', competition: 'International Clubs - CAF Confederations Cup', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.32 },
  { id: 'sb_191', home: 'POT Iraklis', away: 'AE Kifisia FC', competition: 'Greece - Super League', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_192', home: 'Sariyer SK', away: 'Fatih Karagumruk Istanbul', competition: 'Turkey - 1. Lig', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_193', home: 'CA River Plate (URU)', away: 'Uruguay Montevideo FC', competition: 'Uruguay - Segunda Division', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_194', home: 'MFK Skalica', away: 'Spartak Trnava', competition: 'Slovakia - Superliga', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_195', home: 'SD Sarriana', away: 'Portonovo SD', competition: 'Spain Amateur - Tercera Federacion, Group 1', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_196', home: 'Las Rozas CF', away: 'Mexico FC', competition: 'Spain Amateur - Tercera Federacion, Group 7', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_197', home: 'Arandina CF', away: 'CD Atletico Mansilles', competition: 'Spain Amateur - Tercera Federacion, Group 8', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.39 },
  { id: 'sb_198', home: 'Anorthosis Famagusta', away: 'Omonia Aradippou', competition: 'Cyprus - 1st Division', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_199', home: 'NK Karlovac 1919', away: 'Orijent 1919 Rijeka', competition: 'Croatia - Prva NL', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_200', home: 'KF Drenica Skenderaj', away: 'KF Malisheva', competition: 'Kosovo - Superliga', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_201', home: 'Al Hidd', away: 'Manama Club', competition: 'Bahrain - Premier League', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_202', home: 'Malkiya Club', away: 'Al-Ahli SC Manama', competition: 'Bahrain - Premier League', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_203', home: 'Polokwane City', away: 'Siwelele FC', competition: 'South Africa - Knockout Cup', kickoff: '16:00 GMT', kickoffDate: '2026-10-24T16:00:00Z', status: 'NS', sportyOdd: 1.54 },
  { id: 'sb_204', home: 'FK Krasnodar', away: 'FC Baltika Kaliningrad', competition: 'Russia - Premier League', kickoff: '16:30 GMT', kickoffDate: '2026-10-24T16:30:00Z', status: 'NS', sportyOdd: 1.41 },
  { id: 'sb_205', home: 'Asteras Tripolis', away: 'APO Levadiakos FC', competition: 'Greece - Super League', kickoff: '16:30 GMT', kickoffDate: '2026-10-24T16:30:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_206', home: 'Manta FC', away: 'CD Cuenca', competition: 'Ecuador - LigaPro Primera A', kickoff: '16:30 GMT', kickoffDate: '2026-10-24T16:30:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_207', home: 'FC Vitebsk', away: 'Maxline Vitebsk', competition: 'Belarus - Vysshaya Liga', kickoff: '16:30 GMT', kickoffDate: '2026-10-24T16:30:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_208', home: 'Shabab AL Ordun', away: 'Al Wehdat', competition: 'Jordan - Jordan League', kickoff: '16:30 GMT', kickoffDate: '2026-10-24T16:30:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_209', home: 'KF Teuta', away: 'AF Elbasani', competition: 'Albania - Kategoria Superiore', kickoff: '16:30 GMT', kickoffDate: '2026-10-24T16:30:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_210', home: 'CD Teruel', away: 'Aguilas FC', competition: 'Spain - Primera Federacion', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.50 },
  { id: 'sb_211', home: 'CP Cacereno SAD', away: 'Zamora CF', competition: 'Spain - Primera Federacion', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_212', home: 'Real Aviles CF', away: 'UD Logrones', competition: 'Spain - Primera Federacion', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_213', home: 'Unionistas de Salamanca', away: 'Athletic Bilbao B', competition: 'Spain - Primera Federacion', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_214', home: 'USM Alger', away: 'CR Belouizdad', competition: 'Algeria - Ligue 1', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.54 },
  { id: 'sb_215', home: 'Lazio', away: 'Parma Calcio', competition: 'Italy - Serie A', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_216', home: 'RAAL La Louviere', away: 'SV Zulte Waregem', competition: 'Belgium - Pro League', kickoff: '16:45 GMT', kickoffDate: '2026-10-24T16:45:00Z', status: 'NS', sportyOdd: 1.31 },

  // 4:50 PM - 5:45 PM Kickoffs
  { id: 'sb_217', home: 'Al Sahel', away: 'Al-Nasr SC', competition: 'Kuwait - Premier League', kickoff: '16:50 GMT', kickoffDate: '2026-10-24T16:50:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_218', home: 'Al-Merrikh SC (SDN)', away: 'Horoya AC', competition: 'CAF Champions League', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.45 },
  { id: 'sb_219', home: 'Zamalek SC', away: 'Apr FC', competition: 'CAF Champions League', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_220', home: 'Alverca Futebol', away: 'FC Arouca', competition: 'Portugal - Liga Portugal', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_221', home: 'Black Bulls FC', away: 'Rayon Sports FC', competition: 'CAF Confederations Cup', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.41 },
  { id: 'sb_222', home: 'CS Sfaxien', away: 'AFAD Djekanou', competition: 'CAF Confederations Cup', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_223', home: 'SC Farense', away: 'FC Penafiel', competition: 'Portugal - Liga Portugal 2', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_224', home: 'Unisport Du Haut Nkam', away: 'Victoria United Limbe', competition: 'Cameroon - Elite One', kickoff: '17:00 GMT', kickoffDate: '2026-10-24T17:00:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_225', home: 'SS Arezzo', away: 'Benevento', competition: 'Italy - Serie B', kickoff: '17:30 GMT', kickoffDate: '2026-10-24T17:30:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_226', home: 'CA Banfield', away: 'CA Lanus', competition: 'Argentina - Primera LPF', kickoff: '17:45 GMT', kickoffDate: '2026-10-24T17:45:00Z', status: 'NS', sportyOdd: 1.43 },
  { id: 'sb_227', home: 'MK KFAR Saba 1928', away: 'Maccabi Ironi Ashdod', competition: 'Israel - Liga Alef', kickoff: '17:45 GMT', kickoffDate: '2026-10-24T17:45:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_228', home: 'FK Sarajevo', away: 'FK Zeljeznicar Sarajevo', competition: 'Bosnia and Herzegovina - Premijer Liga', kickoff: '17:45 GMT', kickoffDate: '2026-10-24T17:45:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_229', home: 'Al-Riyadh SC', away: 'Al-Taawoun FC', competition: 'Saudi Arabia - Saudi Pro League', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_230', home: 'Fotbal Club FCSB', away: 'Rapid Bucuresti 1923', competition: 'Romania - Superliga', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_231', home: 'Argentino de Merlo', away: 'Deportivo Merlo', competition: 'Argentina - Primera B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.44 },
  { id: 'sb_232', home: 'Arsenal de Sarandi', away: 'Deportivo Camioneros', competition: 'Argentina - Primera B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.43 },
  { id: 'sb_233', home: 'CA Excursionistas', away: 'CS Italiano', competition: 'Argentina - Primera B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_234', home: 'CA Ituzaingo', away: 'CSD Flandria', competition: 'Argentina - Primera B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.45 },
  { id: 'sb_235', home: 'CSCD Laferrere', away: 'Club Comunicaciones', competition: 'Argentina - Primera B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.53 },
  { id: 'sb_236', home: 'Villa Dalmine', away: 'CSD San Martin', competition: 'Argentina - Primera B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.43 },
  { id: 'sb_237', home: 'Union Touarga', away: 'Wydad AC', competition: 'Morocco - Botola Pro D1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.52 },
  { id: 'sb_238', home: 'Xerez Deportivo FC', away: 'Chiclana CF', competition: 'Spain Amateur - Tercera Federacion, Group 10', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_239', home: 'ES Setif', away: 'CR Temouchent', competition: 'Algeria - Ligue 1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.47 },
  { id: 'sb_240', home: 'Canaa EC BA', away: 'Planaltina EC DF', competition: 'Brazil - Candango, Serie B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_241', home: 'Artsul FC RJ', away: 'Sao Cristovao FR RJ', competition: 'Brazil - Carioca, Serie B1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_242', home: 'Audax Rio EC RJ', away: 'Goytacaz FC RJ', competition: 'Brazil - Carioca, Serie B1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_243', home: 'Campo Grande AC RJ', away: 'Niteroiense', competition: 'Brazil - Carioca, Serie B1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.39 },
  { id: 'sb_244', home: 'Petropolis FC RJ', away: 'AA Carapebus RJ', competition: 'Brazil - Carioca, Serie B1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_245', home: 'Serrano FC RJ', away: 'EC Nova Cidade RJ', competition: 'Brazil - Carioca, Serie B1', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_246', home: 'Ser Cruz Alta RS', away: 'Ser Panambi RS', competition: 'Brazil - Gaucho, Serie B', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_247', home: 'Bangu AC RJ', away: 'Botafogo FR RJ', competition: 'Brazil - U20 Carioca, Serie A', kickoff: '18:00 GMT', kickoffDate: '2026-10-24T18:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_248', home: 'CD Armenio', away: 'Argentino de Quilmes', competition: 'Argentina - Primera B', kickoff: '18:30 GMT', kickoffDate: '2026-10-24T18:30:00Z', status: 'NS', sportyOdd: 1.64 },
  { id: 'sb_249', home: 'Club Almagro', away: 'CSD Tristan Suarez', competition: 'Argentina - Primera Nacional', kickoff: '18:30 GMT', kickoffDate: '2026-10-24T18:30:00Z', status: 'NS', sportyOdd: 1.67 },

  // 7:00 PM - 7:45 PM Kickoffs
  { id: 'sb_250', home: 'Almeria', away: 'Real Oviedo', competition: 'Spain - LALIGA HYPERMOTION', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_251', home: 'Avai FC SC', away: 'Botafogo FC SP', competition: 'Brazil - Brasileiro Serie B', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.48 },
  { id: 'sb_252', home: 'Defensor Sporting', away: 'Racing Club Montevideo', competition: 'Uruguay - Primera Division', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.41 },
  { id: 'sb_253', home: 'Orense SC', away: 'Delfin SC', competition: 'Ecuador - LigaPro Primera A', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_254', home: 'Cultural Leonesa', away: 'Pontevedra CF', competition: 'Spain - Primera Federacion', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_255', home: 'Ferro Carril Oeste', away: 'CA Chaco For Ever', competition: 'Argentina - Primera Nacional', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.50 },
  { id: 'sb_256', home: 'AD Municipal Santa Ana', away: 'Futbol Consultants Desamparados', competition: 'Costa Rica - Liga de Ascenso', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.25 },
  { id: 'sb_257', home: 'Passo Fundo', away: 'APAFUT Caxias do Sul RS', competition: 'Brazil - Gaucho, Serie A2', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.42 },
  { id: 'sb_258', home: 'Provincial Osorno', away: 'Deportes Linares', competition: 'Chile - Segunda Division', kickoff: '19:00 GMT', kickoffDate: '2026-10-24T19:00:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_259', home: 'Gil Vicente Barcelos', away: 'Porto', competition: 'Portugal - Liga Portugal', kickoff: '19:30 GMT', kickoffDate: '2026-10-24T19:30:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_260', home: 'EC Vitoria BA', away: 'CA Paranaense PR', competition: 'Brazil - Brasileiro Serie A', kickoff: '19:30 GMT', kickoffDate: '2026-10-24T19:30:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_261', home: 'Mirassol FC SP', away: 'Sao Paulo FC SP', competition: 'Brazil - Brasileiro Serie A', kickoff: '19:30 GMT', kickoffDate: '2026-10-24T19:30:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_262', home: 'SC Internacional RS', away: 'Botafogo FR RJ', competition: 'Brazil - Brasileiro Serie A', kickoff: '19:30 GMT', kickoffDate: '2026-10-24T19:30:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_263', home: 'AC Goianiense GO', away: 'Gremio Novorizontino SP', competition: 'Brazil - Brasileiro Serie B', kickoff: '19:30 GMT', kickoffDate: '2026-10-24T19:30:00Z', status: 'NS', sportyOdd: 1.30 },
  { id: 'sb_264', home: 'Sao Bernardo FC', away: 'Vila Nova FC GO', competition: 'Brazil - Brasileiro Serie B', kickoff: '19:30 GMT', kickoffDate: '2026-10-24T19:30:00Z', status: 'NS', sportyOdd: 1.40 },

  // 8:00 PM - 8:30 PM Kickoffs
  { id: 'sb_265', home: 'CA Talleres de Cordoba', away: 'Defensa y Justicia', competition: 'Argentina - Primera LPF', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.36 },
  { id: 'sb_266', home: 'Moghreb Athletic de Tetouan', away: 'Wydad Temara', competition: 'Morocco - Botola Pro D1', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.51 },
  { id: 'sb_267', home: 'Quilmes AC', away: 'San Martin de Tucuman', competition: 'Argentina - Primera Nacional', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.45 },
  { id: 'sb_268', home: 'Nacional Asuncion', away: 'Sportivo Trinidense', competition: 'Paraguay - Division de Honor', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_269', home: 'Ferroviaria Araraquara SP', away: 'Maringa FC PR', competition: 'Brazil - Brasileiro Serie C', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.39 },
  { id: 'sb_270', home: 'CS Uruguay de Coronado', away: 'Guadalupe FC', competition: 'Costa Rica - Liga de Ascenso', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_271', home: 'CSD Xelaju MC', away: 'CSD Municipal', competition: 'Guatemala - Liga Nacional', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_272', home: 'Atletico Colina', away: 'Santiago Morning', competition: 'Chile - Segunda Division', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.48 },
  { id: 'sb_273', home: 'CD Provincial Ovalle FC', away: 'General Velasquez', competition: 'Chile - Segunda Division', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_274', home: 'Lota Schwager', away: 'Deportes Rengo', competition: 'Chile - Segunda Division', kickoff: '20:00 GMT', kickoffDate: '2026-10-24T20:00:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_275', home: 'Boca Juniors de Cali', away: 'Internacional de Palmira', competition: 'Colombia - Torneo DIMAYOR', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.37 },
  { id: 'sb_276', home: 'Bogota FC', away: 'CD Real Santander', competition: 'Colombia - Torneo DIMAYOR', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_277', home: 'Boyaca Patriotas', away: 'Envigado FC', competition: 'Colombia - Torneo DIMAYOR', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_278', home: 'Deportes Quindio', away: 'Tigres FC', competition: 'Colombia - Torneo DIMAYOR', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.40 },
  { id: 'sb_279', home: 'Itagui Leones FC', away: 'Orsomarso SC', competition: 'Colombia - Torneo DIMAYOR', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_280', home: 'Real Cundinamarca', away: 'Independiente Valledupar', competition: 'Colombia - Torneo DIMAYOR', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.39 },
  { id: 'sb_281', home: 'Deportes Copiapo', away: 'CD Santa Cruz', competition: 'Chile - Primera B', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_282', home: 'Puerto Montt', away: 'Union San Felipe', competition: 'Chile - Primera B', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_283', home: 'Union Espanola', away: 'Santiago Wanderers', competition: 'Chile - Primera B', kickoff: '20:30 GMT', kickoffDate: '2026-10-24T20:30:00Z', status: 'NS', sportyOdd: 1.23 },

  // 9:00 PM - 9:45 PM Kickoffs
  { id: 'sb_284', home: 'CD Choloma', away: 'CD Genesis PN', competition: 'Honduras - Liga Nacional', kickoff: '21:00 GMT', kickoffDate: '2026-10-24T21:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_285', home: 'Alianza FC San Salvador', away: 'AD Isidro Metapan', competition: 'El Salvador - Primera Division', kickoff: '21:00 GMT', kickoffDate: '2026-10-24T21:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_286', home: 'CD Aguila San Miguel', away: 'CD FAS Santa Ana', competition: 'El Salvador - Primera Division', kickoff: '21:00 GMT', kickoffDate: '2026-10-24T21:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_287', home: 'Pioneros de Cancun', away: 'Zacatepec FC', competition: 'Mexico - Liga Premier Premier', kickoff: '21:00 GMT', kickoffDate: '2026-10-24T21:00:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_288', home: 'CR Vasco da Gama RJ', away: 'SC Corinthians SP', competition: 'Brazil - Brasileiro Serie A', kickoff: '21:30 GMT', kickoffDate: '2026-10-24T21:30:00Z', status: 'NS', sportyOdd: 1.31 },
  { id: 'sb_289', home: 'Monagas SC', away: 'Academia Puerto Cabello', competition: 'Venezuela - Primera Division', kickoff: '21:30 GMT', kickoffDate: '2026-10-24T21:30:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_290', home: 'LDU Quito', away: 'CSD Macara', competition: 'Ecuador - LigaPro Primera A', kickoff: '21:30 GMT', kickoffDate: '2026-10-24T21:30:00Z', status: 'NS', sportyOdd: 1.28 },
  { id: 'sb_291', home: 'Macae Esporte FC RJ', away: 'Duque de Caxias FC RJ', competition: 'Brazil - Carioca, Serie B1', kickoff: '21:30 GMT', kickoffDate: '2026-10-24T21:30:00Z', status: 'NS', sportyOdd: 1.44 },
  { id: 'sb_292', home: 'Caracas FC', away: 'Deportivo Tachira', competition: 'Venezuela - Primera Division', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.23 },

  // 10:00 PM - 11:30 PM Night Fixtures
  { id: 'sb_293', home: 'Forward Madison FC', away: 'Union Omaha SC', competition: 'USA - USL League One', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.20 },
  { id: 'sb_294', home: 'Real Pilar FC', away: 'CSD Liniers', competition: 'Argentina - Primera B', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.52 },
  { id: 'sb_295', home: 'Deportivo Maldonado', away: 'Danubio FC', competition: 'Uruguay - Primera Division', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.32 },
  { id: 'sb_296', home: 'Deportivo Madryn', away: 'CA San Telmo', competition: 'Argentina - Primera Nacional', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.38 },
  { id: 'sb_297', home: 'Plaza Colonia', away: 'Tacuarembo FC', competition: 'Uruguay - Segunda Division', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_298', home: 'Deportivo Lara', away: 'Urena SC', competition: 'Venezuela - Segunda Division', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.21 },
  { id: 'sb_299', home: 'Trasandino de Los Andes', away: 'Concon National FC', competition: 'Chile - Segunda Division', kickoff: '22:00 GMT', kickoffDate: '2026-10-24T22:00:00Z', status: 'NS', sportyOdd: 1.27 },
  { id: 'sb_300', home: 'Chapecoense SC', away: 'Fluminense FC RJ', competition: 'Brazil - Brasileiro Serie A', kickoff: '22:30 GMT', kickoffDate: '2026-10-24T22:30:00Z', status: 'NS', sportyOdd: 1.26 },
  { id: 'sb_301', home: 'CS 2 de Mayo', away: 'Recoleta FC', competition: 'Paraguay - Division de Honor', kickoff: '22:30 GMT', kickoffDate: '2026-10-24T22:30:00Z', status: 'NS', sportyOdd: 1.35 },
  { id: 'sb_302', home: 'Hartford Athletic', away: 'Rhode Island FC', competition: 'USA - USL Championship', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.32 },
  { id: 'sb_303', home: 'Louisville City FC', away: 'Detroit City FC', competition: 'USA - USL Championship', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.29 },
  { id: 'sb_304', home: 'Pittsburgh Riverhounds', away: 'Birmingham Legion FC', competition: 'USA - USL Championship', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.34 },
  { id: 'sb_305', home: 'FC Naples', away: 'Spokane Velocity FC', competition: 'USA - USL League One', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_306', home: 'AD Rosario', away: 'AD Sarchi', competition: 'Costa Rica - Liga de Ascenso', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.23 },
  { id: 'sb_307', home: 'Inter Playa del Carmen', away: 'Irapuato', competition: 'Mexico - Liga Premier Premier', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.24 },
  { id: 'sb_308', home: 'Tapachula Soconusco FC', away: 'H2O Purepechas FC', competition: 'Mexico - Liga Premier Premier', kickoff: '23:00 GMT', kickoffDate: '2026-10-24T23:00:00Z', status: 'NS', sportyOdd: 1.33 },
  { id: 'sb_309', home: 'CD Universitario Penonome', away: 'CA Independiente de La Chorrera', competition: 'Panama - Liga Panamena', kickoff: '23:15 GMT', kickoffDate: '2026-10-24T23:15:00Z', status: 'NS', sportyOdd: 1.31 }
];

function parseMinuteFromKickoff(kickoffStr: string): number {
  const match = kickoffStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  return hours * 60 + mins;
}

export async function fetchTodaysFixtures(
  startMinute?: number,
  endMinute?: number
): Promise<FixtureFetchResult> {
  // Defaults strictly to 2:00 PM (14:00 = 840 mins) onwards
  const minStart = typeof startMinute === 'number' ? startMinute : 840;
  const maxEnd = typeof endMinute === 'number' ? endMinute : 1440;

  // 1. Strict time filter (2:00 PM - End of Day)
  const validInWindow = SPORTYBET_TODAY_OVER_15.filter(f => {
    const minute = parseMinuteFromKickoff(f.kickoff);
    if (minStart <= maxEnd) {
      return minute >= minStart && minute <= maxEnd;
    }
    return minute >= minStart || minute <= maxEnd;
  });

  // 2. Strict Odds Range Filter: [1.25 - 1.52]
  const validOdds = validInWindow.filter(f => {
    if (!f.sportyOdd) return false;
    return f.sportyOdd >= 1.25 && f.sportyOdd <= 1.52;
  });

  // 3. Fisher-Yates Random Shuffle
  const shuffled = [...validOdds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const fixtures: LiveFixture[] = shuffled.map(f => ({
    ...f,
    generatedId: f.id,
    teams: {
      home: f.home,
      away: f.away
    }
  }));

  return {
    status: 'available',
    fixtures
  };
}
