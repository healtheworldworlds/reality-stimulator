import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import {
  extractTaggedCodes,
  deduplicateDiscoveries,
  isValidSportyBetCode,
  mergeDiscoveryOutput,
  isValidationEnabled,
  validateDiscoveredCodes,
} from './code-discovery.js';
import { discoverTelegramChannels } from './discover-telegram-channels.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEEN_FILE = path.join(ROOT, 'seen_tg_images.json');
const CODES_FILE = path.join(ROOT, 'telegram_ocr_codes.txt');
const GENERATED_FILE = path.join(ROOT, 'generated_codes.txt');
const CONFIG_FILE = path.join(ROOT, 'telegram-channels.json');

const args = process.argv.slice(2);
const getArgValues = (name) => {
  const prefix = `--${name}=`;
  return args
    .filter((arg) => arg.startsWith(prefix))
    .flatMap((arg) => arg.slice(prefix.length).split(/[,\s]+/));
};

const mergeGenerated = args.includes('--merge-generated')
  || (!args.includes('--no-merge-generated')
    && (process.env.TELEGRAM_MERGE_GENERATED?.toLowerCase() === 'true'));

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`Could not read ${path.basename(file)}: ${error.message}`);
    }
    return null;
  }
}

function normalizeChannel(value) {
  if (typeof value !== 'string') return null;
  return value
    .trim()
    .replace(/^https?:\/\/t\.me\/(?:s\/)?/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

function splitChannelEntries(value) {
  return String(value ?? '')
    .split(/[,;\r\n\s]+/)
    .map(normalizeChannel)
    .filter(Boolean);
}

function channelList() {
  const cli = [
    ...getArgValues('channels'),
    ...getArgValues('channel'),
    ...args.filter((arg) => !arg.startsWith('--')),
  ];
  if (cli.length) return unique(cli.map(normalizeChannel).filter(Boolean));

  const env = process.env.TELEGRAM_CHANNELS?.trim();
  if (env) return unique(splitChannelEntries(env));

  const config = readJson(CONFIG_FILE);
  const list = Array.isArray(config) ? config : config?.channels;
  if (Array.isArray(list)) {
    return unique(list.flatMap((entry) => {
      if (typeof entry === 'string') return splitChannelEntries(entry);
      return splitChannelEntries(entry?.slug);
    }));
  }

  return [];
}

function unique(values) {
  return [...new Set(values)];
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function writeLines(file, lines) {
  fs.writeFileSync(file, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

function readSeenState() {
  const parsed = readJson(SEEN_FILE) || {};
  return {
    imageUrls: unique([
      ...(Array.isArray(parsed.imageUrls) ? parsed.imageUrls : []),
      ...(Array.isArray(parsed.images) ? parsed.images : []),
      ...(Array.isArray(parsed.seenImages) ? parsed.seenImages : []),
    ]),
    messageIds: unique([
      ...(Array.isArray(parsed.messageIds) ? parsed.messageIds : []),
      ...(Array.isArray(parsed.messages) ? parsed.messages : []),
    ]),
  };
}

function writeSeenState(state) {
  fs.writeFileSync(SEEN_FILE, `${JSON.stringify({
    imageUrls: unique(state.imageUrls),
    messageIds: unique(state.messageIds),
  }, null, 2)}\n`, 'utf8');
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function stripHtml(value) {
  return decodeHtml(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function extractImageUrls(html) {
  const urls = [];
  const wrapPattern = /<[^>]*class=["'][^"']*\btgme_widget_message_photo_wrap\b[^"']*["'][^>]*>/gi;
  let wrapMatch;
  while ((wrapMatch = wrapPattern.exec(html))) {
    const quoted = /background-image\s*:\s*url\(\s*(['"])(.*?)\1\s*\)/gi;
    const unquoted = /background-image\s*:\s*url\(\s*([^)'"\s]+)\s*\)/gi;
    let match;
    while ((match = quoted.exec(wrapMatch[0]))) urls.push(decodeHtml(match[2]));
    while ((match = unquoted.exec(wrapMatch[0]))) urls.push(decodeHtml(match[1]));
  }
  return unique(urls.filter((url) => /^https?:\/\//i.test(url)));
}

function extractMessageSegments(html) {
  const startPattern = /<[^>]+\bdata-post=["']([^"']+)["'][^>]*>/gi;
  const segments = [];
  let match;
  while ((match = startPattern.exec(html))) {
    segments.push({ messageId: match[1], html: match[0] });
  }

  for (let index = 0; index < segments.length; index += 1) {
    const startMatch = html.indexOf(segments[index].html);
    const nextStart = index + 1 < segments.length
      ? html.indexOf(segments[index + 1].html, startMatch + segments[index].html.length)
      : html.length;
    segments[index].html = html.slice(startMatch, nextStart);
  }
  return segments;
}

function extractCaption(segmentHtml) {
  const match = segmentHtml.match(/<div[^>]*class=["'][^"']*\btgme_widget_message_text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  return match ? stripHtml(match[1]) : '';
}

function extractSpiderCandidates(html) {
  const found = new Set();
  const filtered = new Set(['share', 'joinchat', 'addstickers', 's', 'iv', 'c', 'proxy']);
  const patterns = [
    /https?:\/\/(?:www\.)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,64})/gi,
    /\b@([A-Za-z0-9_]{4,64})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const slug = match[1];
      if (!filtered.has(slug.toLowerCase())) found.add(slug);
    }
  }
  return [...found];
}

function extractCodes(text) {
  return extractTaggedCodes(text);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; local-telegram-ocr/1.0)',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.text();
}

let channels = channelList();
if (!channels.length) channels = await discoverTelegramChannels();
if (!channels.includes('SportybetOfficialChannel')) channels.unshift('SportybetOfficialChannel');
channels = [...new Set(channels)];

{
  const seen = readSeenState();
  const rawTelegramExisting = readLines(CODES_FILE);
  const telegramExisting = [...new Set(rawTelegramExisting
    .map((code) => code.toUpperCase())
    .filter(isValidSportyBetCode))];
  const telegramHistoryNeedsRewrite = telegramExisting.length !== rawTelegramExisting.length ||
    telegramExisting.some((code, index) => code !== rawTelegramExisting[index]);
  const telegramSet = new Set(telegramExisting);
  const newlyFound = [];
  const newlyFoundSet = new Set();
  const seenImageSet = new Set(seen.imageUrls);
  const seenMessageSet = new Set(seen.messageIds);
  const spiderCandidates = new Set(channels);
  let activeChannels = 0;
  let worker;
  let workerCreated = false;

  try {
    for (const channel of channels) {
      const previewUrl = `https://t.me/s/${encodeURIComponent(channel)}`;
      console.log(`Scanning ${previewUrl}`);

      let html;
      try {
        html = await fetchHtml(previewUrl);
      } catch (error) {
        console.error(`Failed to fetch ${channel}: ${error.message}`);
        continue;
      }
      const captionCandidates = extractSpiderCandidates(html);
      for (const candidate of captionCandidates) spiderCandidates.add(candidate);
      activeChannels += 1;

      const segments = extractMessageSegments(html);
      const fallbackImages = extractImageUrls(html);
      const processImage = async (imageUrl) => {
        if (seenImageSet.has(imageUrl)) return;

        if (!workerCreated) {
          worker = await createWorker('eng');
          await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789: ',
          });
          workerCreated = true;
        }

        try {
          const imageResponse = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; local-telegram-ocr/1.0)' },
            signal: AbortSignal.timeout(30000),
          });
          if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);
          const buffer = Buffer.from(await imageResponse.arrayBuffer());
          const processed = await sharp(buffer)
            .rotate()
            .greyscale()
            .normalise()
            .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: false })
            .sharpen()
            .png()
            .toBuffer();
          const result = await worker.recognize(processed);
          for (const record of extractTaggedCodes(result.data.text || '', isValidationEnabled(args))) {
            if (!telegramSet.has(record.code) && !newlyFoundSet.has(record.code)) {
              newlyFound.push(record);
              newlyFoundSet.add(record.code);
            }
            for (const candidate of extractSpiderCandidates(result.data.text || '')) spiderCandidates.add(candidate);
          }
          seenImageSet.add(imageUrl);
          console.log(`OCR scanned ${imageUrl}`);
        } catch (error) {
          console.error(`OCR failed for ${imageUrl}: ${error.message}`);
        }
      };

      for (const segment of segments) {
        if (seenMessageSet.has(segment.messageId)) continue;

        const forwardMatch = segment.html.match(/tgme_widget_message_forwarded_from[\s\S]*?t\.me\/([A-Za-z0-9_]{4,64})/i);
        if (forwardMatch) spiderCandidates.add(forwardMatch[1]);
        for (const candidate of extractSpiderCandidates(segment.html)) spiderCandidates.add(candidate);

        const caption = extractCaption(segment.html);
        for (const record of extractTaggedCodes(caption, isValidationEnabled(args))) {
          if (!telegramSet.has(record.code) && !newlyFoundSet.has(record.code)) {
            newlyFound.push(record);
            newlyFoundSet.add(record.code);
          }
        }

        const imageUrls = extractImageUrls(segment.html);
        for (const imageUrl of imageUrls) {
          await processImage(imageUrl);
        }

        seenMessageSet.add(segment.messageId);
      }

      for (const imageUrl of fallbackImages) {
        await processImage(imageUrl);
      }
    }
  } finally {
    if (worker) await worker.terminate();
  }

  if (newlyFound.length || telegramHistoryNeedsRewrite) {
    const combined = [...new Set([...newlyFound.map((record) => record.code), ...telegramExisting])];
    writeLines(CODES_FILE, combined);
    if (newlyFound.length) {
      console.log(`Added ${newlyFound.length} new code(s) to ${path.basename(CODES_FILE)}.`);
    } else {
      console.log(`Removed invalid or duplicate entries from ${path.basename(CODES_FILE)}.`);
    }
  } else {
    console.log(`No brand-new codes found; ${path.basename(CODES_FILE)} remains deduplicated.`);
  }

  let outputRecords = newlyFound;
  if (isValidationEnabled(args)) outputRecords = await validateDiscoveredCodes(outputRecords);
  await mergeDiscoveryOutput(ROOT, outputRecords);
  if (mergeGenerated || !mergeGenerated) {
    console.log(`Merged codes into ${path.basename(GENERATED_FILE)} and generated_slips.jsonl.`);
  }

  writeSeenState({
    imageUrls: [...seenImageSet],
    messageIds: [...seenMessageSet],
  });
  const now = new Date().toISOString();
  const existingConfig = readJson(CONFIG_FILE);
  const existingRecords = Array.isArray(existingConfig) ? existingConfig : [];
  const bySlug = new Map(existingRecords
    .map((entry) => typeof entry === 'string'
      ? { slug: entry, bookmaker: 'sportybet', lastChecked: null, codesFound: 0 }
      : { ...entry, bookmaker: 'sportybet' })
    .filter((entry) => entry?.slug)
    .map((entry) => [entry.slug, entry]));
  for (const slug of spiderCandidates) {
    const prior = bySlug.get(slug) ?? { slug, lastChecked: null, codesFound: 0 };
    bySlug.set(slug, { ...prior, bookmaker: 'sportybet', lastChecked: now });
  }
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify([...bySlug.values()], null, 2)}\n`, 'utf8');
  console.log(`Scrape summary: ${activeChannels} active channel(s) scraped; ${spiderCandidates.size} candidate channel(s) queued; ${newlyFound.length} new code(s) found.`);
}
