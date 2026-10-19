import { appendFileSync } from 'node:fs'
import { chromium, devices } from 'playwright'

const MARKETS = {
  '2H_HIGHEST': { type: 'detail', tab: 'Half', group: 'Highest Scoring Half', pick: '2nd half' },
  OVER_1_5: { type: 'list', line: '1.5' },
  OVER_2_5: { type: 'list', line: '2.5' },
}
const URL = 'https://www.sportybet.com/gh/m/sport/football/today'
const OUTPUT_FILE = 'generated_codes.txt'
const CARD = '[data-key]:has(.m-event-sport)'
const SCROLL_STEP = 400

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

// Distinct random combinations of pool keys; stops early if the pool cannot supply that many.
function uniqueCombinations(pool, legs, count) {
  const seen = new Set()
  const result = []
  let attempts = 0
  while (result.length < count && attempts < count * 50) {
    attempts += 1
    const combo = shuffle(pool).slice(0, legs).sort()
    const key = combo.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(combo)
  }
  return result
}

async function wheel(page, delta) {
  await page.mouse.move(195, 400)
  await page.mouse.wheel(0, delta)
}

async function openList(page, market) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('.m-event-sport').first().waitFor({ timeout: 30_000 })
  if (market.type === 'list') {
    await page.getByText('O/U', { exact: true }).first().click()
    await page.waitForTimeout(1500)
  }
}

// One continuous scroll that indexes every match: key, teams, scroll offset and market support.
async function buildPool(page, market) {
  await openList(page, market)
  await wheel(page, -100_000)
  await page.waitForTimeout(400)
  const pool = new Map()
  let idle = 0
  while (idle < 5) {
    const found = await page.locator(CARD).evaluateAll((cards) =>
      cards.map((card) => ({
        key: card.dataset.key,
        y: window.scrollY + card.getBoundingClientRect().top,
        teams: [...card.querySelectorAll('.team')].map((team) => team.textContent.trim()),
        league: card.querySelector('.m-league-name')?.textContent.trim() ?? '',
        hasLine: Boolean(card.querySelector('.grid-specifier-select')),
      })),
    )
    let fresh = false
    for (const item of found) {
      if (!item.key || pool.has(item.key)) continue
      fresh = true
      pool.set(item.key, { ...item, home: item.teams[0] ?? '', away: item.teams[1] ?? '' })
    }
    idle = fresh ? 0 : idle + 1
    await wheel(page, SCROLL_STEP)
    await page.waitForTimeout(250)
  }
  const matches = [...pool.values()].filter((match) => market.type === 'detail' || match.hasLine)
  return new Map(matches.map((match) => [match.key, match]))
}

// Jumps straight to an indexed match instead of re-scrolling the list, and returns its live card.
async function revealCard(page, match) {
  const card = page.locator(`[data-key="${match.key}"]`).first()
  await page.evaluate((top) => window.scrollTo(0, top), Math.max(0, match.y - 150))
  await card.waitFor({ state: 'visible', timeout: 5000 })
  return card
}

// Match detail URLs follow /football/<Country>/<League>/<Home>_vs_<Away>/<sr:match:id>.
function detailUrl(match) {
  const slug = (text) => text.trim().replace(/\s+/g, '_')
  const [country, ...league] = match.league.split(' - ')
  return `${URL.replace('/today', '')}/${slug(country)}/${slug(league.join(' '))}/${slug(match.home)}_vs_${slug(match.away)}/${match.key}`
}

async function pickOver(page, card, line) {
  const label = card.locator('.grid-specifier-select-label')
  if ((await label.innerText()).trim() !== line) {
    await card.locator('.grid-specifier-select').click()
    const wanted = new RegExp(`^\\s*${line.replace('.', '\\.')}\\s*$`)
    const item = page.locator('.specifier-grid-item:visible', { has: page.locator('.specifier', { hasText: wanted }) }).first()
    await item.waitFor({ timeout: 4000 }).catch(() => undefined)
    if (!(await item.count())) return false
    await item.click()
    await page.waitForTimeout(300)
  }
  const over = card.locator('[data-op="label-odds"]').first()
  await over.click()
  await page.waitForTimeout(150)
  return /m-outcome--checked/.test((await over.getAttribute('class')) ?? '')
}

async function fillSlipFromList(page, combo, pool, market) {
  let picked = 0
  for (const key of combo) {
    try {
      const card = await revealCard(page, pool.get(key))
      if (await pickOver(page, card, market.line)) picked += 1
    } catch {
      // Skip a card that cannot be reached; the caller checks the final count.
    }
  }
  return picked
}

