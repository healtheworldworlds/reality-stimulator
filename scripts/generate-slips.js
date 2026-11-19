import { chromium, devices } from 'playwright';
import fs from 'fs';
import { assertTargetBookieSupported, generateBetCode, resolveMarketKeys, resolvePickKey, TARGET_BOOKIE } from './convert-bet-codes.js';
import { filterCandidate, marketCandidates, pickCandidates, readCardCandidate } from './slip-filter.js';
import { appendSlipManifest, createSlipManifest } from './slip-manifest.js';

const args = process.argv.slice(2);
const getArg = (key, fallback) => {
  const match = args.find(a => a.startsWith(`--${key}=`));
  return match ? match.split('=')[1] : fallback;
};

const LEGS = parseInt(getArg('legs', '14'), 10);
const SLIPS = parseInt(getArg('slips', '7'), 10);
const DAY = getArg('day', 'Today'); // 'Today' or 'Tomorrow'
const MARKET = getArg('market', 'OVER_1_5');
const OUT_FILE = 'generated_codes.txt';
const MANIFEST_FILE = 'generated_slips.jsonl';
const MAX_SCROLL_ATTEMPTS = 45;
const MARKET_LABELS = {
  OVER_1_5: 'Over 1.5',
  OVER_2_5: 'Over 2.5',
  '2H_HIGHEST': '2nd Half Highest',
  NO_THREE_GOAL_STREAK: 'No team to score more than 3 goals in a row',
  '1X2': '1X2',
  GG_NG: 'GG/NG'
};

if (!Number.isInteger(LEGS) || LEGS < 1 || !Number.isInteger(SLIPS) || SLIPS < 1 || !MARKET_LABELS[MARKET]) {
  throw new Error('Expected positive --legs and --slips values and a supported --market.');
}

