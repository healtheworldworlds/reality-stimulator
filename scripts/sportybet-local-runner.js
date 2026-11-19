import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { chromium, devices } from 'playwright';

const SPORTYBET_URL = 'https://www.sportybet.com/gh';
const DEFAULT_PROFILE = '.sportybet-profile';
const DEFAULT_MANIFEST = 'generated_slips.jsonl';
const MAX_SCROLL_ATTEMPTS = 50;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

const setupMode = hasFlag('setup');
const headless = hasFlag('headless');
const source = getArg('source', 'auto');
const profileDir = path.resolve(getArg('profile', DEFAULT_PROFILE));
const manifestFile = path.resolve(getArg('manifest', DEFAULT_MANIFEST));
const apiUrl = getArg('api-url', process.env.LIVE_CODES_ENDPOINT || '/api/live-codes');
const slipSelector = getArg('slip', '');

function usage() {
  console.log(`Usage:
  node scripts/sportybet-local-runner.js --setup [--profile=.sportybet-profile]
  node scripts/sportybet-local-runner.js --source=api --api-url=https://.../api/live-codes
  node scripts/sportybet-local-runner.js --source=manifest --manifest=generated_slips.jsonl

Options:
  --setup       Open SportyBet Ghana headed for manual login/session verification.
  --headless    Run loading without a visible browser (not recommended for first runs).
  --slip=ID     Load one slip by manifest/API id or numeric list index.
  --profile=DIR Persistent Chromium profile directory.
  --source=auto|api|manifest
`);
}

