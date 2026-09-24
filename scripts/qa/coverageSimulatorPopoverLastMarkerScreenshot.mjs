/**
 * Popover + last marker insert QA (390px).
 * Usage: node scripts/qa/coverageSimulatorPopoverLastMarkerScreenshot.mjs [baseUrl]
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

await page.goto(`${BASE}/coverage-simulator-preview/mobile`, { waitUntil: 'domcontentloaded' })
const cancer = page.getByRole('button', { name: /암 치료/ }).first()
if (await cancer.count()) await cancer.click()
await page.waitForURL(/scenarios\//, { timeout: 30000 })
await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })

const menuTriggers = page.locator('.cs-axis-row-menu__trigger')
const count = await menuTriggers.count()
if (count > 0) {
  const mid = menuTriggers.nth(Math.min(2, count - 1))
  await mid.scrollIntoViewIfNeeded()
  await mid.click()
  await page.waitForSelector('.coverage-simulator-sheet--item-actions', { timeout: 5000 })
  await page.screenshot({
    path: join(outDir, 'mobile-item-action-sheet-390.png'),
    fullPage: false,
  })
  await page.keyboard.press('Escape')
  await page.mouse.click(8, 8)
  await page.waitForTimeout(300)
}

const markerTail = page.locator('.cs-axis-insert--marker-tail').first()
if (await markerTail.count()) {
  await markerTail.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: join(outDir, 'mobile-last-marker-insert-390.png'),
    fullPage: false,
  })
  await markerTail.locator('.cs-axis-insert__btn').click()
  await page.waitForSelector('.coverage-simulator-sheet', { timeout: 10000 })
  const pick = page.getByRole('button', { name: /표적항암|항암치료|암 수술/ }).first()
  if (await pick.count()) {
    await pick.click()
    await page.waitForSelector('.coverage-simulator-sheet', { state: 'hidden', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(400)
    await page.screenshot({
      path: join(outDir, 'mobile-item-after-last-marker-390.png'),
      fullPage: false,
    })
  }
}

await browser.close()
console.log('screenshots written to', outDir)
