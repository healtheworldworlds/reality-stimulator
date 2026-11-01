export interface LiveFixture {
  id: string;
  kickoff: string;
  kickoffDate: string;
  status: string;
  competition: string;
  home: string;
  away: string;
  marketType?: '1X2' | 'Over1.5' | 'Over2.5' | 'SHH';
  selectedOption?: '1' | 'X' | '2';
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

// Audited 1X2 matches starting from 17:00 GMT onward, odds >= 1.70, excluding women and virtuals
const SPORTYBET_TODAY_1X2: LiveFixture[] = [
  { id: '22105', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Italy - Serie A', home: 'Genoa', away: 'Lecce', marketType: '1X2', selectedOption: '1', sportyOdd: 3.31 },
  { id: '17600', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Czechia - 1. Liga', home: 'Bohemians Prague 1905', away: 'Sparta Prague', marketType: '1X2', selectedOption: '2', sportyOdd: 1.78 },
  { id: '17565', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Denmark - Superliga', home: 'Broendby IF', away: 'AGF Aarhus', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '35801', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Croatia - HNL', home: 'NK Lokomotiva Zagreb', away: 'NK Osijek', marketType: '1X2', selectedOption: '1', sportyOdd: 2.40 },
  { id: '48254', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Spain - Segunda Federacion', home: 'Terrassa FC', away: 'Reus FC Reddis', marketType: '1X2', selectedOption: '1', sportyOdd: 1.83 },
  { id: '23880', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Morocco - Botola Pro D2', home: 'Olympique Club de Safi', away: 'Olympique Club de Khouribga', marketType: '1X2', selectedOption: '1', sportyOdd: 1.93 },
  { id: '26188', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Costa Rica - Primera Division', home: 'CS Cartagines', away: 'AD San Carlos', marketType: '1X2', selectedOption: '1', sportyOdd: 1.75 },
  { id: '52370', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Guatemala - Liga Nacional', home: 'Aurora FC', away: 'Antigua GFC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.40 },
  { id: '23527', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Lithuania - 1 Lyga', home: 'Hegelmann Litauen B', away: 'Baltijos Futbolo Akademija', marketType: '1X2', selectedOption: '1', sportyOdd: 3.75 },
  { id: '43940', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Senegal - Ligue 1', home: 'ASC Jaraaf', away: 'Walidaan Dkr', marketType: '1X2', selectedOption: '1', sportyOdd: 2.20 },
  { id: '35952', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Germany Amateur - Regionalliga West', home: '1. FC Bocholt', away: '1. FC Cologne II', marketType: '1X2', selectedOption: '1', sportyOdd: 2.25 },
  { id: '50148', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Kuwait - Premier League', home: 'Qadsia SC', away: 'Al Arabi', marketType: '1X2', selectedOption: '1', sportyOdd: 1.89 },
  { id: '19836', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Mexico - Liga Premier Premier', home: 'H2O Purepechas FC', away: 'Montaneses FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.65 },
  { id: '31208', kickoff: '17:00 GMT', kickoffDate: '2026-11-01T17:00:00Z', status: 'NS', competition: 'Mexico - U21 Liga MX', home: 'Santos Laguna', away: 'Necaxa U21', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '36044', kickoff: '17:15 GMT', kickoffDate: '2026-11-01T17:15:00Z', status: 'NS', competition: 'Hungary - NB I', home: 'Ujpest FC Budapest', away: 'Nyiregyhaza Spartacus FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.00 },
  { id: '37644', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Spain - LaLiga', home: 'Elche CF', away: 'Valencia', marketType: '1X2', selectedOption: '1', sportyOdd: 2.37 },
  { id: '20210', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Spain - LALIGA HYPERMOTION', home: 'Burgos CF', away: 'CD Castellon', marketType: '1X2', selectedOption: '2', sportyOdd: 2.10 },
  { id: '35289', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Belgium - Pro League', home: 'Lommel SK', away: 'Gent', marketType: '1X2', selectedOption: '2', sportyOdd: 1.81 },
  { id: '31547', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Greece - Super League', home: 'Panathinaikos', away: 'AEK Athens', marketType: '1X2', selectedOption: '1', sportyOdd: 2.15 },
  { id: '27560', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Spain - Segunda Federacion', home: 'CD Badajoz', away: 'CD Linares', marketType: '1X2', selectedOption: '1', sportyOdd: 1.91 },
  { id: '33020', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Spain - Segunda Federacion', home: 'CD Ciudad de Lucena', away: 'Atletico Sanluqueno', marketType: '1X2', selectedOption: '1', sportyOdd: 1.94 },
  { id: '41330', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Spain Amateur - Tercera Federacion, Group 13', home: 'CD Bala Azul', away: 'SFC Minerva', marketType: '1X2', selectedOption: '1', sportyOdd: 1.80 },
  { id: '31805', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Spain Amateur - Tercera Federacion, Group 2', home: 'UP Langreo', away: 'Caudal Deportivo', marketType: '1X2', selectedOption: '1', sportyOdd: 2.40 },
  { id: '37980', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Albania - Kategoria Superiore', home: 'AF Elbasani', away: 'KF Laci', marketType: '1X2', selectedOption: '1', sportyOdd: 1.80 },
  { id: '37965', kickoff: '17:30 GMT', kickoffDate: '2026-11-01T17:30:00Z', status: 'NS', competition: 'Albania - Kategoria Superiore', home: 'Skenderbeu Korce', away: 'Vllaznia Shkoder', marketType: '1X2', selectedOption: '1', sportyOdd: 2.50 },
  { id: '47718', kickoff: '17:45 GMT', kickoffDate: '2026-11-01T17:45:00Z', status: 'NS', competition: 'Spain - Primera Federacion', home: 'CD Lugo', away: 'Merida AD', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '47767', kickoff: '17:45 GMT', kickoffDate: '2026-11-01T17:45:00Z', status: 'NS', competition: 'Spain - Primera Federacion', home: 'Zamora CF', away: 'RC Deportivo Fabril', marketType: '1X2', selectedOption: '1', sportyOdd: 1.72 },
  { id: '28692', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Portugal - Liga Portugal', home: 'Academico de Viseu', away: 'Rio Ave FC', marketType: '1X2', selectedOption: '1', sportyOdd: 1.90 },
  { id: '23991', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Portugal - Liga Portugal', home: 'Maritimo Madeira', away: 'Santa Clara Azores', marketType: '1X2', selectedOption: '2', sportyOdd: 2.30 },
  { id: '14696', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Argentina - Primera LPF', home: 'Boca Juniors', away: 'CA River Plate (ARG)', marketType: '1X2', selectedOption: '1', sportyOdd: 2.20 },
  { id: '45396', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Chile - Primera Division', home: 'Cobresal', away: 'CD Everton Vina del Mar', marketType: '1X2', selectedOption: '2', sportyOdd: 2.45 },
  { id: '41062', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Morocco - Botola Pro D1', home: 'CODM Meknes', away: 'AS Far Rabat', marketType: '1X2', selectedOption: '2', sportyOdd: 2.05 },
  { id: '14107', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Morocco - Botola Pro D1', home: 'Ittihad Tanger', away: 'Renaissance Zemamra', marketType: '1X2', selectedOption: '1', sportyOdd: 2.25 },
  { id: '44115', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Brazil - Pernambucano', home: '1 de Maio', away: 'Afogados Ingazeira PE', marketType: '1X2', selectedOption: '2', sportyOdd: 2.20 },
  { id: '50637', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Brazil - Pernambucano', home: 'Ipojuca Atletico Clube', away: 'Ibis PE', marketType: '1X2', selectedOption: '1', sportyOdd: 2.20 },
  { id: '33776', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Brazil - Pernambucano', home: 'Salgueiro AC PE', away: 'Facilnet FC PE', marketType: '1X2', selectedOption: '2', sportyOdd: 1.97 },
  { id: '45093', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Ivory Coast - Ligue 1', home: 'ASEC Mimosas', away: 'FC San Pedro', marketType: '1X2', selectedOption: '1', sportyOdd: 2.00 },
  { id: '33828', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Malta - Premier League', home: 'Gzira United FC', away: 'Marsaxlokk FC', marketType: '1X2', selectedOption: '2', sportyOdd: 1.72 },
  { id: '47784', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Brazil - Carioca, Serie B2', home: '7 de Abril RJ', away: 'Cardoso Moreira RJ', marketType: '1X2', selectedOption: '2', sportyOdd: 2.20 },
  { id: '42145', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Brazil - Carioca, Serie B2', home: 'Campos AA RJ', away: 'Serra Macaense FC RJ', marketType: '1X2', selectedOption: '2', sportyOdd: 1.72 },
  { id: '41708', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'Brazil - Carioca, Serie B2', home: 'Friburguense AC RJ', away: 'Santa Cruz FC RJ', marketType: '1X2', selectedOption: '1', sportyOdd: 1.76 },
  { id: '47092', kickoff: '18:00 GMT', kickoffDate: '2026-11-01T18:00:00Z', status: 'NS', competition: 'El Salvador - Primera Division, Reserves', home: 'CD Fuerte San Francisco', away: 'CD Aguila', marketType: '1X2', selectedOption: '2', sportyOdd: 2.20 },
  { id: '33392', kickoff: '18:15 GMT', kickoffDate: '2026-11-01T18:15:00Z', status: 'NS', competition: 'Norway - Eliteserien', home: 'Vaalerenga IF', away: 'Tromsoe IL', marketType: '1X2', selectedOption: '1', sportyOdd: 2.46 },
  { id: '12177', kickoff: '18:30 GMT', kickoffDate: '2026-11-01T18:30:00Z', status: 'NS', competition: 'Ecuador - LigaPro Primera A', home: 'CSD Independiente del Valle', away: 'LDU Quito', marketType: '1X2', selectedOption: '1', sportyOdd: 1.87 },
  { id: '37849', kickoff: '18:30 GMT', kickoffDate: '2026-11-01T18:30:00Z', status: 'NS', competition: 'Germany - 3. Liga', home: 'Alemannia Aachen', away: 'SC Preussen 06 Munster', marketType: '1X2', selectedOption: '1', sportyOdd: 1.91 },
  { id: '47190', kickoff: '18:30 GMT', kickoffDate: '2026-11-01T18:30:00Z', status: 'NS', competition: 'Brazil - Copa Parana', home: 'Foz Do Iguacu PR', away: 'Parana Clube PR', marketType: '1X2', selectedOption: '2', sportyOdd: 2.40 },
  { id: '23688', kickoff: '18:30 GMT', kickoffDate: '2026-11-01T18:30:00Z', status: 'NS', competition: 'Mali - Ligue 1', home: 'AS Bakaridjan', away: 'Afrique Football Elite', marketType: '1X2', selectedOption: '1', sportyOdd: 1.94 },
  { id: '31204', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Brazil - Brasileiro Serie B', home: 'Londrina EC PR', away: 'America FC MG', marketType: '1X2', selectedOption: '1', sportyOdd: 1.99 },
  { id: '38489', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'USA - USL Championship', home: 'Lexington SC', away: 'Colorado Springs Switchbacks', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '15541', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Colombia - Torneo DIMAYOR', home: 'Real Cundinamarca', away: 'Tigres FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '51382', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Uruguay - Segunda Division', home: 'Colon FC', away: 'CA Atenas de San Carlos', marketType: '1X2', selectedOption: '2', sportyOdd: 2.55 },
  { id: '20716', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Spain Amateur - Tercera Federacion, Group 7', home: 'UD Sanse', away: 'CD Leganes B', marketType: '1X2', selectedOption: '2', sportyOdd: 2.10 },
  { id: '18834', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Canada - Canadian Premier League', home: 'Atletico Ottawa', away: 'Forge FC Hamilton', marketType: '1X2', selectedOption: '2', sportyOdd: 1.87 },
  { id: '50199', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Costa Rica - Liga de Ascenso', home: 'AD Cariari Pococi', away: 'AD Carmelita', marketType: '1X2', selectedOption: '1', sportyOdd: 2.10 },
  { id: '50381', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Costa Rica - Liga de Ascenso', home: 'AD Cofutpa', away: 'AD Rosario', marketType: '1X2', selectedOption: '2', sportyOdd: 2.10 },
  { id: '50173', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Costa Rica - Liga de Ascenso', home: 'Futbol Consultants Desamparados', away: 'Pitbulls Santa Barbara', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '50380', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Costa Rica - Liga de Ascenso', home: 'Guadalupe FC', away: 'AD Municipal Santa Ana', marketType: '1X2', selectedOption: '1', sportyOdd: 1.71 },
  { id: '38784', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Malta - Challenge League', home: 'Melita FC', away: 'Sirens FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '46832', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Andorra - Primera Divisio', home: 'FC Rangers', away: 'FC Santa Coloma', marketType: '1X2', selectedOption: '2', sportyOdd: 1.80 },
  { id: '50807', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Chile - Segunda Division', home: 'Colchagua', away: 'Trasandino de Los Andes', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '50806', kickoff: '19:00 GMT', kickoffDate: '2026-11-01T19:00:00Z', status: 'NS', competition: 'Chile - Segunda Division', home: 'Real San Joaquin', away: 'CD Provincial Ovalle FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.25 },
  { id: '21839', kickoff: '19:30 GMT', kickoffDate: '2026-11-01T19:30:00Z', status: 'NS', competition: 'Uruguay - Primera Division', home: 'Danubio FC', away: 'Club Nacional de Football', marketType: '1X2', selectedOption: '2', sportyOdd: 1.76 },
  { id: '47781', kickoff: '19:30 GMT', kickoffDate: '2026-11-01T19:30:00Z', status: 'NS', competition: 'Spain - Primera Federacion', home: 'Hercules de Alicante CF', away: 'CF Rayo Majadahonda', marketType: '1X2', selectedOption: '1', sportyOdd: 1.96 },
  { id: '22857', kickoff: '19:30 GMT', kickoffDate: '2026-11-01T19:30:00Z', status: 'NS', competition: 'Venezuela - Segunda Division', home: 'Urena SC', away: 'Monagas SC B', marketType: '1X2', selectedOption: '2', sportyOdd: 2.15 },
  { id: '23127', kickoff: '19:30 GMT', kickoffDate: '2026-11-01T19:30:00Z', status: 'NS', competition: 'Venezuela - Segunda Division', home: 'Yaracuyanos FC', away: 'Aragua FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.20 },
  { id: '23140', kickoff: '19:30 GMT', kickoffDate: '2026-11-01T19:30:00Z', status: 'NS', competition: 'Venezuela - Segunda Division', home: 'Zamora FC Barinas II', away: 'Deportivo Lara', marketType: '1X2', selectedOption: '2', sportyOdd: 1.88 },
  { id: '32334', kickoff: '19:45 GMT', kickoffDate: '2026-11-01T19:45:00Z', status: 'NS', competition: 'Italy - Serie A', home: 'Juventus', away: 'Napoli', marketType: '1X2', selectedOption: '1', sportyOdd: 2.28 },
  { id: '39642', kickoff: '19:45 GMT', kickoffDate: '2026-11-01T19:45:00Z', status: 'NS', competition: 'France - Ligue 1', home: 'Marseille', away: 'Toulouse', marketType: '1X2', selectedOption: '1', sportyOdd: 1.96 },
  { id: '37652', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Spain - LaLiga', home: 'Athletic Bilbao', away: 'Real Sociedad', marketType: '1X2', selectedOption: '1', sportyOdd: 2.03 },
  { id: '23782', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Morocco - Botola Pro D1', home: 'RS Berkane', away: 'Raja Casablanca Athletic', marketType: '1X2', selectedOption: '1', sportyOdd: 2.25 },
  { id: '47782', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Spain - Primera Federacion', home: 'CD Extremadura', away: 'Unionistas de Salamanca', marketType: '1X2', selectedOption: '1', sportyOdd: 1.72 },
  { id: '43381', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Paraguay - Division de Honor', home: 'Cerro Porteno', away: 'Club Olimpia', marketType: '1X2', selectedOption: '2', sportyOdd: 2.50 },
  { id: '48221', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Jamaica - Premier League', home: 'Dunbeholden FC', away: 'Humble Lions FC', marketType: '1X2', selectedOption: '1', sportyOdd: 1.72 },
  { id: '32072', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Jamaica - Premier League', home: 'Montego Bay United', away: 'Portmore United', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '16104', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Jamaica - Premier League', home: 'Tivoli Gardens', away: 'Arnett Gardens FC', marketType: '1X2', selectedOption: '2', sportyOdd: 2.15 },
  { id: '20381', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Jamaica - Premier League', home: 'Tru-Juice FC', away: 'Chapelton Maroons FC', marketType: '1X2', selectedOption: '1', sportyOdd: 1.92 },
  { id: '16891', kickoff: '20:00 GMT', kickoffDate: '2026-11-01T20:00:00Z', status: 'NS', competition: 'Nicaragua - Liga de Ascenso', home: 'CD Rio Blanco', away: 'Juventus FC Managua', marketType: '1X2', selectedOption: '1', sportyOdd: 1.95 },
  { id: '15002', kickoff: '20:30 GMT', kickoffDate: '2026-11-01T20:30:00Z', status: 'NS', competition: 'USA - MLS', home: 'Vancouver Whitecaps FC', away: 'Seattle Sounders', marketType: '1X2', selectedOption: '1', sportyOdd: 1.75 },
  { id: '40613', kickoff: '21:00 GMT', kickoffDate: '2026-11-01T21:00:00Z', status: 'NS', competition: 'Ecuador - LigaPro Primera A', home: 'Guayaquil City FC', away: 'Libertad Loja', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '14542', kickoff: '21:00 GMT', kickoffDate: '2026-11-01T21:00:00Z', status: 'NS', competition: 'Canada - Canadian Premier League', home: 'FC Supra Du Quebec', away: 'Cavalry FC', marketType: '1X2', selectedOption: '2', sportyOdd: 2.15 },
  { id: '35654', kickoff: '21:00 GMT', kickoffDate: '2026-11-01T21:00:00Z', status: 'NS', competition: 'Panama - Liga Panamena', home: 'AF Sporting San Miguelito', away: 'Umecit', marketType: '1X2', selectedOption: '1', sportyOdd: 2.55 },
  { id: '13584', kickoff: '21:00 GMT', kickoffDate: '2026-11-01T21:00:00Z', status: 'NS', competition: 'Guatemala - Liga Nacional', home: 'Deportivo San Pedro', away: 'CSD Municipal', marketType: '1X2', selectedOption: '2', sportyOdd: 2.40 },
  { id: '37816', kickoff: '21:00 GMT', kickoffDate: '2026-11-01T21:00:00Z', status: 'NS', competition: 'El Salvador - Primera Division', home: 'Atletico Balboa', away: 'Alianza FC San Salvador', marketType: '1X2', selectedOption: '2', sportyOdd: 2.15 },
  { id: '50605', kickoff: '21:15 GMT', kickoffDate: '2026-11-01T21:15:00Z', status: 'NS', competition: 'Bolivia - Division Profesional', home: 'Guabira Montero', away: 'Club Bolivar', marketType: '1X2', selectedOption: '2', sportyOdd: 1.85 },
  { id: '17157', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'USA - MLS', home: 'Atlanta United FC', away: 'Toronto FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.22 },
  { id: '14240', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'Venezuela - Primera Division', home: 'Deportivo La Guaira', away: 'Portuguesa FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.10 },
  { id: '26033', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'Argentina - Primera LPF', home: 'CA Belgrano de Cordoba', away: 'CA Barracas Central', marketType: '1X2', selectedOption: '1', sportyOdd: 1.89 },
  { id: '27924', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'Argentina - Primera LPF', home: 'Newell\'s Old Boys', away: 'Union de Santa Fe', marketType: '1X2', selectedOption: '1', sportyOdd: 2.00 },
  { id: '45388', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'Brazil - Brasileiro Serie B', home: 'Cuiaba EC MT', away: 'Sao Bernardo FC', marketType: '1X2', selectedOption: '1', sportyOdd: 1.89 },
  { id: '44126', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'Brazil - Copa do Brasil', home: 'Gremio FB Porto Alegrense', away: 'Atletico Mineiro MG', marketType: '1X2', selectedOption: '1', sportyOdd: 2.55 },
  { id: '26448', kickoff: '21:30 GMT', kickoffDate: '2026-11-01T21:30:00Z', status: 'NS', competition: 'Argentina - Primera Nacional', home: 'San Martin de Tucuman', away: 'CA Colegiales', marketType: '1X2', selectedOption: '2', sportyOdd: 2.50 },
  { id: '52174', kickoff: '22:00 GMT', kickoffDate: '2026-11-01T22:00:00Z', status: 'NS', competition: 'Uruguay - Segunda Division', home: 'Miramar Misiones', away: 'Plaza Colonia', marketType: '1X2', selectedOption: '2', sportyOdd: 2.00 },
  { id: '26582', kickoff: '22:00 GMT', kickoffDate: '2026-11-01T22:00:00Z', status: 'NS', competition: 'Costa Rica - Primera Division', home: 'Deportivo Saprissa San Jose', away: 'Liga Deportiva Alajuelense', marketType: '1X2', selectedOption: '1', sportyOdd: 1.87 },
  { id: '12996', kickoff: '22:00 GMT', kickoffDate: '2026-11-01T22:00:00Z', status: 'NS', competition: 'Dominican Republic - Liga Mayor', home: 'Vega Real', away: 'Delfines Del Este', marketType: '1X2', selectedOption: '2', sportyOdd: 2.55 },
  { id: '40071', kickoff: '22:15 GMT', kickoffDate: '2026-11-01T22:15:00Z', status: 'NS', competition: 'Argentina - Torneo Federal A', home: 'CSB Atenas', away: 'CA Sarmiento de la Banda', marketType: '1X2', selectedOption: '1', sportyOdd: 1.97 },
  { id: '21740', kickoff: '23:00 GMT', kickoffDate: '2026-11-01T23:00:00Z', status: 'NS', competition: 'Mexico - Liga MX', home: 'Club Santos Laguna', away: 'Club Necaxa', marketType: '1X2', selectedOption: '1', sportyOdd: 1.85 },
  { id: '33966', kickoff: '23:00 GMT', kickoffDate: '2026-11-01T23:00:00Z', status: 'NS', competition: 'USA - USL Championship', home: 'New Mexico United', away: 'Phoenix Rising FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.10 },
  { id: '18115', kickoff: '23:00 GMT', kickoffDate: '2026-11-01T23:00:00Z', status: 'NS', competition: 'Uruguay - Primera Division', home: 'Liverpool Montevideo', away: 'CA Juventud de Las Piedras', marketType: '1X2', selectedOption: '1', sportyOdd: 2.15 },
  { id: '52105', kickoff: '23:00 GMT', kickoffDate: '2026-11-01T23:00:00Z', status: 'NS', competition: 'Panama - Liga Prom', home: 'Champions FC Academy', away: 'Umecit II', marketType: '1X2', selectedOption: '2', sportyOdd: 1.87 },
  { id: '16390', kickoff: '23:00 GMT', kickoffDate: '2026-11-01T23:00:00Z', status: 'NS', competition: 'Nicaragua - Primera Division', home: 'Rancho Santana FC', away: 'Indigenas de Matagalpa FC', marketType: '1X2', selectedOption: '1', sportyOdd: 2.30 },
  { id: '48471', kickoff: '23:15 GMT', kickoffDate: '2026-11-01T23:15:00Z', status: 'NS', competition: 'Honduras - Liga Nacional', home: 'FC Motagua Tegucigalpa', away: 'CD Marathon San Pedro Sula', marketType: '1X2', selectedOption: '1', sportyOdd: 2.10 },
  { id: '43042', kickoff: '23:15 GMT', kickoffDate: '2026-11-01T23:15:00Z', status: 'NS', competition: 'Panama - Liga Panamena', home: 'CA Independiente de La Chorrera', away: 'San Francisco FC', marketType: '1X2', selectedOption: '2', sportyOdd: 2.45 },
  { id: '24255', kickoff: '23:25 GMT', kickoffDate: '2026-11-01T23:25:00Z', status: 'NS', competition: 'Venezuela - Primera Division', home: 'Carabobo FC', away: 'Metropolitanos FC', marketType: '1X2', selectedOption: '1', sportyOdd: 1.77 },
  { id: '27067', kickoff: '23:30 GMT', kickoffDate: '2026-11-01T23:30:00Z', status: 'NS', competition: 'El Salvador - Primera Division', home: 'CD Luis Angel Firpo', away: 'CD FAS Santa Ana', marketType: '1X2', selectedOption: '1', sportyOdd: 2.05 },
  { id: '60608', kickoff: '23:30 GMT', kickoffDate: '2026-11-01T23:30:00Z', status: 'NS', competition: 'Bolivia - Division Profesional', home: 'FC Universitario de Vinto', away: 'Always Ready', marketType: '1X2', selectedOption: '2', sportyOdd: 1.78 }
];

export async function fetchTodaysFixtures(): Promise<FixtureFetchResult> {
  const shuffled = [...SPORTYBET_TODAY_1X2];
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
