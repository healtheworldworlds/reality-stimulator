import { chromium, devices } from 'playwright';
import fs from 'fs';

const args = process.argv.slice(2);
const getArg = (key, fallback) => {
  const match = args.find(a => a.startsWith(`--${key}=`));
  return match ? match.split('=')[1] : fallback;
};

const MARKET = getArg('market', 'OVER_1_5');
const LEGS = parseInt(getArg('legs', '3'), 10);
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
    await page.goto('https://www.sportybet.com/gh/m/sport/football', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    if (MARKET.startsWith('OVER')) {
      const ouTab = page.locator('.m-market-tab, span, div').filter({ hasText: /^O\/U$/i }).first();
      if (await ouTab.isVisible({ timeout: 6000 })) {
        await ouTab.click();
        await page.waitForTimeout(2500);
      }
    }

    for (let s = 1; s <= SLIPS; s++) {
      let picked = 0;
      let scrollAttempts = 0;

      while (picked < LEGS && scrollAttempts < 25) {
        const buttons = await page.locator('.m-outcome, .m-table-cell, .m-odds-btn').all();

        for (const btn of buttons) {
          if (picked >= LEGS) break;
          try {
            if (await btn.isVisible()) {
              const text = await btn.innerText().catch(() => '');
              const isSelected = await btn.evaluate(el => el.classList.contains('m-outcome--selected') || el.classList.contains('active')).catch(() => false);
              if (!isSelected && text && text.trim().length > 0) {
                await btn.click({ timeout: 1500 });
                picked++;
                await page.waitForTimeout(500);
              }
            }
          } catch (_) {}
        }

        if (picked < LEGS) {
          await page.mouse.wheel(0, 1500);
          await page.waitForTimeout(1000);
          scrollAttempts++;
        }
      }

      console.log(`[Slip ${s}/${SLIPS}] Total picks gathered: ${picked}/${LEGS}`);

      if (picked >= LEGS) {
        // Open the betslip drawer using the bottom bar badge
        const betslipBadge = page.locator('.m-bottom-nav .m-icon-betslip, [data-op="betslip"], .m-betslip-badge, .m-bottom-nav-item').first();
        await betslipBadge.click({ force: true });
        await page.waitForTimeout(3000);

        // Click Book Bet / Share Code button
        const bookBtn = page.locator('button, .m-btn, .m-betslip-book, [data-op="book"]').filter({ hasText: /book/i }).first();
        await bookBtn.waitFor({ state: 'visible', timeout: 8000 });
        await bookBtn.click({ force: true });
        await page.waitForTimeout(3500);

        // Extract the SportyBet Ghana booking code
        const codeLocators = [
          '.m-booking-code',
          '.m-code',
          '.share-code',
          '.booking-code',
          '.m-dialog-booking .code',
          '[class*="booking-code"]'
        ];

        let cleanCode = '';
        for (const sel of codeLocators) {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
            const raw = await el.innerText().catch(() => '');
            if (raw && raw.trim().length >= 4) {
              cleanCode = raw.trim().replace(/[^A-Z0-9]/gi, '');
              break;
            }
          }
        }

        if (!cleanCode) {
          // If modal text contains the code in a paragraph or heading
          const dialogText = await page.locator('.m-dialog, .m-modal, [role="dialog"]').innerText().catch(() => '');
          const match = dialogText.match(/[A-Z0-9]{6,7}/);
          if (match) cleanCode = match[0];
        }

        if (cleanCode) {
          const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Market: ${MARKET} | Legs: ${LEGS}\n`;
          console.log(`>>> BOOKED: ${entry.trim()}`);
          fs.appendFileSync(OUT_FILE, entry);
        } else {
          console.log(`[Slip ${s}/${SLIPS}] Clicked Book Bet, waiting for code modal...`);
        }

        // Cleanly clear selections for the next slip
        const removeAll = page.locator('button, span, .m-icon-delete, [data-op="remove-all"]').filter({ hasText: /remove all|clear/i }).first();
        if (await removeAll.isVisible({ timeout: 3000 }).catch(() => false)) {
          await removeAll.click({ force: true });
          await page.waitForTimeout(1000);
        } else {
          // Close drawer if remove-all is not visible
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (err) {
    console.error(`Execution error: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
