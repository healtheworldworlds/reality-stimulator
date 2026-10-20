import { chromium, devices } from 'playwright';
import fs from 'fs';

const args = process.argv.slice(2);
const getArg = (key, fallback) => {
  const match = args.find(a => a.startsWith(`--${key}=`));
  return match ? match.split('=')[1] : fallback;
};

const LEGS = parseInt(getArg('legs', '14'), 10);
const SLIPS = parseInt(getArg('slips', '7'), 10);
const DAY = getArg('day', 'Today'); // 'Today' or 'Tomorrow'
const OUT_FILE = 'generated_codes.txt';

(async () => {
  console.log(`Starting Stable Slip Generator: Day=${DAY}, Legs=${LEGS}, Slips=${SLIPS}...`);
  const browser = await chromium.launch({ headless: false, slowMo: 70 });
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

      // 4. Switch to O/U market tab
      try {
        const ouTab = page.locator('.m-market-tab, span, div').filter({ hasText: /^O\/U$/i }).first();
        if (await ouTab.isVisible({ timeout: 4000 })) {
          await ouTab.click({ force: true });
          await page.waitForTimeout(1500);
        }
      } catch (_) {}

      // 5. Gather unique matches
      const pickedMatchIds = new Set();
      let scrollAttempts = 0;

      while (pickedMatchIds.size < LEGS && scrollAttempts < 45) {
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

              if (!isNaN(odds) && odds >= 1.05) {
                await btn.scrollIntoViewIfNeeded().catch(() => {});
                await btn.click({ force: true }).catch(() => {});
                pickedMatchIds.add(cardId);
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

      if (pickedMatchIds.size >= LEGS) {
        // Dismiss tooltips
        await page.evaluate(() => {
          document.querySelectorAll('.m-popover, .m-tooltip, [class*="early-goals"]').forEach(el => el.remove());
        }).catch(() => {});
        await page.waitForTimeout(300);

        // Open betslip
        await page.mouse.click(335, 710);
        await page.waitForTimeout(2000);

        // Click Book Bet
        console.log(`Booking Slip ${s}/${SLIPS}...`);
        await page.evaluate(() => {
          const btn = document.querySelector('.m-book-btn') || 
                      document.querySelector('[data-op="book-bet"]') ||
                      Array.from(document.querySelectorAll('div, button, span')).find(el => el.textContent && el.textContent.trim().toLowerCase() === 'book bet');
          if (btn) btn.click();
        });
        await page.waitForTimeout(3500);

        // Read Code
        let code = '';
        const codeElement = page.locator('.m-booking-code-body, .m-booking-code, .share-code').first();
        if (await codeElement.isVisible({ timeout: 5000 }).catch(() => false)) {
          const raw = await codeElement.innerText().catch(() => '');
          const match = raw.match(/([A-Z0-9]{6,7})/);
          if (match) code = match[1];
        }

        if (!code) {
          const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
          const match = bodyText.match(/Booking Code\s*[:\-]?\s*([A-Z0-9]{6,7})/i) || bodyText.match(/Code\s*[:\-]?\s*([A-Z0-9]{6,7})/i);
          if (match) code = match[1];
        }

        const cleanCode = code || 'BOOKED';
        const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Day: ${DAY} | Legs: ${LEGS}`;
        console.log(`\n==========================================`);
        console.log(`SUCCESS: ${entry}`);
        console.log(`==========================================\n`);
        fs.appendFileSync(OUT_FILE, entry + '\n');

        await page.waitForTimeout(1500);
      }
    }
  } catch (err) {
    console.error(`Script error: ${err.message}`);
  } finally {
    await browser.close();
    console.log('Batch complete.');
  }
})();
