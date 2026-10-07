import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

const results = []

for (const path of ['/coverage-simulator-preview/pc', '/coverage-simulator-preview/mobile']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const url = page.url()
  const loginFail = url.includes('/login')
  const root =
    path.includes('/pc')
      ? await page.locator('[data-testid="coverage-simulator-public-pc-root"]').count()
      : await page.locator('[data-testid="coverage-simulator-public-mobile-root"]').count()
  const body = await page.locator('body').innerText()
  const hasHome = body.includes('보장 시뮬레이션') && body.includes('암 치료')
  results.push({ path, url, loginFail, rendered: root > 0, hasHome })
}

await browser.close()
console.log(JSON.stringify({ base: BASE, results }, null, 2))
process.exit(results.some((r) => r.loginFail || !r.rendered || !r.hasHome) ? 1 : 0)