// Opens a match's detail view and picks the outcome under the market's tab and group.
// Throws when the fixture does not offer the market so the caller can skip it.
async function pickFromDetail(page, match, market) {
  await page.goto(detailUrl(match), { waitUntil: 'domcontentloaded' })
  await page.getByText(market.tab, { exact: true }).first().click({ timeout: 15_000 })
  const groupText = new RegExp(`^\\s*${market.group}\\s*$`, 'i')
  const pickText = new RegExp(`^\\s*${market.pick}\\s*$`, 'i')
  const header = page.getByText(groupText).first()
  await header.waitFor({ timeout: 10_000 })
  const section = page.locator('div', { has: page.getByText(groupText) }).filter({ has: page.getByText(pickText) }).last()
  const pick = section.getByText(pickText).first()
  if (!(await pick.isVisible().catch(() => false))) await header.click()
  await pick.click({ timeout: 5000 })
  return true
}

// Walks the combination first, then spare matches from the pool, until enough fixtures offered the market.
async function fillSlipFromDetails(page, combo, pool, market, legs) {
  const spares = shuffle([...pool.keys()].filter((key) => !combo.includes(key)))
  let picked = 0
  for (const key of [...combo, ...spares]) {
    if (picked >= legs) break
    try {
      if (await pickFromDetail(page, pool.get(key), market)) picked += 1
    } catch {
      // Fixture does not offer the market or failed to load; move on to the next eligible match.
    }
  }
  return picked
}

async function bookSlip(page) {
  const bookButton = page.locator('.m-book-btn')
  if (!(await bookButton.isVisible().catch(() => false))) {
    await page.locator('.betslip-theme-icon').first().click()
  }
  await bookButton.waitFor({ timeout: 10_000 })
  await bookButton.click()
  const body = page.locator('.m-booking-code-body')
  await body.waitFor({ timeout: 15_000 })
  const match = (await body.innerText()).match(/Booking Code\s*([A-Z0-9]{6,7})\b/)
  if (!match) throw new Error('Booking code not found in the confirmation dialog')
  return match[1]
}

// Clears the betslip without reloading, so the fully loaded match list stays in place.
async function clearBetslip(page) {
  if (await page.locator('.m-booking-code-body').isVisible().catch(() => false)) {
    await page.mouse.click(195, 20)
    await page.locator('.m-booking-code-body').waitFor({ state: 'hidden', timeout: 5000 })
  }
  const removeAll = page.locator('.remove-all').first()
  if (!(await removeAll.isVisible().catch(() => false))) {
    await page.locator('.betslip-theme-icon').first().click()
  }
  if (await removeAll.isVisible().catch(() => false)) {
    await removeAll.click()
    await page.getByText(/^(ok|yes|confirm)$/i).first().click({ timeout: 5000 })
    await page.waitForTimeout(400)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const market = MARKETS[options.market]
  const browser = await chromium.launch({ headless: !options.headed })
  const context = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await context.newPage()

  try {
    const started = Date.now()
    const pool = await buildPool(page, market)
    console.log(`Indexed ${pool.size} eligible matches for ${options.market} in ${Math.round((Date.now() - started) / 1000)}s`)
    if (pool.size < options.legs) throw new Error(`Only ${pool.size} eligible matches, fewer than --legs=${options.legs}.`)

    const combos = uniqueCombinations([...pool.keys()], options.legs, options.slips)
    console.log(`Generating ${combos.length} slip(s) of ${options.legs} legs`)

    for (let n = 0; n < combos.length; n += 1) {
      const label = `[Slip ${n + 1}/${combos.length}]`
      const slipStarted = Date.now()
      try {
        const picked = market.type === 'list'
          ? await fillSlipFromList(page, combos[n], pool, market)
          : await fillSlipFromDetails(page, combos[n], pool, market, options.legs)
        if (picked < options.legs) throw new Error(`only ${picked}/${options.legs} selections could be added`)
        if (market.type === 'detail') await page.goto(URL, { waitUntil: 'domcontentloaded' })
        const code = await bookSlip(page)
        appendFileSync(OUTPUT_FILE, `${label} Code: ${code} | Market: ${options.market} | Legs: ${options.legs}\n`)
        console.log(`${label} ${code} (${Math.round((Date.now() - slipStarted) / 1000)}s)`)
      } catch (error) {
        console.error(`${label} failed: ${error.message.split('\n')[0]}`)
        await page.screenshot({ path: 'slip-error.png' }).catch(() => undefined)
      } finally {
        await clearBetslip(page).catch(() => undefined)
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
