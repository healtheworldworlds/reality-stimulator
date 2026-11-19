const API_BASE_URL = 'https://convertbetcodes.com/api';
const TARGET_BOOKIE = 'sportybet:gh';

let supportedBookiesPromise;
let supportedMarketsPromise;
let supportedBookiesCache;
let supportedMarketsCache;

function apiKey() {
  const key = process.env.CONVERTBETCODES_API_KEY?.trim();
  if (!key) throw new Error('CONVERTBETCODES_API_KEY is required to generate booking codes.');
  return key;
}

function requestUrl(path) {
  const url = new URL(`${API_BASE_URL}/${path}`);
  url.searchParams.set('api_key', apiKey());
  return url;
}

async function requestJson(path, options = {}) {
  const response = await fetch(requestUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
      'x-api-key': apiKey(),
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`ConvertBetCodes ${path} failed: ${detail}`);
  }
  return payload;
}

function items(payload) {
  const found = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      found.push(value);
      Object.values(value).forEach(visit);
    } else if (typeof value === 'string') {
      found.push(value);
    }
  };
  visit(payload);
  return found;
}

function itemKeys(item) {
  if (typeof item === 'string') return [item];
  if (!item || typeof item !== 'object') return [];
  return ['key', 'code', 'id', 'name', 'market', 'bookie', 'value']
    .map((key) => item[key])
    .filter((value) => typeof value === 'string');
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function supportedBookies() {
  if (!supportedBookiesPromise) {
    supportedBookiesPromise = requestJson('supported_bookies')
      .then((payload) => { supportedBookiesCache = payload; return payload; })
      .catch((error) => {
        supportedBookiesPromise = undefined;
        if (supportedBookiesCache) return supportedBookiesCache;
        throw error;
      });
  }
  return supportedBookiesPromise;
}

async function supportedMarkets() {
  if (!supportedMarketsPromise) {
    supportedMarketsPromise = requestJson('supported_markets')
      .then((payload) => { supportedMarketsCache = payload; return payload; })
      .catch((error) => {
        supportedMarketsPromise = undefined;
        if (supportedMarketsCache) return supportedMarketsCache;
        throw error;
      });
  }
  return supportedMarketsPromise;
}

function findSupported(itemsPayload, candidates, description) {
  const wanted = candidates.map(normalize);
  for (const item of items(itemsPayload)) {
    const keys = itemKeys(item);
    const match = keys.find((key) => wanted.includes(normalize(key)));
    if (match) return typeof item === 'string' ? match : item.key || item.code || item.id || match;
  }
  throw new Error(`ConvertBetCodes does not support ${description}.`);
}

export async function resolveMarketKeys(markets) {
  const marketPayload = await supportedMarkets();
  const resolved = {};
  for (const [market, candidates] of Object.entries(markets)) {
    resolved[market] = findSupported(marketPayload, candidates, market);
  }
  return resolved;
}

export async function resolvePickKey(pick, candidates) {
  const marketPayload = await supportedMarkets();
  return findSupported(marketPayload, candidates, `${pick} pick`);
}

export async function assertTargetBookieSupported() {
  const payload = await supportedBookies();
  findSupported(payload, [TARGET_BOOKIE, 'sportybet gh', 'sportybetghana'], TARGET_BOOKIE);
}

export async function generateBetCode(legs) {
  const payload = await requestJson('generate_bet_code', {
    method: 'POST',
    body: JSON.stringify({
      bookie: TARGET_BOOKIE,
      target_bookie: TARGET_BOOKIE,
      selections: legs,
    }),
  });
  const code = payload?.booking_code || payload?.bookingCode || payload?.bet_code || payload?.code ||
    payload?.data?.booking_code || payload?.data?.bookingCode || payload?.data?.code;
  if (typeof code !== 'string' || !/^[A-Z0-9]{6,12}$/i.test(code)) {
    throw new Error('ConvertBetCodes returned no valid booking code.');
  }
  return { code: code.toUpperCase(), raw: payload };
}

export { TARGET_BOOKIE };
