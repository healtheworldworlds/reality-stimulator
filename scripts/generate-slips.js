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
        // Open the betslip via the floating icon unless it is already open
        const bookBtn = page.locator('.m-book-btn');
        if (!(await bookBtn.isVisible().catch(() => false))) {
          await page.locator('.betslip-theme-icon').first().click();
        }
        await bookBtn.waitFor({ timeout: 10000 });
        await bookBtn.click();

        // The confirmation dialog shows "Booking Code <CODE>"
        let cleanCode = '';
        const codeBody = page.locator('.m-booking-code-body');
        await codeBody.waitFor({ timeout: 15000 }).catch(() => undefined);
        const bodyText = await codeBody.innerText().catch(() => '');
        const match = bodyText.match(/Booking Code\s*([A-Z0-9]{6,7})\b/);
        if (match) cleanCode = match[1];

        if (cleanCode) {
          const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Market: ${MARKET} | Legs: ${LEGS}\n`;
          console.log(`>>> BOOKED: ${entry.trim()}`);
          fs.appendFileSync(OUT_FILE, entry);
        } else {
          console.log(`[Slip ${s}/${SLIPS}] Clicked Book Bet, waiting for code modal...`);
        }

        // Clicking the dialog mask closes it (Escape does not); then remove-all + OK empties the slip
        if (await codeBody.isVisible().catch(() => false)) {
          await page.mouse.click(195, 20);
          await codeBody.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
        }
        const removeAll = page.locator('.remove-all').first();
        if (!(await removeAll.isVisible().catch(() => false))) {
          await page.locator('.betslip-theme-icon').first().click();
        }
        await removeAll.click();
        await page.getByText(/^(ok|yes|confirm)$/i).first().click({ timeout: 5000 });
        await page.waitForTimeout(400);
      }
    }
  } catch (err) {
    console.error(`Execution error: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
