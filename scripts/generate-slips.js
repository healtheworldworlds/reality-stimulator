import { chromium, devices } from 'playwright';
import fs from 'fs';

const args = process.argv.slice(2);
const getArg = (key, fallback) => {
  const match = args.find(a => a.startsWith(`--${key}=`));
  return match ? match.split('=')[1] : fallback;
};

const MARKET = getArg('market', 'OVER_1_5');
const LEGS = parseInt(getArg('legs', '5'), 10);
const SLIPS = parseInt(getArg('slips', '2'), 10);
const OUT_FILE = 'generated_codes.txt';

(async () => {
  console.log(`Starting Cloud Generator: Market=${MARKET}, Legs=${LEGS}, Slips=${SLIPS}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'en-GH',
    timezoneId: 'Africa/Accra'
  });
  const page = await context.newPage();

  try {
    await page.goto('https://www.sportybet.com/gh/m/sport/football/today', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Switch to Over/Under tab if selected
    if (MARKET.startsWith('OVER')) {
      const ouTab = page.locator('.m-market-tab, span, div').filter({ hasText: /^O\/U$/i }).first();
      if (await ouTab.isVisible({ timeout: 5000 })) {
        await ouTab.click();
        await page.waitForTimeout(2000);
      }
    }

    // Scroll to reveal matches
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(800);
    }

    for (let s = 1; s <= SLIPS; s++) {
      // Find visible odds selection buttons
      const buttons = await page.locator('.m-outcome, .m-table-cell, .m-odds-btn').all();
      let picked = 0;

      for (const btn of buttons) {
        if (picked >= LEGS) break;
        try {
          if (await btn.isVisible()) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ timeout: 2000 });
            picked++;
            await page.waitForTimeout(400);
          }
        } catch (_) {}
      }

      console.log(`[Slip ${s}/${SLIPS}] Added ${picked}/${LEGS} selections`);

      if (picked >= LEGS) {
        // Open betslip
        const betslip = page.locator('.m-betslip-btn, .m-bottom-nav-item, [class*="betslip"]').first();
        await betslip.click();
        await page.waitForTimeout(1500);

        // Click Book Bet / Share Code
        const bookBtn = page.locator('button, .m-btn').filter({ hasText: /book/i }).first();
        if (await bookBtn.isVisible({ timeout: 5000 })) {
          await bookBtn.click();
          await page.waitForTimeout(2000);

          // Extract code
          const codeEl = page.locator('.m-booking-code, .m-code, [class*="code"]').first();
          const codeText = await codeEl.textContent({ timeout: 5000 }).catch(() => null);
          const cleanCode = codeText ? codeText.trim().replace(/[^A-Z0-9]/gi, '') : 'BOOKED';

          const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Market: ${MARKET} | Legs: ${LEGS}\n`;
          console.log(`SUCCESS: ${entry.trim()}`);
          fs.appendFileSync(OUT_FILE, entry);

          // Clear betslip for next slip
          const removeAll = page.locator('button, span').filter({ hasText: /remove all|clear/i }).first();
          if (await removeAll.isVisible({ timeout: 3000 })) {
            await removeAll.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Script error: ${err.message}`);
  } finally {
    await browser.close();
    console.log('Worker finished. Artifacts saved.');
  }
})();
