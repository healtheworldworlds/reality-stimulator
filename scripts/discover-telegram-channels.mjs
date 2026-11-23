import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'telegram-channels.json');
const BOOTSTRAP = 'SportybetOfficialChannel';
const MAX_CHANNELS = 100;
const MAX_DEPTH = 3;
const FILTERED_PATHS = new Set([
  'share', 'joinchat', 'addstickers', 's', 'iv', 'c', 'proxy',
]);

function normalizeChannel(value) {
  if (typeof value !== 'string') return null;
  const match = value
    .trim()
    .replace(/^https?:\/\/t\.me\/(?:s\/)?/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim();
  if (!/^[A-Za-z0-9_]{4,64}$/.test(match)) return null;
  if (FILTERED_PATHS.has(match.toLowerCase())) return null;
  return match;
}

function readExisting() {
  if (!fs.existsSync(CONFIG_FILE)) return [{
    slug: BOOTSTRAP,
    bookmaker: 'sportybet',
    lastChecked: null,
    codesFound: 0,
  }];
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const values = Array.isArray(parsed) ? parsed : parsed?.channels;
    const records = Array.isArray(values) ? values.map((value) => {
      if (typeof value === 'string') {
        return { slug: normalizeChannel(value), bookmaker: 'both', lastChecked: null, codesFound: 0 };
      }
      const slug = normalizeChannel(value?.slug);
      if (!slug) return null;
      return {
        slug,
        bookmaker: ['sportybet', 'betway', 'both'].includes(value.bookmaker) ? value.bookmaker : 'both',
        lastChecked: typeof value.lastChecked === 'string' ? value.lastChecked : null,
        codesFound: Number.isInteger(value.codesFound) ? value.codesFound : 0,
      };
    }).filter(Boolean) : [];
    if (!records.some((record) => record.slug === BOOTSTRAP)) {
      records.unshift({ slug: BOOTSTRAP, bookmaker: 'sportybet', lastChecked: null, codesFound: 0 });
    }
    return records;
  } catch {
    return [{ slug: BOOTSTRAP, bookmaker: 'sportybet', lastChecked: null, codesFound: 0 }];
  }
}

function writeExisting(channels) {
  const ordered = [...new Map(channels.map((channel) => [channel.slug, channel])).values()];
  const boot = ordered.find((channel) => channel.slug === BOOTSTRAP);
  const rest = ordered.filter((channel) => channel.slug !== BOOTSTRAP);
  const records = boot ? [boot, ...rest] : [
    { slug: BOOTSTRAP, bookmaker: 'sportybet', lastChecked: null, codesFound: 0 },
    ...rest,
  ];
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  return records;
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
    'site:t.me "sportybet" "ghana"',
    'site:t.me "betway" "ghana"',
    'site:t.me "booking code" "sportybet"',
    'site:t.me "booking code" "betway"',
    'site:t.me/s/ sportybet ghana',
    'site:t.me/s/ betway ghana',
    'site:t.me "booking code" "SportyBet"',
    'site:t.me "Betway" "Ghana"',
  ];
  const found = new Set();
  const page = await browser.newPage();
  try {
    const searchEngines = [
      (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    ];
    for (const query of queries) {
      for (const buildUrl of searchEngines) {
        await page.goto(buildUrl(query), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(350);
        const html = await page.content();
        for (const channel of extractChannelCandidates(html)) found.add(channel);
      }
    }
  } finally {
    await page.close();
  }

  const directoryUrls = [
    'https://t.me/s/SportybetOfficialChannel',
    'https://tgstat.com/search?q=SportyBet%20Ghana',
    'https://tgstat.com/search?q=Betway%20Ghana',
    'https://telemetr.io/en/channels/search?query=SportyBet%20Ghana',
    'https://telemetr.io/en/channels/search?query=Betway%20Ghana',
  ];
  for (const url of directoryUrls) {
    try {
      const html = url.startsWith('https://t.me/s/')
        ? await fetchPreview(url.split('/').at(-1))
        : await (await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RealitySimulator/1.0)' },
          signal: AbortSignal.timeout(30000),
        })).text();
      if (html) for (const channel of extractChannelCandidates(html)) found.add(channel);
    } catch {}
  }
  return [...found];
}

export async function discoverTelegramChannels() {
  const existing = readExisting();
  const known = [...new Set(existing.map((record) => record.slug).filter(Boolean))];
  const queue = known.map((channel) => ({ channel, depth: 0 }));
  const queued = new Set(queue.map((item) => item.channel));
  const verified = new Map(existing.map((record) => [record.slug, record]));
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
  while (index < queue.length && [...verified.values()].filter((record) => record.codesFound > 0).length < MAX_CHANNELS) {
    const item = queue[index++];
    let html;
    try {
      html = await fetchPreview(item.channel);
    } catch {
      html = null;
    }
    if (!html) continue;

    const codes = extractBookingCodes(html);
    if (codes.length) {
      const text = stripHtml(html).toUpperCase();
      const hasSportybet = [...text.matchAll(/\b[A-Z0-9]{6}\b/g)].some((match) => /[0-9]/.test(match[0]));
      const hasBetway = [...text.matchAll(/\bBW[A-Z0-9]{6}\b/g)].some((match) => /[0-9]/.test(match[0].slice(2)));
      const bookmaker = hasSportybet && hasBetway ? 'both'
        : hasBetway ? 'betway'
        : 'sportybet';
      verified.set(item.channel, {
        slug: item.channel,
        bookmaker,
        lastChecked: new Date().toISOString(),
        codesFound: codes.length,
      });
    } else {
      const prior = verified.get(item.channel);
      if (prior) {
        verified.set(item.channel, {
          ...prior,
          lastChecked: new Date().toISOString(),
          codesFound: 0,
        });
      }
    }

    if (item.depth < MAX_DEPTH) {
      for (const channel of extractChannelCandidates(html)) {
        if (!queued.has(channel) && queue.length < 250) {
          queued.add(channel);
          queue.push({ channel, depth: item.depth + 1 });
        }
      }
    }
  }

  return writeExisting([...verified.values()]);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const channels = await discoverTelegramChannels();
  const active = channels.filter((channel) => channel.codesFound > 0);
  console.log(`Discovered ${active.length} active Telegram channel(s); ${channels.length} total cache entries.`);
  for (const channel of channels) {
    console.log(`${channel.slug}\t${channel.bookmaker}\tcodes=${channel.codesFound}\tchecked=${channel.lastChecked ?? 'never'}`);
  }
}
