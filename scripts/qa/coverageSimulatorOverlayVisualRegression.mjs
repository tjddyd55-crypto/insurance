/**
 * Overlay + inline amount baselines (390x844) and row-height guard.
 * Usage: node scripts/qa/coverageSimulatorOverlayVisualRegression.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const MOBILE = `${BASE}/coverage-simulator-preview/mobile`
const baselineDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'overlay-baseline')

const shots = [
  {
    id: 'list-action-sheet',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer`, { waitUntil: 'domcontentloaded' })
      if ((await page.locator('.cs-simulation-list__more').count()) === 0) return false
      await page.locator('.cs-simulation-list__more').first().click()
      await page.waitForSelector('.cs-list-action-sheet', { timeout: 15000 })
      return true
    },
  },
  {
    id: 'item-direct-edit-sheet',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
      await page.locator('.cs-axis-row-menu__trigger').first().click()
      await page.waitForSelector('.cs-amount-sheet', { timeout: 10000 })
      const hasItemAction = (await page.locator('.cs-item-action-sheet').count()) > 0
      if (hasItemAction) throw new Error('item action sheet should not open on ⋯')
      return true
    },
  },
  {
    id: 'amount-edit-sheet',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
      await page.locator('.cs-axis-row-menu__trigger').first().click()
      await page.getByRole('menuitem', { name: '항목 수정' }).click()
      await page.waitForSelector('.cs-amount-sheet', { timeout: 10000 })
      return true
    },
  },
  {
    id: 'add-item-sheet',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
      await page.locator('.cs-axis-insert__btn').first().click()
      await page.waitForSelector('.cs-add-sheet', { timeout: 10000 })
      return true
    },
  },
  {
    id: 'inline-amount-normal',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
      return true
    },
  },
  {
    id: 'inline-amount-editing',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
      await page.locator('.cs-axis-amount--proposed').first().click()
      await page.waitForSelector('.cs-axis-amount__inline-input', { timeout: 5000 })
      return true
    },
  },
  {
    id: 'inline-amount-none-edit',
    setup: async (page) => {
      await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
      await page.locator('.cs-axis-amount--current').nth(1).click()
      await page.waitForSelector('.cs-axis-amount__inline-input', { timeout: 5000 })
      return true
    },
  },
]

async function main() {
  await mkdir(baselineDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  const failures = []
  const metrics = {}

  await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  const row = page.locator('.cs-axis-event__compare').first()
  const heightBefore = await row.evaluate((el) => el.getBoundingClientRect().height)
  await page.locator('.cs-axis-amount--proposed').first().click()
  await page.waitForSelector('.cs-axis-amount__inline-input')
  const heightDuring = await row.evaluate((el) => el.getBoundingClientRect().height)
  metrics.rowHeight = { before: heightBefore, during: heightDuring, delta: Math.abs(heightDuring - heightBefore) }
  if (metrics.rowHeight.delta > 2) failures.push(`row-height delta ${metrics.rowHeight.delta}px`)

  for (const shot of shots) {
    const ok = await shot.setup(page)
    if (!ok) {
      console.warn(`[skip] ${shot.id} — no data for setup`)
      continue
    }
    if (shot.id === 'list-action-sheet') {
      metrics.listSheet = await page.evaluate(() => {
        const panel = document.querySelector('.cs-list-action-sheet')
        const cancel = document.querySelector('.cs-list-action-sheet__cancel')
        return {
          cancelInside: Boolean(panel && cancel && panel.contains(cancel)),
          z: getComputedStyle(document.querySelector('.cs-overlay')).zIndex,
        }
      })
      if (!metrics.listSheet.cancelInside) failures.push('list-action-sheet: cancel outside panel')
    }
    await page.screenshot({ path: join(baselineDir, `${shot.id}-390.png`) })
    console.log(`[screenshot] ${shot.id}`)
  }

  await writeFile(join(baselineDir, 'metrics.json'), JSON.stringify(metrics, null, 2))
  await browser.close()

  if (failures.length) {
    console.error('Failures:', failures)
    process.exit(1)
  }
  console.log('Overlay visual regression passed.', metrics)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
