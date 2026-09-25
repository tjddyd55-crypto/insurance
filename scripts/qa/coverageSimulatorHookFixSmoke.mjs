/**
 * Smoke: mobile/pc preview routes mount without React #310; Add/Edit exclusive form cycles.
 */
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const routes = [
  '/coverage-simulator-preview/mobile',
  '/coverage-simulator-preview/mobile/cancer',
  '/coverage-simulator-preview/mobile/cancer/new',
  '/coverage-simulator-preview/pc',
  '/coverage-simulator-preview/pc/cancer/new',
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await context.newPage()

function assertNoCrash(route) {
  return page.evaluate(() => {
    const err = document.body?.innerText?.includes('Unexpected Application Error')
    const hook310 = document.body?.innerText?.includes('#310')
    return { err, hook310 }
  }).then(({ err, hook310 }) => {
    const ok = !err && !hook310
    console.log(ok ? '[PASS]' : '[FAIL]', route, { err, hook310 })
    return ok
  })
}

let failed = false
for (const route of routes) {
  const url = `${BASE}${route}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const err = await page.locator('text=Unexpected Application Error').count()
  const hook310 = await page.locator('text=#310').count()
  const editor = await page.locator('[data-testid="coverage-scenario-editor"]').count()
  const list = await page.locator('.cs-simulation-list').count()
  const ok = err === 0 && hook310 === 0 && (editor > 0 || list > 0 || route.endsWith('/mobile') || route.endsWith('/pc'))
  console.log(ok ? '[PASS]' : '[FAIL]', route, { err, hook310, editor, list })
  if (!ok) failed = true
}

const editorUrl = `${BASE}/coverage-simulator-preview/mobile/cancer/new`
await page.goto(editorUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })

await page.locator('.cs-axis-insert__btn').first().click()
await page.waitForSelector('[data-testid="coverage-simulator-form-screen"]', { timeout: 8000 })
if (!(await assertNoCrash('add-open'))) failed = true
const addDom = await page.evaluate(() => ({
  timeline: document.querySelector('.cs-axis-timeline'),
  form: document.querySelector('[data-testid="coverage-simulator-form-screen"]'),
}))
if (addDom.form && !addDom.timeline) console.log('[PASS]', 'add-exclusive-dom')
else {
  console.log('[FAIL]', 'add-exclusive-dom', addDom)
  failed = true
}
await page.locator('.cs-form-screen__back').click()
await page.waitForSelector('.cs-axis-timeline', { timeout: 8000 })
if (!(await assertNoCrash('add-close'))) failed = true

await page.locator('.cs-axis-row-menu__trigger').first().click()
await page.waitForSelector('[data-testid="coverage-simulator-form-screen"]', { timeout: 8000 })
if (!(await assertNoCrash('edit-open'))) failed = true
await page.locator('.cs-form-screen__back').click()
await page.waitForSelector('.cs-axis-timeline', { timeout: 8000 })
if (!(await assertNoCrash('edit-close'))) failed = true

await browser.close()
process.exit(failed ? 1 : 0)
