import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'telegram-channels.json');
const BOOTSTRAP = 'SportybetOfficialChannel';
const MAX_CHANNELS = 100;
const MAX_DEPTH = 2;
const MAX_VALIDATION_QUEUE = 60;
const FILTERED_PATHS = new Set([
  'share', 'joinchat', 'addstickers', 's', 'iv', 'c', 'proxy',
  'username', 'usernames', 'contest', 'escrow', 'leverage', 'designers',
  'botnews', 'cointelegraph', 'durov', 'rainbetcom', 'walt_news',
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
  const ordered = [...new Map(channels.map((channel) => [channel.slug, channel])).values()]
    .filter((channel) => channel.slug === BOOTSTRAP || channel.codesFound > 0);
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

function previewHasBettingKeywords(html) {
  const titleMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:og:title|description)["'][^>]+content=["']([^"']*)["']/gi);
  const descriptionMatch = html.match(/<div[^>]+class=["'][^"']*tgme_page_description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const titleDescription = `${titleMatch?.join(' ') ?? ''} ${descriptionMatch ? stripHtml(descriptionMatch[1]) : ''}`.toUpperCase();
  return /\b(SPORTYBET|BETWAY|BOOKING CODE|GHANA|BETTING)\b/.test(titleDescription);
}

async function fetchPreview(channel) {
  const response = await fetch(`https://t.me/s/${encodeURIComponent(channel)}`, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; RealitySimulator/1.0)',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function safeGetHtml(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.content();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('page is navigating and changing the content')) throw error;
      await page.waitForTimeout(500);
    }
  }
  throw new Error('page content remained unstable after navigation retries');
}

async function fetchSearchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function searchWeb(browser) {
  const queries = [
    'site:t.me sportybet ghana',
    'site:t.me betway ghana',
    'site:t.me booking code sportybet',
    'site:t.me booking code betway',
    '"t.me/" "sportybet" booking code',
    '"t.me/" "betway" ghana code',
  ];
  const found = new Set();
  const page = await browser.newPage();
  try {
    const searchEngines = [
      { name: 'Bing', buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}` },
    ];
    for (const query of queries) {
      for (const engine of searchEngines) {
        const browserUrl = engine.buildUrl(query);
        try {
          const html = await safeGetHtml(page, browserUrl);
          for (const channel of extractChannelCandidates(html)) found.add(channel);
        } catch (error) {
          console.warn(`${engine.name} browser query failed (${query}): ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
          const html = await fetchSearchHtml(browserUrl);
          for (const channel of extractChannelCandidates(html)) found.add(channel);
        } catch (error) {
          console.warn(`${engine.name} HTTP query failed (${query}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } finally {
    await page.close();
  }

  const directUrls = [
    ...queries.map((query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`),
    'https://tgstat.com/en/search?q=sportybet',
    'https://tgstat.com/en/search?q=betway',
    'https://telemetr.io/en/channels?q=sportybet',
    'https://telemetr.io/en/channels?q=betway',
    'https://tlgrm.eu/channels?q=sportybet',
    'https://tlgrm.eu/channels?q=betway',
  ];
  const directResults = await Promise.allSettled(directUrls.map(fetchSearchHtml));
  for (const result of directResults) {
    if (result.status === 'fulfilled') {
      for (const channel of extractChannelCandidates(result.value)) found.add(channel);
    }
  }

  const directoryUrls = [
    'https://t.me/s/SportybetOfficialChannel',
    'https://tgstat.com/en/search?q=sportybet',
    'https://tgstat.com/en/search?q=betway',
    'https://telemetr.io/en/channels?q=sportybet',
    'https://telemetr.io/en/channels?q=betway',
    'https://tlgrm.eu/channels?q=sportybet',
    'https://tlgrm.eu/channels?q=betway',
  ];
  for (const url of directoryUrls) {
    try {
      const html = url.startsWith('https://t.me/s/')
        ? await fetchPreview(url.split('/').at(-1))
        : await (await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(8000),
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
  } catch (error) {
    console.warn(`Headless browser unavailable; continuing with HTTP discovery: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (browser) {
    try {
      for (const channel of await searchWeb(browser)) {
        if (!queued.has(channel) && queue.length < 250) {
          queued.add(channel);
          queue.push({ channel, depth: 0 });
        }
      }
    } catch (error) {
      console.warn(`Search discovery settled with partial results: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }
  }

  let index = 0;
  while (index < queue.length
    && index < MAX_VALIDATION_QUEUE
    && [...verified.values()].filter((record) => record.codesFound > 0).length < MAX_CHANNELS) {
    const batch = queue.slice(index, index + 12);
    index += batch.length;
    const settled = await Promise.allSettled(batch.map((item) => fetchPreview(item.channel)));
    for (let offset = 0; offset < settled.length; offset += 1) {
      const item = batch[offset];
      const result = settled[offset];
      if (result.status !== 'fulfilled' || !result.value) continue;
      const html = result.value;
      const codes = extractBookingCodes(html);
      const keywordMatch = previewHasBettingKeywords(html);
      if ((codes.length && (keywordMatch || /sportybet|betway|ghana|booking/i.test(stripHtml(html)))) || keywordMatch) {
        const text = stripHtml(html).toUpperCase();
        const hasSportybet = [...text.matchAll(/\b[A-Z0-9]{6}\b/g)].some((match) => /[0-9]/.test(match[0]));
        const hasBetway = [...text.matchAll(/\bBW[A-Z0-9]{6}\b/g)].some((match) => /[0-9]/.test(match[0].slice(2)));
        verified.set(item.channel, {
          slug: item.channel,
          bookmaker: hasSportybet && hasBetway ? 'both' : hasBetway ? 'betway' : 'sportybet',
          lastChecked: new Date().toISOString(),
          codesFound: codes.length,
        });
      } else {
        verified.delete(item.channel);
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
