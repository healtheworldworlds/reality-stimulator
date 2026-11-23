import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'telegram-channels.json');
const BOOTSTRAP = 'SportybetOfficialChannel';
const MAX_CHANNELS = 40;
const MAX_DEPTH = 2;

function normalizeChannel(value) {
  if (typeof value !== 'string') return null;
  const match = value
    .trim()
    .replace(/^https?:\/\/t\.me\/(?:s\/)?/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim();
  return /^[A-Za-z0-9_]{4,64}$/.test(match) ? match : null;
}

function readExisting() {
  if (!fs.existsSync(CONFIG_FILE)) return [BOOTSTRAP];
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const values = Array.isArray(parsed) ? parsed : parsed?.channels;
    return [BOOTSTRAP, ...(Array.isArray(values) ? values.map(normalizeChannel).filter(Boolean) : [])];
  } catch {
    return [BOOTSTRAP];
  }
}

function writeExisting(channels) {
  const ordered = [BOOTSTRAP, ...channels.filter((channel) => channel !== BOOTSTRAP)];
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
  return ordered;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value) {
  return decodeEntities(value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractChannelCandidates(html) {
  const found = new Set();
  const patterns = [
    /https?:\/\/(?:www\.)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,64})/gi,
    /\b(?:tg:\/\/resolve\?domain=|@)([A-Za-z0-9_]{4,64})\b/gi,
    /(?:joinchat|channel)\/([A-Za-z0-9_]{4,64})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const channel = normalizeChannel(match[1]);
      if (channel) found.add(channel);
    }
  }
  return [...found];
}

function extractBookingCodes(html) {
  const text = stripHtml(html).toUpperCase();
  const sportybet = [...text.matchAll(/\b[A-Z0-9]{6}\b/g)]
    .map((match) => match[0])
    .filter((code) => /[0-9]/.test(code));
  const betway = [...text.matchAll(/\bBW[A-Z0-9]{6}\b/g)]
    .map((match) => match[0])
    .filter((code) => /[0-9]/.test(code.slice(2)));
  return [...new Set([...sportybet, ...betway])];
}

async function fetchPreview(channel) {
  const response = await fetch(`https://t.me/s/${encodeURIComponent(channel)}`, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; RealitySimulator/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function searchWeb(browser) {
  const queries = [
    'site:t.me "SportyBet" "Ghana"',
    'site:t.me "booking code" "SportyBet"',
    'site:t.me "Betway" "Ghana"',
  ];
  const found = new Set();
  const page = await browser.newPage();
  try {
    for (const query of queries) {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      const html = await page.content();
      for (const channel of extractChannelCandidates(html)) found.add(channel);
    }
  } finally {
    await page.close();
  }

  const directoryUrls = [
    'https://t.me/s/SportybetOfficialChannel',
  ];
  for (const url of directoryUrls) {
    const html = await fetchPreview(url.split('/').at(-1)).catch(() => null);
    if (html) for (const channel of extractChannelCandidates(html)) found.add(channel);
  }
  return [...found];
}

export async function discoverTelegramChannels() {
  const known = [...new Set(readExisting().map(normalizeChannel).filter(Boolean))];
  const queue = known.map((channel) => ({ channel, depth: 0 }));
  const queued = new Set(queue.map((item) => item.channel));
  const verified = new Set(known);
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    for (const channel of await searchWeb(browser)) {
      if (!queued.has(channel) && queue.length < 250) {
        queued.add(channel);
        queue.push({ channel, depth: 0 });
      }
    }
  } catch (error) {
    console.warn(`Web discovery unavailable: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close();
  }

  let index = 0;
  while (index < queue.length && verified.size < MAX_CHANNELS) {
    const item = queue[index++];
    let html;
    try {
      html = await fetchPreview(item.channel);
    } catch {
      html = null;
    }
    if (!html) continue;

    const codes = extractBookingCodes(html);
    if (codes.length) verified.add(item.channel);

    if (item.depth < MAX_DEPTH) {
      for (const channel of extractChannelCandidates(html)) {
        if (!queued.has(channel) && queue.length < 250) {
          queued.add(channel);
          queue.push({ channel, depth: item.depth + 1 });
        }
      }
    }
  }

  return writeExisting([...verified]);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const channels = await discoverTelegramChannels();
  console.log(`Discovered ${channels.length} Telegram channel(s).`);
  for (const channel of channels) console.log(channel);
}
