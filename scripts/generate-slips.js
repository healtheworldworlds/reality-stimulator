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
const HEADED = args.includes('--headed');
const LINE = MARKET === 'OVER_2_5' ? '2.5' : '1.5';

if (!['OVER_1_5', 'OVER_2_5'].includes(MARKET)) {
  console.error(`Unsupported market "${MARKET}". Use OVER_1_5 or OVER_2_5.`);
  process.exit(1);
}

(async () => {
  console.log(`Starting generator: Market=${MARKET}, Legs=${LEGS}, Slips=${SLIPS}`);
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'en-GH',
    timezoneId: 'Africa/Accra'
  });
  const page = await context.newPage();

  try {
    await page.goto('https://www.sportybet.com/gh/m/sport/football/today', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('.m-event-sport').first().waitFor({ timeout: 30000 });
    await page.getByText('O/U', { exact: true }).first().click();
    await page.waitForTimeout(2000);

    for (let s = 1; s <= SLIPS; s++) {
      let picked = 0;
      let scrollAttempts = 0;
      const tried = new Set();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // The list is virtualized: re-query visible cards after every scroll step
      while (picked < LEGS && scrollAttempts < 120) {
        const keys = await page.locator('[data-key]:has(.m-event-sport)')
          .evaluateAll(els => els.map(e => e.getAttribute('data-key')));
        let progressed = false;

        for (const key of keys) {
          if (picked >= LEGS) break;
          if (!key || tried.has(key)) continue;
          tried.add(key);
          const card = page.locator(`[data-key="${key}"]`).first();
          try {
            await card.scrollIntoViewIfNeeded({ timeout: 2000 });
            // Pick the line (1.5 / 2.5) from the card's dropdown
            await card.locator('.grid-specifier-select').first().click({ timeout: 2000 });
            const lineItem = page.locator('.specifier-grid-item:visible')
              .filter({ has: page.locator('.specifier', { hasText: new RegExp(`^\\s*${LINE}\\s*$`) }) })
              .first();
            await lineItem.click({ timeout: 4000 });
            await page.waitForTimeout(250);

            // First odds box is the Over outcome
            const over = card.locator('[data-op="label-odds"]').first();
            await over.click({ timeout: 2000 });
            await page.waitForTimeout(250);
            const checked = await over.evaluate(el => el.classList.contains('m-outcome--checked')).catch(() => false);
            if (checked) {
              picked++;
              progressed = true;
            }
          } catch (_) {
            // Close any dangling dropdown and skip this fixture
            await page.mouse.click(195, 20).catch(() => undefined);
          }
        }

        if (picked < LEGS) {
          await page.mouse.move(195, 400);
          await page.mouse.wheel(0, 300);
          await page.waitForTimeout(350);
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
