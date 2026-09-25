/**
 * Smoke: mobile/pc preview routes mount without React #310 (editor testid).
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

await browser.close()
process.exit(failed ? 1 : 0)
