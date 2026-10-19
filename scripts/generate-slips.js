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
    await page.goto('https://www.sportybet.com/gh/m/sport/football', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    const ouTab = page.locator('.m-market-tab, span, div').filter({ hasText: /^O\/U$/i }).first();
    if (await ouTab.isVisible({ timeout: 6000 }).catch(() => false)) {
      await ouTab.click();
      await page.waitForTimeout(2500);
    }

    for (let s = 1; s <= SLIPS; s++) {
      let picked = 0;
      let scrollAttempts = 0;

      while (picked < LEGS && scrollAttempts < 30) {
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
        // Open betslip only if book button is not yet visible
        const existingBook = page.locator('.m-book-btn, button:has-text("Book Bet")').first();
        if (!(await existingBook.isVisible({ timeout: 1500 }).catch(() => false))) {
          const icon = page.locator('.betslip-theme-icon, #m-betslip, [data-op="betslip"]').first();
          await icon.click({ force: true });
          await page.waitForTimeout(3000);
        }

        // Click Book Bet directly
        const bookBtn = page.locator('.m-book-btn, [data-op="book-bet"], button:has-text("Book Bet"), button:has-text("Book")').first();
        await bookBtn.scrollIntoViewIfNeeded().catch(() => {});
        await bookBtn.click({ force: true });
        await page.waitForTimeout(4000);

        // Read booking code
        let bookingCode = '';
        const codeElement = page.locator('.m-booking-code-body, .m-booking-code, .m-dialog-booking, .share-code').first();
        if (await codeElement.isVisible({ timeout: 8000 }).catch(() => false)) {
          const text = await codeElement.innerText().catch(() => '');
          const match = text.match(/([A-Z0-9]{6,7})/);
          if (match) bookingCode = match[1];
        }

        if (!bookingCode) {
          const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
          const match = bodyText.match(/Booking Code\s*[:\-]?\s*([A-Z0-9]{6,7})/i) || bodyText.match(/Code\s*[:\-]?\s*([A-Z0-9]{6,7})/i);
          if (match) bookingCode = match[1];
        }

        const cleanCode = bookingCode || 'GENERATED';
        const entry = `[Slip ${s}/${SLIPS}] Code: ${cleanCode} | Market: ${MARKET} | Legs: ${LEGS}\n`;
        console.log(`>>> BOOKED: ${entry.trim()}`);
        fs.appendFileSync(OUT_FILE, entry);

        // Close modal and clear
        await page.mouse.click(195, 20).catch(() => {});
        await page.waitForTimeout(1000);

        const removeAll = page.locator('.remove-all, button:has-text("Remove All"), button:has-text("Clear")').first();
        if (await removeAll.isVisible({ timeout: 3000 }).catch(() => false)) {
          await removeAll.click({ force: true });
          await page.waitForTimeout(500);
          const okBtn = page.locator('button:has-text("OK")').first();
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
