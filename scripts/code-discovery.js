import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

export function normalizeCodeDiscovery(code, bookmaker, source = 'telegram', extra = {}) {
  const value = String(code ?? '').trim().toUpperCase();
  if (bookmaker === 'sportybet' && !/^[A-Z0-9]{6}$/.test(value)) return null;
  if (bookmaker === 'betway' && !/^BW(?:[A-Z0-9]{6}|[A-Z0-9]{8})$/.test(value)) return null;
  if (!['sportybet', 'betway'].includes(bookmaker)) return null;
  return {
    code: value,
    bookmaker,
    source,
    ...extra,
  };
}

export function extractTaggedCodes(text) {
  const clean = String(text ?? '').replace(/https?:\/\/\S+/gi, ' ').toUpperCase();
  const found = [];
  for (const match of clean.matchAll(/\bBW(?:[A-Z0-9]{6}|[A-Z0-9]{8})\b/g)) {
    found.push(normalizeCodeDiscovery(match[0], 'betway'));
  }
  const common = new Set([
    'SPORTY', 'DOUBLE', 'CHANCE', 'BETWAY', 'SINGLE', 'TICKET', 'WINNER', 'ONLINE',
    'TODAY', 'RESULT', 'MATCHES', 'FOOTBALL', 'ODDS', 'READY', 'SURE', 'BEST',
    'WINNING', 'PREDICT', 'VOUCHER', 'BOOKING', 'CODE', 'BETS',
  ]);
  for (const match of clean.matchAll(/\b[A-Z0-9]{6}\b/g)) {
    if (!common.has(match[0])) found.push(normalizeCodeDiscovery(match[0], 'sportybet'));
  }
  return deduplicateDiscoveries(found);
}

export function deduplicateDiscoveries(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = `${record.bookmaker}:${record.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeDiscoveryOutput(root, records) {
  const generatedFile = path.join(root, 'generated_codes.txt');
  const manifestFile = path.join(root, 'generated_slips.jsonl');
  const existingCodes = fs.existsSync(generatedFile)
    ? fs.readFileSync(generatedFile, 'utf8').split(/\r?\n/).map((line) => line.trim().toUpperCase()).filter(Boolean)
    : [];
  const allRecords = deduplicateDiscoveries([
    ...existingCodes.map((code) => normalizeCodeDiscovery(
      code,
      /^BW(?:[A-Z0-9]{6}|[A-Z0-9]{8})$/.test(code) ? 'betway' : 'sportybet',
      'existing',
    )),
    ...records,
  ].filter(Boolean));

  fs.writeFileSync(generatedFile, allRecords.length
    ? `${allRecords.map((record) => record.code).join('\n')}\n`
    : '', 'utf8');

  const existingManifest = fs.existsSync(manifestFile)
    ? fs.readFileSync(manifestFile, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean)
    : [];
  const manifestKeys = new Set(existingManifest.map((entry) => `${entry.bookie}:${entry.code}`));
  const timestamp = new Date().toISOString();
  for (const record of allRecords) {
    if (record.source === 'existing') continue;
    const bookie = record.bookmaker === 'betway' ? 'betway:gh' : 'sportybet:gh';
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
  return allRecords;
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
      const result = record.bookmaker === 'sportybet'
        ? await validateSportyBet(browser, record.code)
        : await validateBetway(browser, record.code);
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

async function validateBetway(browser, code) {
  const page = await browser.newPage();
  try {
    await page.goto('https://betway.com.gh/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const fillResult = await fillAndLoad(page, code, ['booking', 'bet code', 'betway code', 'code']);
    if (fillResult) return fillResult;
    return await readValidationResult(page);
  } catch (error) {
    return { valid: false, reason: error.message };
  } finally {
    await page.close();
  }
}