function normalized(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function assertGhanaSlip(slip) {
  if (!slip || slip.bookie !== 'sportybet:gh' || slip.country !== 'GH') {
    throw new Error('Input slip is not locked to sportybet:gh / GH.');
  }
  if (!Array.isArray(slip.legs) || slip.legs.length === 0) {
    throw new Error('Input slip has no structured legs.');
  }
  const ids = new Set();
  for (const leg of slip.legs) {
    if (!leg || typeof leg.event_id !== 'string' || !leg.market || !leg.pick || ids.has(leg.event_id)) {
      throw new Error(`Slip ${slip.id ?? 'unknown'} contains an invalid or duplicate leg.`);
    }
    ids.add(leg.event_id);
  }
  return slip;
}

async function loadManifest() {
  const content = await fs.readFile(manifestFile, 'utf8');
  return content.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return assertGhanaSlip(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid manifest line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

async function loadApiSlips() {
  if (!/^https?:\/\//i.test(apiUrl)) {
    throw new Error('Use an absolute --api-url or set LIVE_CODES_ENDPOINT when using --source=api.');
  }
  const response = await fetch(apiUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !Array.isArray(payload.sportybet)) {
    throw new Error(payload?.error ?? `Live-code API unavailable (HTTP ${response.status}).`);
  }
  return payload.sportybet
    .filter((slip) => slip.source === 'generated' && slip.bookie === 'sportybet' && slip.countryCode === 'GHANA')
    .map((slip) => assertGhanaSlip({
      ...slip,
      bookie: 'sportybet:gh',
      country: 'GH',
    }));
}

async function loadSlips() {
  if (source === 'manifest') return loadManifest();
  if (source === 'api') return loadApiSlips();
  try {
    return await loadApiSlips();
  } catch (error) {
    console.warn(`API source unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return loadManifest();
  }
}

function chooseSlip(slips) {
  if (slips.length === 0) throw new Error('No Ghana SportyBet slips were found.');
  if (!slipSelector) return slips[0];
  const index = Number(slipSelector);
  if (Number.isInteger(index) && index >= 0 && index < slips.length) return slips[index];
  const match = slips.find((slip) => slip.id === slipSelector);
  if (!match) throw new Error(`No slip matched "${slipSelector}".`);
  return match;
}

async function waitForEnter(prompt) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  await terminal.question(prompt);
  terminal.close();
}

function marketSearchTerms(market) {
  const key = normalized(market);
  if (key.includes('over 1 5') || key.includes('over 1.5') || key.includes('o1 5')) return ['over 1.5', '1.5'];
  if (key.includes('over 2 5') || key.includes('over 2.5') || key.includes('o2 5')) return ['over 2.5', '2.5'];
  if (key.includes('2h') || key.includes('second half')) return ['2nd half', 'second half', '2h'];
  if (key.includes('gg') || key.includes('btts') || key.includes('both teams')) return ['gg/ng', 'both teams', 'btts'];
  if (key.includes('1x2') || key.includes('match result')) return ['1x2', 'match result'];
  return [market];
}

function pickSearchTerms(pick) {
  const key = normalized(pick);
  if (key === 'o' || key.includes('over')) return ['over'];
  if (key === 'u' || key.includes('under')) return ['under'];
  if (key === 'gg' || key.includes('yes')) return ['gg', 'yes'];
  if (key === 'ng' || key.includes('no')) return ['ng', 'no'];
  if (key === 'x' || key.includes('draw')) return ['draw', 'x'];
  if (key === '1' || key.includes('home')) return ['1', 'home'];
  if (key === '2' || key.includes('away')) return ['2', 'away'];
  return [pick];
}

async function selectMarket(page, market) {
  const terms = marketSearchTerms(market);
  const tabs = page.locator('.m-market-tab, [role="tab"], span, div');
  for (const term of terms) {
    const locator = tabs.filter({ hasText: new RegExp(`^${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) {
      await locator.click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function findFixtureCard(page, leg) {
  const eventId = String(leg.event_id);
  const home = normalized(leg.home_team);
  const away = normalized(leg.away_team);
  for (let attempt = 0; attempt < MAX_SCROLL_ATTEMPTS; attempt += 1) {
    const cards = await page.locator('[data-key]:has(.m-event-sport)').all();
    for (const card of cards) {
      const cardId = await card.getAttribute('data-key');
      const text = normalized(await card.innerText().catch(() => ''));
      if (cardId === eventId || (home && away && text.includes(home) && text.includes(away))) return card;
    }
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(400);
  }
  return null;
}

async function selectPick(card, pick) {
  const terms = pickSearchTerms(pick);
  const outcomes = card.locator('[data-op="label-odds"], .m-outcome, button');
  const count = await outcomes.count();
  for (let index = 0; index < count; index += 1) {
    const outcome = outcomes.nth(index);
    const text = normalized(await outcome.innerText().catch(() => ''));
    if (!terms.some((term) => text === normalized(term) || text.includes(normalized(term)))) continue;
    const oddsText = await outcome.innerText().catch(() => '');
    const oddsMatch = oddsText.match(/\d+(?:\.\d+)?/);
    await outcome.scrollIntoViewIfNeeded();
    await outcome.click({ force: true });
    return { selected: true, odds: oddsMatch ? Number(oddsMatch[0]) : null, label: oddsText.trim() };
  }
  return { selected: false, odds: null, label: '' };
}

async function readBetslip(page) {
  const body = normalized(await page.locator('body').innerText().catch(() => ''));
  const countMatches = [...body.matchAll(/(?:betslip|selections?|matches?)\s*[:(]?\s*(\d{1,3})/g)];
  const count = countMatches.length ? Number(countMatches.at(-1)[1]) : null;
  return { count, text: body.slice(-1200) };
}

async function loadSlip(page, slip) {
  const result = {
    slipId: slip.id,
    expectedLegs: slip.legs.length,
    loadedLegs: 0,
    legs: [],
    mismatches: [],
  };
  const selectedMarkets = new Set();
  for (const leg of slip.legs) {
    if (!selectedMarkets.has(leg.market)) {
      if (!(await selectMarket(page, leg.market))) {
        result.mismatches.push({ eventId: leg.event_id, reason: `market not found or suspended: ${leg.market}` });
        continue;
      }
      selectedMarkets.add(leg.market);
    }
    const card = await findFixtureCard(page, leg);
    if (!card) {
      result.mismatches.push({ eventId: leg.event_id, reason: 'fixture not found in SportyBet Ghana fixture list' });
      continue;
    }
    const selection = await selectPick(card, leg.pick);
    if (!selection.selected) {
      result.mismatches.push({ eventId: leg.event_id, reason: `pick unavailable or suspended: ${leg.pick}` });
      continue;
    }
    result.loadedLegs += 1;
    result.legs.push({
      eventId: leg.event_id,
      market: leg.market,
      requestedPick: leg.pick,
      liveOdds: selection.odds,
      label: selection.label,
    });
  }
  result.betslip = await readBetslip(page);
  return result;
}

async function main() {
  if (hasFlag('help') || hasFlag('h')) {
    usage();
    return;
  }
  await fs.mkdir(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    ...devices['iPhone 13'],
    headless,
    locale: 'en-GH',
    timezoneId: 'Africa/Accra',
    viewport: { width: 390, height: 844 },
  });
  const page = context.pages()[0] ?? await context.newPage();
  try {
    await page.goto(SPORTYBET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (setupMode) {
      console.log(`Persistent profile: ${profileDir}`);
      console.log('Log in manually, verify the Ghana SportyBet account/session, then return here.');
      await waitForEnter('Press Enter after session verification to close the browser... ');
      return;
    }
    const slip = chooseSlip(await loadSlips());
    console.log(`Loading ${slip.id} (${slip.legs.length} legs) into SportyBet Ghana…`);
    const result = await loadSlip(page, slip);
    console.log(JSON.stringify(result, null, 2));
    if (result.loadedLegs !== result.expectedLegs) process.exitCode = 2;
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(`SportyBet local runner failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
