import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'http://127.0.0.1:4175').replace(/\/$/, '')

const browser = await chromium.launch()
for (const width of [390, 360]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } })
  await page.goto(`${BASE}/coverage-simulator-preview/mobile`, { waitUntil: 'domcontentloaded' })
  const cancer = page.getByRole('button', { name: /암 치료/ }).first()
  if (await cancer.count()) await cancer.click()
  await page.waitForURL(/scenarios\//, { timeout: 30000 })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
  const marker = page.locator('.cs-axis-marker__hline').first()
  if (await marker.count()) {
    await marker.scrollIntoViewIfNeeded()
  }
  await page.screenshot({
    path: `store-screenshots/coverage-simulator/mobile-event-header-${width}.png`,
    fullPage: false,
  })
  await page.close()
}
await browser.close()
