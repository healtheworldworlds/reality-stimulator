import { appendFileSync } from 'node:fs'
import { chromium, devices } from 'playwright'

const MARKETS = {
  '2H_HIGHEST': { group: 'Highest Scoring Half', pick: '2nd Half' },
  OVER_1_5: { group: 'Over/Under', pick: 'Over 1.5' },
  OVER_2_5: { group: 'Over/Under', pick: 'Over 2.5' },
}
const URL = 'https://www.sportybet.com/gh/m/sport/football/today'
const OUTPUT_FILE = 'generated_codes.txt'
const CARD_SELECTOR = '[class*="match-row"], [class*="match-card"], [class*="event-row"]'

function parseArgs(argv) {
  const options = { market: '2H_HIGHEST', legs: 14, slips: 100, headed: false }
  for (let i = 0; i < argv.length; i += 1) {
    const [rawKey, inline] = argv[i].replace(/^--/, '').split('=')
    const value = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : undefined)
    if (rawKey === 'headed') options.headed = true
    else if (rawKey === 'market' && value) options.market = value.toUpperCase()
    else if (rawKey === 'legs' && value) options.legs = Number(value)
    else if (rawKey === 'slips' && value) options.slips = Number(value)
  }
  if (!MARKETS[options.market]) throw new Error(`--market must be one of: ${Object.keys(MARKETS).join(', ')}`)
  for (const key of ['legs', 'slips']) {
    if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`--${key} must be a positive integer`)
  }
  return options
}

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Distinct random combinations; stops early if the pool cannot supply that many.
function uniqueCombinations(pool, legs, count) {
  const seen = new Set()
  const result = []
  let attempts = 0
  while (result.length < count && attempts < count * 50) {
    attempts += 1
    const combo = shuffle(pool).slice(0, legs).sort((a, b) => a - b)
    const key = combo.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(combo)
  }
  return result
}

async function clearBetslip(page) {
  const clear = page.getByText(/remove all|clear all|clear/i).first()
  if (await clear.isVisible().catch(() => false)) {
    await clear.click()
    const confirm = page.getByRole('button', { name: /^(ok|yes|confirm)$/i }).first()
    if (await confirm.isVisible().catch(() => false)) await confirm.click()
  }
}

// Expands a match card's market group and clicks the wanted outcome.
async function selectPick(card, market) {
  const group = card.getByText(market.group, { exact: true }).first()
  if (await group.isVisible().catch(() => false)) await group.click({ timeout: 2000 }).catch(() => undefined)
  const pick = card.getByText(market.pick, { exact: true }).first()
  if (!(await pick.isVisible().catch(() => false))) return false
  await pick.click({ timeout: 3000 })
  return true
}

async function loadAllCards(page) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  for (let i = 0; i < 15; i += 1) {
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(400)
  }
  return page.locator(CARD_SELECTOR).count()
}

async function bookSlip(page) {
  await page.getByText(/betslip/i).first().click()
  await page.getByRole('button', { name: /book bet|share code/i }).first().click()
  const codeLocator = page.getByText(/\b[A-Z0-9]{6,7}\b/).first()
  await codeLocator.waitFor({ timeout: 10_000 })
  const match = (await codeLocator.innerText()).match(/\b[A-Z0-9]{6,7}\b/)
  if (!match) throw new Error('Booking code not found on page')
  return match[0]
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const market = MARKETS[options.market]
  const browser = await chromium.launch({ headless: !options.headed })
  const context = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await context.newPage()

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const cardCount = await loadAllCards(page)
    if (cardCount === 0) throw new Error('No match cards found. The site layout may have changed or access was blocked; try --headed.')

    const cards = page.locator(CARD_SELECTOR)
    const available = []
    for (let i = 0; i < cardCount; i += 1) {
      const text = await cards.nth(i).innerText().catch(() => '')
      if (text.includes(market.pick) || text.includes(market.group)) available.push(i)
    }
    if (available.length < options.legs) {
      throw new Error(`Only ${available.length} matches offer "${market.pick}", fewer than --legs=${options.legs}.`)
    }

    const combos = uniqueCombinations(available, options.legs, options.slips)
    console.log(`Generating ${combos.length} slip(s) of ${options.legs} legs for ${options.market}`)

    for (let n = 0; n < combos.length; n += 1) {
      try {
        let picked = 0
        for (const index of combos[n]) {
          if (await selectPick(page.locator(CARD_SELECTOR).nth(index), market)) picked += 1
        }
        if (picked < options.legs) throw new Error(`Only ${picked}/${options.legs} selections could be added`)
        const code = await bookSlip(page)
        appendFileSync(OUTPUT_FILE, `[Slip ${n + 1}/${combos.length}] Code: ${code} | Market: ${options.market} | Legs: ${options.legs}\n`)
        console.log(`[Slip ${n + 1}/${combos.length}] ${code}`)
      } catch (error) {
        console.error(`[Slip ${n + 1}/${combos.length}] failed: ${error.message}`)
      } finally {
        await clearBetslip(page)
        await page.goto(URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined)
        await loadAllCards(page)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
