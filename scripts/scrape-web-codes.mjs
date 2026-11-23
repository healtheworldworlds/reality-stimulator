import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  deduplicateDiscoveries,
  mergeDiscoveryOutput,
  normalizeCodeDiscovery,
} from './code-discovery.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANNELS_FILE = path.join(ROOT, 'telegram-channels.json');
const STOP_WORDS = new Set([
  'FAILED', 'RELOAD', 'BETWAY', 'SPORTS', 'GHANA', 'LOGOUT', 'SPORTY', 'SPORTYBET',
  'BOOKING', 'CODE', 'CODES', 'TODAY', 'TICKET', 'VOUCHER', 'WINNER', 'SUBMIT',
  'CANCEL', 'MARKET', 'EVENTS',
]);

function domainLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown-web';
  }
}

function extractCodes(text, sourceDomain) {
  const clean = String(text ?? '').replace(/https?:\/\/\S+/gi, ' ').toUpperCase();
  const records = [];
  for (const match of clean.matchAll(/\bBW[A-Z0-9]{6}\b/g)) {
    if (!/[0-9]/.test(match[0].slice(2))) continue;
    const record = normalizeCodeDiscovery(match[0], 'betway', 'web', { sourceDomain });
    if (record) records.push(record);
  }
  for (const match of clean.matchAll(/\b[A-Z0-9]{6}\b/g)) {
    const code = match[0];
    if (!/[0-9]/.test(code) || STOP_WORDS.has(code)) continue;
    const record = normalizeCodeDiscovery(code, 'sportybet', 'web', { sourceDomain });
    if (record) records.push(record);
  }
  return deduplicateDiscoveries(records);
}

function extractTelegramChannels(text) {
  const found = new Set();
  const filtered = new Set(['share', 'joinchat', 'addstickers', 's', 'iv', 'c', 'proxy']);
  for (const match of String(text).matchAll(/https?:\/\/(?:www\.)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,64})/gi)) {
    if (!filtered.has(match[1].toLowerCase())) found.add(match[1]);
  }
  for (const match of String(text).matchAll(/\b@([A-Za-z0-9_]{4,64})\b/g)) {
    if (!filtered.has(match[1].toLowerCase())) found.add(match[1]);
  }
  return [...found];
}

function readChannelCache() {
  if (!fs.existsSync(CHANNELS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed?.channels || [];
  } catch {
    return [];
  }
}

function saveChannelCandidates(slugs) {
  if (!slugs.length) return;
  const now = new Date().toISOString();
  const bySlug = new Map();
  for (const entry of readChannelCache()) {
    if (typeof entry === 'string') bySlug.set(entry, { slug: entry, bookmaker: 'both', lastChecked: null, codesFound: 0 });
    else if (entry?.slug) bySlug.set(entry.slug, entry);
  }
  for (const slug of slugs) {
    const prior = bySlug.get(slug) || { slug, bookmaker: 'both', lastChecked: null, codesFound: 0 };
    bySlug.set(slug, { ...prior, lastChecked: now });
  }
  fs.writeFileSync(CHANNELS_FILE, `${JSON.stringify([...bySlug.values()], null, 2)}\n`, 'utf8');
}

async function safePageText(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(500);
    return await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  } catch {
    return '';
  }
}

async function safePageLinks(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(500);
    return await page.locator('a[href]').evaluateAll((links) =>
      links.map((link) => link.href).filter((href) => /^https?:\/\//i.test(href)));
  } catch {
    return [];
  }
}

const browser = await chromium.launch({ headless: true });
const records = [];
const discoveredChannels = [];

try {
  const directSources = [
    'https://www.convertbetcodes.com/',
    'https://www.convertbetcodes.com/free-booking-codes',
    'https://www.sportybet.com/gh/m/code-hub',
  ];

  for (const sourceUrl of directSources) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      const text = await safePageText(page, sourceUrl);
      if (!text) continue;
      records.push(...extractCodes(text, domainLabel(sourceUrl)));
      discoveredChannels.push(...extractTelegramChannels(text));
    } finally {
      await page.close();
    }
  }

  const searches = [
    'https://search.yahoo.com/search?p=sportybet+booking+code+today+ghana',
    'https://search.yahoo.com/search?p=betway+ghana+booking+code+today',
  ];
  for (const searchUrl of searches) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      let links = await safePageLinks(page, searchUrl);
      links = links
        .filter((href) => !/^https?:\/\/(?:r\.search\.yahoo\.com|search\.yahoo\.com)/i.test(href))
        .filter((href) => {
          try {
            const host = new URL(href).hostname;
            return !/^(?:localhost|example\.com)$/i.test(host);
          } catch {
            return false;
          }
        })
        .slice(0, 5);

      for (const resultUrl of links) {
        const resultPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        try {
          const text = await safePageText(resultPage, resultUrl);
          if (!text) continue;
          const sourceDomain = `yahoo-web:${domainLabel(resultUrl)}`;
          records.push(...extractCodes(text, sourceDomain));
          discoveredChannels.push(...extractTelegramChannels(text));
        } finally {
          await resultPage.close();
        }
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

saveChannelCandidates(discoveredChannels);
const uniqueRecords = deduplicateDiscoveries(records);
await mergeDiscoveryOutput(ROOT, uniqueRecords);
console.log(`Discovered ${uniqueRecords.length} web booking code(s) across ${new Set(uniqueRecords.map((record) => record.sourceDomain)).size} source domain(s).`);
for (const record of uniqueRecords) console.log(JSON.stringify(record));
