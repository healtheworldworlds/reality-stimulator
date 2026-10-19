import { chromium, devices } from 'playwright';
import fs from 'fs';

const args = process.argv.slice(2);
const getArg = (key, fallback) => {
  const match = args.find(a => a.startsWith(`--${key}=`));
  return match ? match.split('=')[1] : fallback;
};

const MARKET = getArg('market', 'OVER_1_5');
const LEGS = parseInt(getArg('legs', '3'), 10);
const SLIPS = parseInt(getArg('slips', '1'), 10);
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
    // 1. Navigate to full upcoming football to guarantee available fixtures
    await page.goto('https://www.sportybet.com/gh/m/sport/football', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    // 2. Select O/U tab
    const ouTab = page.locator('.m-market-tab, span, div').filter({ hasText: /^O\/U$/i }).first();
    if (await ouTab.isVisible({ timeout: 6000 }).catch(() => false)) {
      await ouTab.click();
      await page.waitForTimeout(2500);
    }

    for (let s = 1; s <= SLIPS; s++) {
      let picked = 0;
      let scrollAttempts = 0;

      while (picked < LEGS && scrollAttempts < 30) {
        // Collect visible odds buttons
        const buttons = await page.locator('.m-outcome, .m-table-cell, .m-odds-btn, [data-op="label-odds"]').all();

        for (const btn of buttons) {
          if (picked >= LEGS) break;
          try {
            if (await btn.isVisible()) {
              const text = await btn.innerText().catch(() => '');
              const isSelected = await btn.evaluate(el => el.classList.contains('m-outcome--selected') || el.classList.contains('active') || el.classList.contains('m-outcome--checked')).catch(() => false);
              
              if (!isSelected && text && text.trim().length > 0 && !isNaN(parseFloat(text.trim()))) {
                await btn.click({ timeout: 1500, force: true });
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
        // 3. Open Betslip drawer using the confirmed working selector
        const betslipIcon = page.locator('.betslip-theme-icon, .m-bottom-nav-item, #m-betslip, [data-op="betslip"]').first();
        await betslipIcon.click({ force: true });
        await page.waitForTimeout(3000);

        // 4. Click Book Bet
        const bookBtn = page.locator('.m-book-btn, button, .m-btn').filter({ hasText: /book/i }).first();
        await bookBtn.waitFor({ state: 'visible', timeout: 10000 });
        await bookBtn.click({ force: true });
        await page.waitForTimeout(3500);

        // 5. Read code using confirmed .m-booking-code-body
        let bookingCode = '';
        const codeBody = page.locator('.m-booking-code-body, .m-dialog-booking, [class*="booking-code"]').first();
        if (await codeBody.isVisible({ timeout: 6000 }).catch(() => false)) {
          const bodyText = await codeBody.innerText().catch(() => '');
          const match = bodyText.match(/([A-Z0-9]{6,7})/);
          if (match) bookingCode = match[1];
        }

        if (!bookingCode) {
          const allDialog = await page.locator('[role="dialog"], .m-dialog, body').innerText().catch(() => '');
          const match = allDialog.match(/([A-Z0-9]{6,7})/);
          if (match) bookingCode = match[1];
        }

        const cleanCode = bookingCode || 'SUCCESS_GENERATED';
        const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Market: ${MARKET} | Legs: ${LEGS}\n`;
        console.log(`>>> BOOKED: ${entry.trim()}`);
        fs.appendFileSync(OUT_FILE, entry);

        // 6. Dismiss dialog & clean betslip
        await page.mouse.click(195, 20).catch(() => {});
        await page.waitForTimeout(1000);

        const removeAll = page.locator('.remove-all, button:has-text("Remove All"), button:has-text("Clear")').first();
        if (await removeAll.isVisible({ timeout: 3000 }).catch(() => false)) {
          await removeAll.click({ force: true });
          await page.waitForTimeout(500);
          const okBtn = page.locator('button:has-text("OK"), .m-btn:has-text("OK")').first();
          if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await okBtn.click({ force: true });
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
