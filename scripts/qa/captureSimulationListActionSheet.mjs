import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const out = join(process.cwd(), 'store-screenshots', 'coverage-simulator')

const browser = await chromium.launch()
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
).newPage()

await page.goto(`${BASE}/coverage-simulator-preview/mobile/cancer`, { waitUntil: 'domcontentloaded', timeout: 60000 })
if ((await page.locator('.cs-simulation-list__more').count()) === 0) {
  await page.goto(`${BASE}/coverage-simulator-preview/mobile/cancer/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  await page.locator('.cs-mobile-editor-header__action--save').click()
  await page.locator('.coverage-simulator-dialog__input').fill('QA list sheet')
  await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  await page.waitForTimeout(1000)
  await page.goto(`${BASE}/coverage-simulator-preview/mobile/cancer`, { waitUntil: 'domcontentloaded' })
}

await page.locator('.cs-simulation-list__more').first().click()
await page.waitForSelector('.cs-list-action-sheet', { timeout: 15000 })
await mkdir(out, { recursive: true })
await page.screenshot({ path: join(out, 'mobile-simulation-list-action-sheet-390.png') })
const metrics = await page.evaluate(() => ({
  zIndex: getComputedStyle(document.querySelector('.cs-overlay')).zIndex,
  cancelInside: document
    .querySelector('.cs-list-action-sheet')
    ?.contains(document.querySelector('.cs-list-action-sheet__cancel')),
}))
console.log(JSON.stringify(metrics, null, 2))
await browser.close()
