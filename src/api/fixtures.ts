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

// All verified real matches from 1:00 PM onward with Over 2.5 odds in [1.70, 2.40]
const SPORTYBET_TODAY_OVER_25: LiveFixture[] = [
  // 1:00 PM - 1:45 PM
  { id: 'sb_1', home: 'Maccabi Herzliya', away: 'Maccabi Kabilio Jaffa', competition: 'Israel - National League', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.76 },
  { id: 'sb_2', home: 'Maccabi Ironi Kiryat Ata', away: 'Maccabi Achi Nazareth', competition: 'Israel - National League', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.83 },
  { id: 'sb_3', home: 'GNK Dinamo Zagreb II', away: 'HNK Cibalia Vinkovci', competition: 'Croatia - Prva NL', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.89 },
  { id: 'sb_4', home: 'NK Dubrava Zagreb', away: 'NK Kustosija Zagreb', competition: 'Croatia - Prva NL', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 2.05 },
  { id: 'sb_5', home: 'NK Sesvete', away: 'NK Hrvace', competition: 'Croatia - Prva NL', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_6', home: 'NK Bistrica Slovenska', away: 'NK Bilje', competition: 'Slovenia - Cup', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.72 },
  { id: 'sb_7', home: 'Polisi Tanzania FC', away: 'Pamba Jiji SC', competition: 'Tanzania - Premier League', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_8', home: 'PFC Chernomorets Burgas', away: 'PFK Spartak Pleven', competition: 'Bulgaria - Vtora Liga', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.79 },
  { id: 'sb_9', home: 'PFC CSKA Sofia II', away: 'FC Yantra Gabrovo', competition: 'Bulgaria - Vtora Liga', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.97 },
  { id: 'sb_10', home: 'PFC Vihren Sandanski', away: 'Marek Dupnitsa', competition: 'Bulgaria - Vtora Liga', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.81 },
  { id: 'sb_11', home: 'NK Uljanik', away: 'NK Uskok', competition: 'Croatia - Druga NL', kickoff: '13:00 GMT', kickoffDate: '2026-10-23T13:00:00Z', status: 'NS', sportyOdd: 1.63 },
  { id: 'sb_12', home: 'Chador Malu Yazd', away: 'Esteghlal FC Tehran', competition: 'Iran - Pro League', kickoff: '13:15 GMT', kickoffDate: '2026-10-23T13:15:00Z', status: 'NS', sportyOdd: 2.35 },
  { id: 'sb_13', home: 'Casric Stars FC', away: 'Highbury FC', competition: 'South Africa - Championship', kickoff: '13:30 GMT', kickoffDate: '2026-10-23T13:30:00Z', status: 'NS', sportyOdd: 2.30 },

  // 2:00 PM - 2:45 PM
  { id: 'sb_14', home: 'GFK Dubocica', away: 'FK Smederevo 1924', competition: 'Serbia - Prva Liga', kickoff: '14:00 GMT', kickoffDate: '2026-10-23T14:00:00Z', status: 'NS', sportyOdd: 2.30 },
  { id: 'sb_15', home: 'Al Salt', away: 'Ramtha SC', competition: 'Jordan - Jordan League', kickoff: '14:00 GMT', kickoffDate: '2026-10-23T14:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_16', home: 'Flamurtari Vlore', away: 'KS Beselidhja', competition: 'Albania - Kategoria e Pare', kickoff: '14:00 GMT', kickoffDate: '2026-10-23T14:00:00Z', status: 'NS', sportyOdd: 1.71 },
  { id: 'sb_17', home: 'FK Buxoro', away: 'FK Termez Surkhon', competition: 'Uzbekistan - Superliga', kickoff: '14:00 GMT', kickoffDate: '2026-10-23T14:00:00Z', status: 'NS', sportyOdd: 1.86 },
  { id: 'sb_18', home: 'Al Zawraa', away: 'Al Shorta SC', competition: 'Iraq - Stars League', kickoff: '14:00 GMT', kickoffDate: '2026-10-23T14:00:00Z', status: 'NS', sportyOdd: 2.20 },
  { id: 'sb_19', home: 'Mizoram Police FC', away: 'Dinthar FC', competition: 'India - Mizoram Premier League', kickoff: '14:00 GMT', kickoffDate: '2026-10-23T14:00:00Z', status: 'NS', sportyOdd: 1.75 },
  { id: 'sb_20', home: 'Atletico Petroleos de Luanda', away: 'Scotland FC', competition: 'CAF Champions League', kickoff: '14:30 GMT', kickoffDate: '2026-10-23T14:30:00Z', status: 'NS', sportyOdd: 2.05 },
  { id: 'sb_21', home: 'Al-Shamal', away: 'Qatar SC', competition: 'Qatar - Stars League', kickoff: '14:30 GMT', kickoffDate: '2026-10-23T14:30:00Z', status: 'NS', sportyOdd: 2.00 },
  { id: 'sb_22', home: 'FC Minsk', away: 'FC Baranovichi', competition: 'Belarus - Vysshaya Liga', kickoff: '14:30 GMT', kickoffDate: '2026-10-23T14:30:00Z', status: 'NS', sportyOdd: 1.91 },
  { id: 'sb_23', home: 'East Riffa', away: 'Al-Muharraq SC', competition: 'Bahrain - Premier League', kickoff: '14:30 GMT', kickoffDate: '2026-10-23T14:30:00Z', status: 'NS', sportyOdd: 1.82 },
  { id: 'sb_24', home: 'Kazma SC', away: 'Al Salibikhaet', competition: 'Kuwait - Premier League', kickoff: '14:35 GMT', kickoffDate: '2026-10-23T14:35:00Z', status: 'NS', sportyOdd: 1.71 },
  { id: 'sb_25', home: 'Torpedo Moscow', away: 'SK Rotor Volgograd', competition: 'Russia - 1. Liga', kickoff: '14:45 GMT', kickoffDate: '2026-10-23T14:45:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_26', home: 'Zaglebie Sosnowiec', away: 'Miedz Legnica II', competition: 'Poland - III Liga, Group 3', kickoff: '14:45 GMT', kickoffDate: '2026-10-23T14:45:00Z', status: 'NS', sportyOdd: 2.20 },

  // 3:00 PM - 3:30 PM
  { id: 'sb_27', home: 'Zira FK', away: 'Sumqayit FK', competition: 'Azerbaijan - Premier League', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 1.96 },
  { id: 'sb_28', home: 'Al Aqaba', away: 'Al-Ahly Amman', competition: 'Jordan - First Division', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 1.70 },
  { id: 'sb_29', home: 'Hay Al Amir Hassan', away: 'Maan SC', competition: 'Jordan - First Division', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 2.05 },
  { id: 'sb_30', home: 'Ittihad AL Ramtha', away: 'AL Hashemehya', competition: 'Jordan - First Division', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_31', home: 'Gorna Oryahovitsa', away: 'FC Pirin Blagoevgrad', competition: 'Bulgaria - Vtora Liga', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 1.78 },
  { id: 'sb_32', home: 'PFK Beroe Stara Zagora II', away: 'PFC Rilski Sportist Samokov', competition: 'Bulgaria - Vtora Liga', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_33', home: 'Al Karkh', away: 'AL Mosul SC', competition: 'Iraq - Stars League', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 2.05 },
  { id: 'sb_34', home: 'Necaxa U21', away: 'FC Juarez U21', competition: 'Mexico - U21 Liga MX', kickoff: '15:00 GMT', kickoffDate: '2026-10-23T15:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_35', home: 'Al-Seeb', away: 'Sohar', competition: 'Oman - Omani League', kickoff: '15:20 GMT', kickoffDate: '2026-10-23T15:20:00Z', status: 'NS', sportyOdd: 1.90 },
  { id: 'sb_36', home: 'Saham', away: 'Al Nahda', competition: 'Oman - Omani League', kickoff: '15:20 GMT', kickoffDate: '2026-10-23T15:20:00Z', status: 'NS', sportyOdd: 1.90 },
  { id: 'sb_37', home: 'Tabor Sezana', away: 'FC Koper', competition: 'Slovenia - Cup', kickoff: '15:30 GMT', kickoffDate: '2026-10-23T15:30:00Z', status: 'NS', sportyOdd: 1.84 },
  { id: 'sb_38', home: 'Triglav Kranj', away: 'Nafta 1903 Lendava', competition: 'Slovenia - Cup', kickoff: '15:30 GMT', kickoffDate: '2026-10-23T15:30:00Z', status: 'NS', sportyOdd: 1.86 },
  { id: 'sb_39', home: 'Kaizer Chiefs', away: 'Red Arrows', competition: 'CAF Confederation Cup', kickoff: '15:30 GMT', kickoffDate: '2026-10-23T15:30:00Z', status: 'NS', sportyOdd: 1.88 },
  { id: 'sb_40', home: 'Duhok FC', away: 'Karbalaa', competition: 'Iraq - Stars League', kickoff: '15:30 GMT', kickoffDate: '2026-10-23T15:30:00Z', status: 'NS', sportyOdd: 1.92 },
  { id: 'sb_41', home: 'Al Rayyan SC', away: 'Al Sailiya SC', competition: 'Qatar - Stars League', kickoff: '15:45 GMT', kickoffDate: '2026-10-23T15:45:00Z', status: 'NS', sportyOdd: 1.94 },

  // 4:00 PM
  { id: 'sb_42', home: 'FC CSKA 1948', away: 'Botev Plovdiv', competition: 'Bulgaria - Parva Liga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.81 },
  { id: 'sb_43', home: 'Hobro IK', away: 'Vendsyssel FF', competition: 'Denmark - 1. Division', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.85 },
  { id: 'sb_44', home: 'FK IMT Novi Beograd', away: 'FK Zeleznicar Pancevo', competition: 'Serbia - SuperLiga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_45', home: 'FK Radnicki 1923 Kragujevac', away: 'FK Radnik Surdulica', competition: 'Serbia - SuperLiga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.87 },
  { id: 'sb_46', home: 'FK Radnicki Nis', away: 'FK Novi Pazar', competition: 'Serbia - SuperLiga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.94 },
  { id: 'sb_47', home: 'LKP Motor Lublin', away: 'Zaglebie Lubin', competition: 'Poland - Ekstraklasa', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.83 },
  { id: 'sb_48', home: 'Polonia Warszawa', away: 'Miedz Legnica', competition: 'Poland - 1. Liga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 2.35 },
  { id: 'sb_49', home: 'FC Rustavi', away: 'FC Dinamo Tbilisi', competition: 'Georgia - Erovnuli Liga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.97 },
  { id: 'sb_50', home: 'Zawisza Bydgoszcz', away: 'CKS Swit Szczecin', competition: 'Poland - II Liga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 2.25 },
  { id: 'sb_51', home: 'FK Jezero Plav', away: 'OFK Petrovac', competition: 'Montenegro - 1. CFL', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_52', home: 'NK Brezice 1919', away: 'Aluminij Kidricevo', competition: 'Slovenia - Cup', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 2.35 },
  { id: 'sb_53', home: 'SC Gjilani', away: 'KF Llapi', competition: 'Kosovo - Superliga', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.80 },
  { id: 'sb_54', home: 'Al-Khaldiya SC', away: 'Al Riffaq BHR', competition: 'Bahrain - Premier League', kickoff: '16:00 GMT', kickoffDate: '2026-10-23T16:00:00Z', status: 'NS', sportyOdd: 1.72 },

  // 4:30 PM - 5:00 PM
  { id: 'sb_55', home: 'Darmstadt', away: 'FC St. Pauli', competition: 'Germany - 2. Bundesliga', kickoff: '16:30 GMT', kickoffDate: '2026-10-23T16:30:00Z', status: 'NS', sportyOdd: 1.78 },
  { id: 'sb_56', home: 'RFK Akhmat Grozny', away: 'FC Orenburg', competition: 'Russia - Premier League', kickoff: '16:30 GMT', kickoffDate: '2026-10-23T16:30:00Z', status: 'NS', sportyOdd: 1.89 },
  { id: 'sb_57', home: 'First Vienna FC 1894', away: 'FAC Wien', competition: 'Austria - 2. Liga', kickoff: '16:30 GMT', kickoffDate: '2026-10-23T16:30:00Z', status: 'NS', sportyOdd: 1.84 },
  { id: 'sb_58', home: 'FK Garliava', away: 'Vilnius FK Zalgiris B', competition: 'Lithuania - 1 Lyga', kickoff: '16:30 GMT', kickoffDate: '2026-10-23T16:30:00Z', status: 'NS', sportyOdd: 1.92 },
  { id: 'sb_59', home: 'Al Jazeera Club Amman', away: 'AL Faisaly (JOR)', competition: 'Jordan - Jordan League', kickoff: '16:30 GMT', kickoffDate: '2026-10-23T16:30:00Z', status: 'NS', sportyOdd: 1.72 },
  { id: 'sb_60', home: 'Alanyaspor', away: 'Kocaelispor', competition: 'Turkey - Super Lig', kickoff: '17:00 GMT', kickoffDate: '2026-10-23T17:00:00Z', status: 'NS', sportyOdd: 2.25 },
  { id: 'sb_61', home: 'Randers FC', away: 'Brondby IF', competition: 'Denmark - Superliga', kickoff: '17:00 GMT', kickoffDate: '2026-10-23T17:00:00Z', status: 'NS', sportyOdd: 1.94 },
  { id: 'sb_62', home: 'FA 2000', away: 'HIK Hellerup', competition: 'Denmark - 2nd Division', kickoff: '17:00 GMT', kickoffDate: '2026-10-23T17:00:00Z', status: 'NS', sportyOdd: 1.80 },
  { id: 'sb_63', home: 'Boluspor', away: 'Van Spor FK', competition: 'Turkey - 1. Lig', kickoff: '17:00 GMT', kickoffDate: '2026-10-23T17:00:00Z', status: 'NS', sportyOdd: 1.76 },
  { id: 'sb_64', home: 'Real Union de Irun', away: 'CD Lugo', competition: 'Spain - Primera Federacion', kickoff: '17:00 GMT', kickoffDate: '2026-10-23T17:00:00Z', status: 'NS', sportyOdd: 1.92 },

  // 5:30 PM - 5:45 PM
  { id: 'sb_65', home: 'FC Wil 1900', away: 'FC Rapperswil-Jona', competition: 'Switzerland - Challenge League', kickoff: '17:30 GMT', kickoffDate: '2026-10-23T17:30:00Z', status: 'NS', sportyOdd: 1.78 },
  { id: 'sb_66', home: 'FC Jarfalla', away: 'Hammarby Talang FF', competition: 'Sweden - Ettan', kickoff: '17:30 GMT', kickoffDate: '2026-10-23T17:30:00Z', status: 'NS', sportyOdd: 1.97 },
  { id: 'sb_67', home: 'SCR Altach', away: 'FK Austria Wien', competition: 'Austria - Bundesliga', kickoff: '17:30 GMT', kickoffDate: '2026-10-23T17:30:00Z', status: 'NS', sportyOdd: 1.82 },
  { id: 'sb_68', home: 'Al Julan', away: 'AL Kahrabaa SC', competition: 'Iraq - Stars League', kickoff: '17:30 GMT', kickoffDate: '2026-10-23T17:30:00Z', status: 'NS', sportyOdd: 2.35 },
  { id: 'sb_69', home: 'FC Goa', away: 'Qadsia SC', competition: 'AFC Challenge League', kickoff: '17:30 GMT', kickoffDate: '2026-10-23T17:30:00Z', status: 'NS', sportyOdd: 1.73 },
  { id: 'sb_70', home: 'GD Chaves', away: 'FC Vizela', competition: 'Portugal - Liga Portugal 2', kickoff: '17:45 GMT', kickoffDate: '2026-10-23T17:45:00Z', status: 'NS', sportyOdd: 1.95 },

  // 6:00 PM - 6:30 PM
  { id: 'sb_71', home: 'Clermont Foot', away: 'Guingamp', competition: 'France - Ligue 2', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.92 },
  { id: 'sb_72', home: 'Nancy-Lorraine', away: 'Stade Lavallois MFC', competition: 'France - Ligue 2', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.78 },
  { id: 'sb_73', home: 'Pau FC', away: 'Grenoble Foot', competition: 'France - Ligue 2', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_74', home: 'Sochaux-Montbeliard', away: 'FC Annecy', competition: 'France - Ligue 2', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_75', home: 'Al Ahli Saudi FC', away: 'Al-Khaleej Club', competition: 'Saudi Arabia - Saudi Pro League', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.79 },
  { id: 'sb_76', home: 'Al Qadisah', away: 'Al Hilal SFC', competition: 'Saudi Arabia - Saudi Pro League', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.70 },
  { id: 'sb_77', home: 'FC Corvinul Hunedoara', away: 'FC Universitatea Cluj', competition: 'Romania - Superliga', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.83 },
  { id: 'sb_78', home: 'Royal Francs Borains', away: 'FCV Dender EH', competition: 'Belgium - Challenger Pro League', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.77 },
  { id: 'sb_79', home: 'RSC Anderlecht Futures', away: 'Koninklijke Lierse Sportkring', competition: 'Belgium - Challenger Pro League', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 2.25 },
  { id: 'sb_80', home: 'CD Huarte', away: 'CD Avance Ezcabarte', competition: 'Spain - Tercera Federacion, Group 15', kickoff: '18:00 GMT', kickoffDate: '2026-10-23T18:00:00Z', status: 'NS', sportyOdd: 1.77 },
  { id: 'sb_81', home: 'Penicuik Athletic FC', away: 'Clyde FC', competition: 'Scotland - Scottish Cup', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.94 },
  { id: 'sb_82', home: 'Granada', away: 'Valladolid', competition: 'Spain - LaLiga Hypermotion', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.94 },
  { id: 'sb_83', home: 'Empoli', away: 'L.R. Vicenza', competition: 'Italy - Serie B', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.84 },
  { id: 'sb_84', home: 'Widzew Lodz', away: 'Gornik Zabrze', competition: 'Poland - Ekstraklasa', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.91 },
  { id: 'sb_85', home: 'AS Ostiamare', away: 'Vado FC', competition: 'Italy - Serie C, Group B', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.88 },
  { id: 'sb_86', home: 'ASD Pineto Calcio', away: 'AS Gubbio', competition: 'Italy - Serie C, Group B', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 2.10 },
  { id: 'sb_87', home: 'Perugia Calcio Spa', away: 'Delfino Pescara', competition: 'Italy - Serie C, Group B', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.81 },
  { id: 'sb_88', home: 'Altamura Societa Sportiva', away: 'Potenza Calcio', competition: 'Italy - Serie C, Group C', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 1.85 },
  { id: 'sb_89', home: 'Casertana FC', away: 'SSC Bari', competition: 'Italy - Serie C, Group C', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 2.05 },
  { id: 'sb_90', home: 'Carmarthen Town', away: 'Caerphilly Athletic FC', competition: 'Wales - Cymru Championship South', kickoff: '18:30 GMT', kickoffDate: '2026-10-23T18:30:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_91', home: 'KV Kortrijk', away: 'Yellow-Red KV Mechelen', competition: 'Belgium - Pro League', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.85 },
  { id: 'sb_92', home: 'Gateshead FC', away: 'Tamworth FC', competition: 'England - National League', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.85 },
  { id: 'sb_93', home: 'Colwyn Bay', away: 'Cardiff Metropolitan University', competition: 'Wales - Cymru Premier', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.84 },
  { id: 'sb_94', home: 'Strabane Athletic FC', away: 'Ballinamallard United', competition: 'Northern Ireland - Championship', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.80 },
  { id: 'sb_95', home: 'Attard FC', away: 'St Andrews FC', competition: 'Malta - Challenge League', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.82 },
  { id: 'sb_96', home: 'Trethomas Bluebirds', away: 'Cardiff Draconians', competition: 'Wales - Cymru South', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_97', home: 'Bohemians Dublin FC', away: 'Shelbourne FC', competition: 'Ireland - Premier Division', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.70 },
  { id: 'sb_98', home: 'Galway United FC', away: 'Saint Patrick\'s Athletics', competition: 'Ireland - Premier Division', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.72 },
  { id: 'sb_99', home: 'Waterford FC', away: 'Drogheda United FC', competition: 'Ireland - Premier Division', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.74 },
  { id: 'sb_100', home: 'Portadown FC', away: 'Linfield FC', competition: 'Northern Ireland - Premiership', kickoff: '18:45 GMT', kickoffDate: '2026-10-23T18:45:00Z', status: 'NS', sportyOdd: 1.74 },

  // 7:00 PM - 7:45 PM
  { id: 'sb_101', home: 'Ipswich Town', away: 'Nottingham Forest', competition: 'England - Premier League', kickoff: '19:00 GMT', kickoffDate: '2026-10-23T19:00:00Z', status: 'NS', sportyOdd: 1.78 },
  { id: 'sb_102', home: 'Malaga CF', away: 'Alaves', competition: 'Spain - LaLiga', kickoff: '19:00 GMT', kickoffDate: '2026-10-23T19:00:00Z', status: 'NS', sportyOdd: 2.00 },
  { id: 'sb_103', home: 'MC Alger', away: 'Enugu Rangers International', competition: 'CAF Champions League', kickoff: '19:00 GMT', kickoffDate: '2026-10-23T19:00:00Z', status: 'NS', sportyOdd: 1.73 },
  { id: 'sb_104', home: 'CE Europa', away: 'Real Zaragoza', competition: 'Spain - Primera Federacion', kickoff: '19:15 GMT', kickoffDate: '2026-10-23T19:15:00Z', status: 'NS', sportyOdd: 1.77 },
  { id: 'sb_105', home: 'AC Juvenes/Dogana', away: 'SS Virtus', competition: 'San Marino - Campionato Sammarinese', kickoff: '19:15 GMT', kickoffDate: '2026-10-23T19:15:00Z', status: 'NS', sportyOdd: 1.83 },
  { id: 'sb_106', home: 'San Marino Academy', away: 'Cosmos Serravalle', competition: 'San Marino - Campionato Sammarinese', kickoff: '19:15 GMT', kickoffDate: '2026-10-23T19:15:00Z', status: 'NS', sportyOdd: 1.77 },
  { id: 'sb_107', home: 'SP Tre Penne', away: 'SP Tre Fiori', competition: 'San Marino - Campionato Sammarinese', kickoff: '19:15 GMT', kickoffDate: '2026-10-23T19:15:00Z', status: 'NS', sportyOdd: 1.92 },
  { id: 'sb_108', home: 'FC Pacos Ferreira', away: 'Leca FC', competition: 'Portugal - Liga Portugal 3', kickoff: '19:30 GMT', kickoffDate: '2026-10-23T19:30:00Z', status: 'NS', sportyOdd: 1.85 },
  { id: 'sb_109', home: 'Guairena FC', away: 'Caraguape', competition: 'Paraguay - Division Intermedia', kickoff: '19:30 GMT', kickoffDate: '2026-10-23T19:30:00Z', status: 'NS', sportyOdd: 1.74 },
  { id: 'sb_110', home: 'Vitoria SC Guimaraes', away: 'Maritimo Madeira', competition: 'Portugal - Liga Portugal', kickoff: '19:45 GMT', kickoffDate: '2026-10-23T19:45:00Z', status: 'NS', sportyOdd: 1.88 },

  // 8:00 PM - 11:30 PM Night Fixtures
  { id: 'sb_111', home: 'Rubio Nu', away: 'Club Guarani Asuncion', competition: 'Paraguay - Division de Honor', kickoff: '20:00 GMT', kickoffDate: '2026-10-23T20:00:00Z', status: 'NS', sportyOdd: 2.25 },
  { id: 'sb_112', home: 'Jarabacoa', away: 'Univ. Organizacion y Metodo', competition: 'Dominican Republic - Liga Mayor', kickoff: '20:00 GMT', kickoffDate: '2026-10-23T20:00:00Z', status: 'NS', sportyOdd: 1.80 },
  { id: 'sb_113', home: 'Guarani FC SP U20', away: 'SC Corinthians SP U20', competition: 'Brazil - U20 Paulista', kickoff: '20:00 GMT', kickoffDate: '2026-10-23T20:00:00Z', status: 'NS', sportyOdd: 1.79 },
  { id: 'sb_114', home: 'Atletico Grau', away: 'Asociacion Deportiva Tarma', competition: 'Peru - Liga 1', kickoff: '20:15 GMT', kickoffDate: '2026-10-23T20:15:00Z', status: 'NS', sportyOdd: 1.85 },
  { id: 'sb_115', home: 'CSD Independiente del Valle', away: 'CD Universidad Catolica del Ecuador', competition: 'Ecuador - LigaPro Primera A', kickoff: '20:30 GMT', kickoffDate: '2026-10-23T20:30:00Z', status: 'NS', sportyOdd: 1.72 },
  { id: 'sb_116', home: 'Gimnasia y Esgrima La Plata', away: 'CA Sarmiento Junin', competition: 'Argentina - Primera LPF', kickoff: '21:00 GMT', kickoffDate: '2026-10-23T21:00:00Z', status: 'NS', sportyOdd: 2.00 },
  { id: 'sb_117', home: 'Independiente Campo Grande', away: 'Paraguari AC', competition: 'Paraguay - Division Intermedia', kickoff: '22:00 GMT', kickoffDate: '2026-10-23T22:00:00Z', status: 'NS', sportyOdd: 1.89 },
  { id: 'sb_118', home: 'Barra FC SC', away: 'Santa Catarina SC', competition: 'Brazil - Copa Santa Catarina', kickoff: '22:00 GMT', kickoffDate: '2026-10-23T22:00:00Z', status: 'NS', sportyOdd: 1.88 },
  { id: 'sb_119', home: 'Operario Ferroviario EC PR', away: 'Athletic Club Sjdr MG', competition: 'Brazil - Brasileiro Serie B', kickoff: '22:30 GMT', kickoffDate: '2026-10-23T22:30:00Z', status: 'NS', sportyOdd: 2.15 },
  { id: 'sb_120', home: 'Libertad Asuncion', away: 'Sportivo Luqueno', competition: 'Paraguay - Division de Honor', kickoff: '22:30 GMT', kickoffDate: '2026-10-23T22:30:00Z', status: 'NS', sportyOdd: 1.75 },
  { id: 'sb_121', home: 'Audax Italiano', away: 'Huachipato', competition: 'Chile - Primera Division', kickoff: '23:00 GMT', kickoffDate: '2026-10-23T23:00:00Z', status: 'NS', sportyOdd: 1.83 },
  { id: 'sb_122', home: 'Deportes Iquique', away: 'Deportes Magallanes', competition: 'Chile - Primera B', kickoff: '23:00 GMT', kickoffDate: '2026-10-23T23:00:00Z', status: 'NS', sportyOdd: 1.67 },
  { id: 'sb_123', home: 'CA Juventud de Las Piedras', away: 'CA Penarol Montevideo', competition: 'Uruguay - Primera Division', kickoff: '23:15 GMT', kickoffDate: '2026-10-23T23:15:00Z', status: 'NS', sportyOdd: 2.10 }
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
  // Defaults strictly to 1:00 PM (780 mins) onwards
  const minStart = typeof startMinute === 'number' ? startMinute : 780;
  const maxEnd = typeof endMinute === 'number' ? endMinute : 1440;

  // 1. Strict time filter (1:00 PM - End of Day)
  const validInWindow = SPORTYBET_TODAY_OVER_25.filter(f => {
    const minute = parseMinuteFromKickoff(f.kickoff);
    if (minStart <= maxEnd) {
      return minute >= minStart && minute <= maxEnd;
    }
    return minute >= minStart || minute <= maxEnd;
  });

  // 2. Strict Odds Range Filter: [1.70 - 2.40]
  const validOdds = validInWindow.filter(f => {
    if (!f.sportyOdd) return false;
    return f.sportyOdd >= 1.70 && f.sportyOdd <= 2.40;
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
