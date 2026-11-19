const GOAL_MARKETS = new Set(['OVER_1_5', 'OVER_2_5', '2H_HIGHEST', 'NO_THREE_GOAL_STREAK', 'GG_NG']);

function toFiniteStreak(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

function parseStreakFromText(text, teamLabel) {
  const escaped = teamLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}.{0,80}?(?:scoring|goal)[^\\d]{0,20}(\\d+)`, 'i').exec(text);
  return match ? toFiniteStreak(match[1]) : null;
}

export async function readCardCandidate(card, market, pick, odds) {
  return card.evaluate((element, { market, pick, odds }) => {
    const nodes = [element, ...element.querySelectorAll('*')];
    const attributes = Object.fromEntries(nodes.flatMap((child) =>
      [...child.attributes]
        .filter(({ name }) => /streak|scor|goal.?run|form/i.test(name))
        .map(({ name, value }) => [name.toLowerCase(), value]),
    ));
    const text = element.innerText ?? '';
    const teamNodes = [...element.querySelectorAll('[class*="team" i], [class*="home" i], [class*="away" i]')];
    const teams = teamNodes.map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 2);
    return { market, pick, odds, attributes, text, teams };
  }, { market, pick, odds });
}

export function extractGoalStreaks(candidate) {
  const values = { home: null, away: null };
  const attributes = candidate.attributes ?? {};
  const assign = (side, value) => {
    if (values[side] === null) values[side] = toFiniteStreak(value);
  };
  for (const [key, value] of Object.entries(attributes)) {
    if (/home/.test(key)) assign('home', value);
    if (/away/.test(key)) assign('away', value);
  }
  const [home, away] = candidate.teams ?? [];
  if (values.home === null && home) values.home = parseStreakFromText(candidate.text ?? '', home);
  if (values.away === null && away) values.away = parseStreakFromText(candidate.text ?? '', away);
  return values;
}

export function filterCandidate(candidate, market) {
  if (!GOAL_MARKETS.has(market)) return { accepted: true, reason: '' };
  const streaks = extractGoalStreaks(candidate);
  if (streaks.home === null || streaks.away === null) {
    return { accepted: false, reason: 'missing home/away scoring-streak data' };
  }
  if (streaks.home > 3 || streaks.away > 3) {
    return { accepted: false, reason: `scoring streak exceeds 3 (home=${streaks.home}, away=${streaks.away})` };
  }
  return { accepted: true, reason: '' };
}

export function marketCandidates(market) {
  return {
    OVER_1_5: ['over_1_5', 'over 1.5', 'o1.5', 'totals'],
    NO_THREE_GOAL_STREAK: ['over_1_5', 'over 1.5', 'no goal streak', 'totals'],
    OVER_2_5: ['over_2_5', 'over 2.5', 'o2.5', 'totals'],
    '2H_HIGHEST': ['2h_highest', '2nd half highest', 'second half highest'],
    '1X2': ['1x2', 'match result', 'full time result'],
    GG_NG: ['gg_ng', 'gg/ng', 'both teams to score', 'btts'],
  }[market];
}

export function pickCandidates(market, pick) {
  const normalized = pick.toLowerCase().replace(/^label-odds$/, '');
  if (market === 'OVER_1_5' || market === 'OVER_2_5' || market === 'NO_THREE_GOAL_STREAK') return ['over', 'o'];
  if (market === 'GG_NG') return normalized.includes('no') || normalized === 'ng' ? ['ng', 'no'] : ['gg', 'yes'];
  if (market === '2H_HIGHEST') return normalized.includes('away') ? ['away', '2'] : ['home', '1'];
  return [normalized, normalized === 'draw' ? 'x' : normalized];
}
