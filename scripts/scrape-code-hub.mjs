import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deduplicateDiscoveries,
  mergeDiscoveryOutput,
  normalizeCodeDiscovery,
  isValidationEnabled,
  validateDiscoveredCodes,
} from './code-discovery.js';

const args = process.argv.slice(2);
const url = 'https://mobile.sportybet.com/gh/m/code-hub/codes';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseCodeHubText(text) {
  const records = [];
  const lines = String(text ?? '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const blockPattern = /^(.{0,120}?)\b([A-Z0-9]{6}\b)/i;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(blockPattern);
    if (!match) continue;
    const code = match[2].toUpperCase();
    const record = normalizeCodeDiscovery(code, 'sportybet', 'code-hub', {
      allowForValidation: isValidationEnabled(args),
    });
    if (!record) continue;
    const context = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join(' ');
    const foldMatch = context.match(/(?:fold|legs?|selections?)\s*[:\-]?\s*(\d{1,3})/i);
    const oddsMatch = context.match(/(?:odds?|total odds?)\s*[:\-]?\s*(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*odds?\b/i);
    records.push({
      ...record,
      foldCount: foldMatch ? Number(foldMatch[1]) : null,
      odds: oddsMatch ? Number(oddsMatch[1] ?? oddsMatch[2]) : null,
      market: null,
      timestamp: new Date().toISOString(),
    });
  }
  return deduplicateDiscoveries(records);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: 'en-GH',
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  let records = parseCodeHubText(bodyText);
  if (!records.length) {
    const elements = await page.locator('button, a, div, span').allInnerTexts();
    records = parseCodeHubText(elements.join('\n'));
  }

  if (isValidationEnabled(args)) records = await validateDiscoveredCodes(records);
  await mergeDiscoveryOutput(root, records);
  console.log(`Discovered ${records.length} SportyBet Ghana code(s) from Code Hub.`);
  for (const record of records) {
    console.log(JSON.stringify(record));
  }
} finally {
  await browser.close();
}
