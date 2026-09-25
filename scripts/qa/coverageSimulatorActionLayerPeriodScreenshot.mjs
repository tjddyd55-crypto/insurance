/**
 * Action sheet layer + period section grouping QA.
 * Usage: node scripts/qa/coverageSimulatorActionLayerPeriodScreenshot.mjs [baseUrl]
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()

for (const width of [390, 360]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } })
  await page.goto(`${BASE}/coverage-simulator-preview/mobile`, { waitUntil: 'domcontentloaded' })
  const cancer = page.getByRole('button', { name: /암 치료/ }).first()
  if (await cancer.count()) await cancer.click()
  await page.waitForURL(/scenarios\//, { timeout: 30000 })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
  await page.waitForSelector('.cs-period-section', { timeout: 10000 })

  await page.screenshot({
    path: join(outDir, `mobile-period-visual-hierarchy-${width}.png`),
    fullPage: false,
  })

  const menuTriggers = page.locator('.cs-axis-row-menu__trigger')
  if (await menuTriggers.count()) {
    const mid = menuTriggers.nth(Math.min(2, (await menuTriggers.count()) - 1))
    await mid.scrollIntoViewIfNeeded()
    await mid.click()
    await page.waitForSelector('.coverage-simulator-sheet-backdrop--item-action', { timeout: 5000 })
    await page.screenshot({
      path: join(outDir, `mobile-item-action-sheet-${width}.png`),
      fullPage: false,
    })
  }
  await page.close()
}

await browser.close()
console.log('screenshots written to', outDir)