(async () => {
  console.log(`Starting Stable Slip Generator: Day=${DAY}, Market=${MARKET}, Legs=${LEGS}, Slips=${SLIPS}...`);
  fs.writeFileSync(OUT_FILE, '');
  fs.writeFileSync(MANIFEST_FILE, '');
  let marketKeys;
  const convertApiKey = process.env.CONVERTBETCODES_API_KEY?.trim();
  if (convertApiKey) {
    try {
      await assertTargetBookieSupported();
      marketKeys = await resolveMarketKeys({ [MARKET]: marketCandidates(MARKET) });
    } catch (error) {
      console.error(`ConvertBetCodes preflight failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }
  } else {
    console.warn('CONVERTBETCODES_API_KEY is not configured; generating structured slips without booking codes.');
    marketKeys = { [MARKET]: MARKET };
  }
  const pickKeys = new Map();
  const resolvePick = async (rawPick) => {
    if (!convertApiKey) return rawPick.trim().slice(0, 64);
    const cacheKey = `${MARKET}:${rawPick}`;
    if (!pickKeys.has(cacheKey)) {
      pickKeys.set(cacheKey, await resolvePickKey(rawPick, pickCandidates(MARKET, rawPick)));
    }
    return pickKeys.get(cacheKey);
  };
  const filterReasons = new Map();
  const recordFilter = (reason) => filterReasons.set(reason, (filterReasons.get(reason) ?? 0) + 1);
  const publishCode = async (code, legs, slipNumber) => {
    const endpoint = process.env.LIVE_CODES_ENDPOINT?.trim();
    if (!endpoint) {
      console.warn('LIVE_CODES_ENDPOINT is not configured; generated code will remain in the artifact only.');
      return;
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-admin-key': process.env.LIVE_CODES_ADMIN_KEY ?? '',
      },
      body: JSON.stringify({
        code,
        bookie: 'sportybet',
        countryCode: 'GHANA',
        channel: 'reality-simulator',
        source: 'generated',
        time: new Date().toISOString(),
        legs,
        slipNumber,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? `Live code persistence failed (HTTP ${response.status}).`);
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: process.env.HEADFUL !== '1', slowMo: process.env.CI ? 0 : 70 });
  } catch (error) {
    console.error(`Could not launch Playwright: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'en-GH',
    timezoneId: 'Africa/Accra'
  });
  const page = await context.newPage();

  try {
    for (let s = 1; s <= SLIPS; s++) {
      console.log(`\n==========================================`);
      console.log(`Generating Slip ${s}/${SLIPS} (${LEGS} legs)...`);
      console.log(`==========================================`);

      // 1. Fresh page load
      await page.goto('https://www.sportybet.com/gh/m/sport/football', { waitUntil: 'domcontentloaded', timeout: 50000 });
      await page.waitForTimeout(3000);

      // 2. Set Sort to 'Time' (as shown in video at 0:03-0:05)
      try {
        const sortDropdown = page.locator('span, div').filter({ hasText: /^Sort$/i }).first();
        if (await sortDropdown.isVisible({ timeout: 3000 })) {
          await sortDropdown.click({ force: true });
          await page.waitForTimeout(500);
          const timeOption = page.locator('span, div, li').filter({ hasText: /^Time$/i }).first();
          if (await timeOption.isVisible({ timeout: 2000 })) {
            await timeOption.click({ force: true });
            await page.waitForTimeout(1000);
          }
        }
      } catch (_) {}

      // 3. Set Date Filter (Today / Tomorrow as shown in video at 0:08-0:10)
      try {
        const dateDropdown = page.locator('span, div').filter({ hasText: /^(Today|Tomorrow|All)/i }).first();
        if (await dateDropdown.isVisible({ timeout: 3000 })) {
          await dateDropdown.click({ force: true });
          await page.waitForTimeout(600);
          const targetDay = page.locator('span, div, li').filter({ hasText: new RegExp(`^${DAY}`, 'i') }).first();
          if (await targetDay.isVisible({ timeout: 2000 })) {
            await targetDay.click({ force: true });
            await page.waitForTimeout(1500);
          }
        }
      } catch (_) {}

      // 4. Switch to the requested market tab
      if (MARKET !== '1X2') try {
        const marketTab = page.locator('.m-market-tab, span, div').filter({ hasText: new RegExp(
          MARKET === '2H_HIGHEST' ? '2nd Half|2H' : MARKET === 'NO_THREE_GOAL_STREAK' ? 'O\\/U|Over|1\\.5' : 'O\\/U|GG\\/NG',
          'i'
        ) }).first();
        await marketTab.waitFor({ state: 'visible', timeout: 4000 });
        await marketTab.click({ force: true });
        await page.waitForTimeout(1500);
      } catch (error) {
        throw new Error(`Could not select ${MARKET_LABELS[MARKET]} market: ${error.message}`);
      }

      if (MARKET !== '2H_HIGHEST') {
        const targetMarket = MARKET === 'OVER_2_5' ? '2.5'
          : MARKET === 'OVER_1_5' || MARKET === 'NO_THREE_GOAL_STREAK' ? '1.5'
          : 'GG|NG';
        const marketFilter = page.locator('span, div, li').filter({ hasText: new RegExp(`^(${targetMarket})$`, 'i') }).first();
        await marketFilter.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        if (await marketFilter.isVisible().catch(() => false)) {
          await marketFilter.click({ force: true });
          await page.waitForTimeout(1000);
        }
      }

      // 5. Gather unique matches
      const pickedMatchIds = new Set();
      let scrollAttempts = 0;

      const selectedLegs = [];
      while (pickedMatchIds.size < LEGS && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        const cards = await page.locator('[data-key]:has(.m-event-sport)').all();
        const shuffled = cards.sort(() => 0.5 - Math.random());

        for (const card of shuffled) {
          if (pickedMatchIds.size >= LEGS) break;
          try {
            const cardId = await card.getAttribute('data-key');
            if (!cardId || pickedMatchIds.has(cardId)) continue;

            const oddsButtons = await card.locator('[data-op="label-odds"], .m-outcome').all();
            if (oddsButtons.length > 0) {
              const btn = oddsButtons[Math.floor(Math.random() * oddsButtons.length)];
              const oddsText = await btn.innerText().catch(() => '');
              const odds = parseFloat(oddsText.trim());
              const rawPick = (await btn.getAttribute('data-pick').catch(() => null)) ||
                (await btn.getAttribute('data-outcome').catch(() => null)) || oddsText.trim();

              if (!isNaN(odds) && odds >= 1.05) {
                const candidate = await readCardCandidate(card, MARKET, rawPick, odds);
                const filterResult = filterCandidate(candidate, MARKET);
                if (!filterResult.accepted) {
                  recordFilter(filterResult.reason);
                  continue;
                }
                const pickKey = await resolvePick(rawPick);
                await btn.scrollIntoViewIfNeeded().catch(() => {});
                await btn.click({ force: true });
                pickedMatchIds.add(cardId);
                selectedLegs.push({
                  event_id: cardId,
                  home_team: candidate.teams?.[0] ?? '',
                  away_team: candidate.teams?.[1] ?? '',
                  market: marketKeys[MARKET],
                  pick: pickKey,
                  odds,
                });
                console.log(`[Slip ${s}/${SLIPS}] Picked match ${pickedMatchIds.size}/${LEGS} (Odds: ${odds})`);
                await page.waitForTimeout(200);
              }
            }
          } catch (_) {}
        }

        if (pickedMatchIds.size < LEGS) {
          await page.mouse.wheel(0, 1000);
          await page.waitForTimeout(600);
          scrollAttempts++;
        }
      }

      console.log(`[Slip ${s}/${SLIPS}] Total matches gathered: ${pickedMatchIds.size}/${LEGS}`);

      if (pickedMatchIds.size < LEGS) {
        throw new Error(`Could only gather ${pickedMatchIds.size}/${LEGS} matches for slip ${s}.`);
      }

      if (selectedLegs.length !== LEGS) throw new Error(`Slip ${s} has ${selectedLegs.length}/${LEGS} structured legs.`);
      const timestamp = new Date().toISOString();
      let code = null;
      if (convertApiKey) {
        console.log(`Generating ConvertBetCodes slip ${s}/${SLIPS} for ${TARGET_BOOKIE}...`);
        ({ code } = await generateBetCode(selectedLegs));
        await publishCode(code, selectedLegs, s);
      } else {
        console.log(`Skipping booking-code generation for slip ${s}/${SLIPS}: API key unavailable.`);
      }
      const manifest = createSlipManifest({
        slipNumber: s,
        market: MARKET,
        legs: selectedLegs,
        code,
        timestamp,
      });
      appendSlipManifest(MANIFEST_FILE, manifest);
      const entry = code
        ? `[Slip ${s}/${SLIPS}] Code: ${code} | Bookie: ${TARGET_BOOKIE} | Day: ${DAY} | Market: ${MARKET} | Legs: ${LEGS}`
        : `[Slip ${s}/${SLIPS}] Code: NOT GENERATED | Bookie: ${TARGET_BOOKIE} | Day: ${DAY} | Market: ${MARKET} | Legs: ${LEGS}`;
      console.log(`${code ? 'SUCCESS' : 'STRUCTURED SLIP'}: ${entry}`);
      fs.appendFileSync(OUT_FILE, `${entry}\n`);
    }
  } catch (err) {
    console.error(`Script error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    for (const [reason, count] of filterReasons) console.log(`FILTERED ${count} candidates: ${reason}`);
    await browser.close();
    console.log('Batch complete.');
  }
})();
