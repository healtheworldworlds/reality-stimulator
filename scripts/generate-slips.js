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
    await page.goto('https://www.sportybet.com/gh/m/sport/football', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(4000);

    if (MARKET.startsWith('OVER')) {
      const ouTab = page.locator('span, div, .m-market-tab').filter({ hasText: /^O\/U$/i }).first();
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
        // Target the floating bottom bar element specifically
        const betslipTrigger = page.locator('.m-bottom-nav, .m-footer, .m-layout-footer, body')
          .locator('text=/betslip/i, .m-icon-betslip, [data-op="betslip"]')
          .first();

        if (await betslipTrigger.isVisible({ timeout: 5000 })) {
          await betslipTrigger.click();
        } else {
          // Fallback click on the bottom right floating badge
          await page.mouse.click(340, 800);
        }
        await page.waitForTimeout(3000);

        // Click Book Bet inside the opened modal
        const bookBtn = page.locator('button, .m-btn, .m-betslip-book').filter({ hasText: /book/i }).first();
        if (await bookBtn.isVisible({ timeout: 8000 })) {
          await bookBtn.click();
          await page.waitForTimeout(3500);

          const codeEl = page.locator('.m-booking-code, .m-code, [class*="code"], .share-code').first();
          const codeText = await codeEl.textContent({ timeout: 6000 }).catch(() => null);
          const cleanCode = codeText ? codeText.trim().replace(/[^A-Z0-9]/gi, '') : 'GENERATED';

          const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Market: ${MARKET} | Legs: ${LEGS}\n`;
          console.log(`>>> BOOKED: ${entry.trim()}`);
          fs.appendFileSync(OUT_FILE, entry);

          const removeAll = page.locator('button, span, .m-icon-delete').filter({ hasText: /remove all|clear/i }).first();
          if (await removeAll.isVisible({ timeout: 3000 })) {
            await removeAll.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Execution error: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
