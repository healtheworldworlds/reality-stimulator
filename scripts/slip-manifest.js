import crypto from 'node:crypto';
import fs from 'node:fs';

const MAX_LEGS = 100;

export function normalizeLeg(leg) {
  if (!leg || typeof leg !== 'object') return null;
  const eventId = typeof leg.event_id === 'string' ? leg.event_id.trim() : '';
  const market = typeof leg.market === 'string' ? leg.market.trim() : '';
  const pick = typeof leg.pick === 'string' ? leg.pick.trim() : '';
  const odds = typeof leg.odds === 'number' ? leg.odds : Number(leg.odds);
  if (!eventId || !market || !pick || !Number.isFinite(odds) || odds < 1) return null;
  return {
    event_id: eventId.slice(0, 128),
    market: market.slice(0, 64),
    pick: pick.slice(0, 64),
    odds,
  };
}

export function validateLegs(legs) {
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > MAX_LEGS) return null;
  const normalized = legs.map(normalizeLeg);
  if (normalized.some((leg) => leg === null)) return null;
  const uniqueEventIds = new Set(normalized.map((leg) => leg.event_id));
  if (uniqueEventIds.size !== normalized.length) return null;
  return normalized;
}

export function createSlipManifest({ slipNumber, market, legs, code = null, timestamp = new Date().toISOString() }) {
  const normalizedLegs = validateLegs(legs);
  if (!normalizedLegs) throw new Error(`Slip ${slipNumber} contains invalid or duplicate legs.`);
  const identity = JSON.stringify({
    market,
    legs: normalizedLegs,
  });
  return {
    id: crypto.createHash('sha256').update(identity).digest('hex').slice(0, 16),
    slipNumber,
    bookie: 'sportybet:gh',
    country: 'GH',
    market,
    code,
    legs: normalizedLegs,
    combinedOdds: normalizedLegs.reduce((total, leg) => total * leg.odds, 1),
    timestamp,
    expiresAt: new Date(Date.parse(timestamp) + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function appendSlipManifest(fileName, manifest) {
  fs.appendFileSync(fileName, `${JSON.stringify(manifest)}\n`);
}
