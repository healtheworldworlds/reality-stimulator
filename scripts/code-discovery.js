import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const SEEN_CODES_FILE = 'seen_sportybet_codes.json';
const MAX_SEEN_CODES = 2000;

function loadLocalEnv(root) {
  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    const key = match[1];
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function normalizeCodeDiscovery(code, bookmaker, source = 'telegram', extra = {}) {
  const value = String(code ?? '').trim().toUpperCase();
  if (bookmaker !== 'sportybet' || !/^[A-Z0-9]{6}$/.test(value) || !/\d/.test(value)) return null;
  return {
    code: value,
    bookmaker,
    source,
    ...extra,
  };
}

export function extractTaggedCodes(text, allowForValidation = false) {
  const clean = String(text ?? '').replace(/https?:\/\/\S+/gi, ' ').toUpperCase();
  const found = [];
  const common = new Set([
    'SPORTY', 'DOUBLE', 'CHANCE', 'SINGLE', 'TICKET', 'WINNER', 'ONLINE',
    'TODAY', 'RESULT', 'MATCHES', 'FOOTBALL', 'ODDS', 'READY', 'SURE', 'BEST',
    'WINNING', 'PREDICT', 'VOUCHER', 'BOOKING', 'CODE', 'BETS',
  ]);
  for (const match of clean.matchAll(/\b[A-Z0-9]{6}\b/g)) {
    if (!common.has(match[0])) {
      found.push(normalizeCodeDiscovery(match[0], 'sportybet', 'telegram', { allowForValidation }));
    }
  }
  return deduplicateDiscoveries(found);
}

export function deduplicateDiscoveries(records) {
  const seen = new Set();
  return records.filter((record) => {
    if (!record || typeof record !== 'object') return false;
    const key = `${record.bookmaker}:${record.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function mergeDiscoveryOutput(root, records) {
  loadLocalEnv(root);
  const generatedFile = path.join(root, 'generated_codes.txt');
  const manifestFile = path.join(root, 'generated_slips.jsonl');
  const seenCodesFile = path.join(root, SEEN_CODES_FILE);
  const existingCodes = fs.existsSync(generatedFile)
    ? fs.readFileSync(generatedFile, 'utf8').split(/\r?\n/).map((line) => line.trim().toUpperCase()).filter((code) =>
      /^[A-Z0-9]{6}$/.test(code) && /[0-9]/.test(code))
    : [];
  const incomingRecords = deduplicateDiscoveries(records)
    .filter((record) => record?.bookmaker === 'sportybet')
    .sort((a, b) => Date.parse(b.timestamp ?? b.time ?? '') - Date.parse(a.timestamp ?? a.time ?? ''));
  const existingManifest = fs.existsSync(manifestFile)
    ? fs.readFileSync(manifestFile, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter((entry) => entry?.bookie === 'sportybet:gh' &&
      typeof entry.code === 'string' &&
      /^[A-Z0-9]{6}$/.test(entry.code.toUpperCase()) &&
      /[0-9]/.test(entry.code))
    : [];
  let localSeen = [];
  if (fs.existsSync(seenCodesFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(seenCodesFile, 'utf8'));
      localSeen = Array.isArray(state.codes)
        ? state.codes.map((entry) => typeof entry === 'string' ? entry : entry?.code)
          .filter((code) => typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code.toUpperCase()) && /\d/.test(code))
          .map((code) => code.toUpperCase())
        : [];
    } catch (error) {
      console.warn(`Could not read ${SEEN_CODES_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const seenSet = new Set([...localSeen, ...existingCodes, ...existingManifest.map((entry) => entry.code.toUpperCase())]);
  const newRecords = incomingRecords.filter((record) => !seenSet.has(record.code.toUpperCase()));
  const newCodeSet = new Set(newRecords.map((record) => record.code.toUpperCase()));
  const prioritizedIncoming = newRecords.length
    ? [...newRecords, ...incomingRecords.filter((record) => !newCodeSet.has(record.code.toUpperCase()))]
    : incomingRecords;
  const allRecords = deduplicateDiscoveries([
    ...prioritizedIncoming,
    ...existingCodes.map((code) => normalizeCodeDiscovery(code, 'sportybet', 'existing')),
  ].filter(Boolean));

  fs.writeFileSync(generatedFile, allRecords.length
    ? `${allRecords.map((record) => record.code).join('\n')}\n`
    : '', 'utf8');

  const manifestKeys = new Set(existingManifest.map((entry) => `${entry.bookie}:${entry.code}`));
  const timestamp = new Date().toISOString();
  for (const record of allRecords) {
    if (record.source === 'existing') continue;
    const bookie = 'sportybet:gh';
    const key = `${bookie}:${record.code}`;
    if (manifestKeys.has(key)) continue;
    const identity = `${record.code}:${record.source}:${record.timestamp ?? timestamp}`;
    const manifest = {
      id: crypto.createHash('sha256').update(identity).digest('hex').slice(0, 16),
      slipNumber: null,
      bookie,
      country: 'GH',
      market: record.market ?? null,
      code: record.code,
      foldCount: record.foldCount ?? null,
      combinedOdds: record.combinedOdds ?? record.odds ?? null,
      legs: [],
      source: record.source,
      timestamp,
    };
    existingManifest.push(manifest);
    manifestKeys.add(key);
  }
  fs.writeFileSync(manifestFile, existingManifest.length
    ? `${existingManifest.map((entry) => JSON.stringify(entry)).join('\n')}\n`
    : '', 'utf8');
  await publishNewDiscoveries(root, newRecords);
  const currentCodes = incomingRecords
    .map((record) => record.code.toUpperCase());
  const orderedSeenCodes = [...new Set([
    ...currentCodes,
    ...localSeen,
    ...existingCodes,
    ...existingManifest.map((entry) => entry.code.toUpperCase()),
  ])].slice(0, MAX_SEEN_CODES);
  fs.writeFileSync(seenCodesFile, `${JSON.stringify({ codes: orderedSeenCodes }, null, 2)}\n`, 'utf8');
  return allRecords;
}

export async function publishNewDiscoveries(root, records, args = process.argv.slice(2)) {
  loadLocalEnv(root);
  const endpoint = args.includes('--no-publish')
    ? ''
    : (process.env.LIVE_CODES_ENDPOINT?.trim()
      || 'https://www.realitysimulator.live/api/live-codes');
  const adminKey = process.env.LIVE_CODES_ADMIN_KEY?.trim()
    || process.env.ADMIN_MASTER_KEY?.trim();
  if (!endpoint || !adminKey) return [];

  const published = [];
  for (const record of deduplicateDiscoveries(records)
    .filter((item) => item.bookmaker === 'sportybet' && item.source !== 'existing')) {
    const legs = Array.isArray(record.legs) ? record.legs : [];
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          code: record.code,
          bookie: 'sportybet',
          countryCode: 'GHANA',
          channel: record.source === 'code-hub' ? 'sportybet-code-hub' : record.channel || 'telegram-ocr',
          source: record.source === 'manual' ? 'manual' : 'generated',
          time: record.timestamp || new Date().toISOString(),
          legs,
          foldCount: record.foldCount ?? null,
          combinedOdds: record.combinedOdds ?? record.odds ?? null,
          verified: record.verified === true,
          ocr: record.source === 'telegram',
          sourceDomain: record.sourceDomain || null,
          channel: record.source === 'code-hub'
            ? 'sportybet-code-hub'
            : record.sourceDomain
              ? `web:${record.sourceDomain}`
              : record.channel || 'telegram-ocr',
        }),
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        console.error(`Live publish failed for ${record.bookmaker}/${record.code}: ${payload?.error || `HTTP ${response.status}`}`);
        continue;
      }
      published.push(record);
    } catch (error) {
      console.error(`Live publish failed for ${record.bookmaker}/${record.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return published;
}

export function isValidationEnabled(args) {
  return args.includes('--validate') || process.env.VALIDATE_SCRAPED_CODES?.toLowerCase() === 'true';
}

export async function validateDiscoveredCodes(records) {
  if (!records.length) return [];
  const browser = await chromium.launch({ headless: true });
  const verified = [];
  try {
    for (const record of deduplicateDiscoveries(records)) {
      if (record.bookmaker !== 'sportybet') continue;
      const result = await validateSportyBet(browser, record.code);
      if (result.valid) verified.push({ ...record, verified: true, ...result });
      else console.warn(`Discarded invalid/expired ${record.bookmaker} code ${record.code}: ${result.reason}`);
    }
  } finally {
    await browser.close();
  }
  return verified;
}

async function fillAndLoad(page, code, inputTerms) {
  const inputs = page.locator('input');
  const count = await inputs.count();
  let input = null;
  for (let index = 0; index < count; index += 1) {
    const candidate = inputs.nth(index);
    const label = [
      await candidate.getAttribute('aria-label').catch(() => ''),
      await candidate.getAttribute('placeholder').catch(() => ''),
      await candidate.getAttribute('name').catch(() => ''),
    ].join(' ').toLowerCase();
    if (inputTerms.some((term) => label.includes(term))) {
      input = candidate;
      break;
    }
  }
  if (!input) input = count ? inputs.first() : null;
  if (!input) return { valid: false, reason: 'booking-code input not found' };
  await input.fill(code);

  const buttons = page.locator('button, [role="button"], a');
  const buttonCount = await buttons.count();
  for (let index = 0; index < buttonCount; index += 1) {
    const button = buttons.nth(index);
    const text = (await button.innerText().catch(() => '')).trim().toLowerCase();
    if (/load|check|submit|enter|add/.test(text)) {
      await button.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1800);
      break;
    }
  }
  return null;
}

async function readValidationResult(page) {
  const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const lower = body.toLowerCase();
  if (/invalid|expired|not found|cannot be found|wrong code|no bet/.test(lower)) {
    return { valid: false, reason: body.slice(-300) };
  }
  const selectionMatch = lower.match(/(?:selections?|legs?|betslip)\D{0,20}(\d{1,3})/);
  const oddsMatches = [...body.matchAll(/(?:total odds|odds)\D{0,10}(\d+(?:\.\d+)?)/gi)];
  const legCount = selectionMatch ? Number(selectionMatch[1]) : null;
  const combinedOdds = oddsMatches.length ? Number(oddsMatches.at(-1)[1]) : null;
  if (legCount === null && combinedOdds === null) {
    return { valid: false, reason: 'no verified betslip details found' };
  }
  return { valid: true, reason: '', foldCount: legCount, legCount, combinedOdds };
}

async function validateSportyBet(browser, code) {
  const page = await browser.newPage();
  try {
    await page.goto('https://www.sportybet.com/gh/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const fillResult = await fillAndLoad(page, code, ['booking', 'bet code', 'code']);
    if (fillResult) return fillResult;
    return await readValidationResult(page);
  } catch (error) {
    return { valid: false, reason: error.message };
  } finally {
    await page.close();
  }
}
