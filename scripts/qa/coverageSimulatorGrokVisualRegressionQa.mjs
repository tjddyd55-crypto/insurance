/**
 * DEV CRM: Grok-normal-state visual + metric regression QA.
 *
 *   node scripts/qa/coverageSimulatorGrokVisualRegressionQa.mjs https://insurance-dev.up.railway.app
 *
 * Env: COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USER = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASS = process.env.COVERAGE_BINDER_QA_PASS
const OUT = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'grok-visual-qa')

const VIEWPORTS = [360, 390, 412, 1280]
const MODES = [
  { id: 'default', file: 'coverage-default' },
  { id: 'option1', file: 'coverage-option1' },
  { id: 'option2', file: 'coverage-option2' },
  { id: 'option3', file: 'coverage-option3' },
]

const results = []

function pass(id, detail) {
  results.push({ id, status: 'PASS', detail })
  console.log(`[PASS] ${id}: ${detail}`)
}
function fail(id, detail) {
  results.push({ id, status: 'FAIL', detail })
  console.error(`[FAIL] ${id}: ${detail}`)
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="username"], input[autocomplete="username"]').first().fill(USER)
  await page.locator('input[type="password"]').first().fill(PASS)
  await page.getByRole('button', { name: /로그인|login/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120000 })
}

async function waitCrmHydrate(page) {
  const loading = page.getByText('보장 시뮬레이션 데이터를 불러오는 중')
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: 'hidden', timeout: 120000 })
  }
}

async function openEditor(page) {
  await page.goto(`${BASE}/coverage-simulator/cerebrovascular/new`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 120000 })
}

async function pickViewMode(page, modeId) {
  const select = page.getByTestId('coverage-view-mode-select')
  if ((await select.count()) > 0) {
    await select.selectOption(modeId)
    await page.waitForTimeout(400)
    return
  }
  await page.getByTestId(`coverage-view-mode-${modeId}`).click()
  await page.waitForTimeout(400)
}

async function measureEditor(page) {
  const root = page.locator('[data-testid="coverage-scenario-editor"]')
  const box = await root.boundingBox()
  const row = page.locator('.cs-axis-event-row, .cs-alt-row').first()
  const rowBox = (await row.count()) > 0 ? await row.boundingBox() : null
  return { rootWidth: box?.width ?? 0, rowHeight: rowBox?.height ?? 0 }
}

async function captureViewModes(page, width) {
  const metrics = {}
  await page.setViewportSize({ width, height: 900 })
  for (const mode of MODES) {
    await pickViewMode(page, mode.id)
    const path = join(OUT, `${mode.file}-${width}.png`)
    await page.screenshot({ path, fullPage: true })
    metrics[mode.id] = await measureEditor(page)
  }
  return metrics
}

async function customerPickerWidths(page) {
  await page.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  await page.getByRole('button', { name: '+ 고객 연결' }).click()
  await page.waitForSelector('.customer-relations-modal', { timeout: 30000 })

  const modal = page.locator('.customer-relations-modal').first()
  const measure = async (label) => {
    const box = await modal.boundingBox()
    const search = page.locator('.customer-relations-modal__search input, .customer-relations-modal__search').first()
    const searchBox = await search.boundingBox()
    return { label, width: box?.width, left: box?.x, searchY: searchBox?.y }
  }

  const full = await measure('full')
  await page.locator('.customer-relations-modal__search input').fill('010')
  await page.waitForTimeout(600)
  const many = await measure('many')
  await page.locator('.customer-relations-modal__search input').fill('zzzz-no-match-qa')
  await page.waitForTimeout(600)
  const zero = await measure('zero')
  await page.locator('.customer-relations-modal__search input').fill('')
  await page.waitForTimeout(400)
  const rows = await page.locator('.customer-relation-search-hit, .customer-relations-search-table tbody tr').count()
  if (rows >= 1) {
    const firstName = await page
      .locator('.customer-relation-search-hit__name, .customer-relations-search-table tbody tr td')
      .first()
      .textContent()
    await page.locator('.customer-relations-modal__search input').fill(String(firstName ?? '').trim().slice(0, 2))
    await page.waitForTimeout(600)
  }
  const one = await measure('one')

  await page.screenshot({ path: join(OUT, 'customer-picker-full.png'), fullPage: false })
  await page.locator('.customer-relations-modal__search input').fill('zzzz-no-match-qa')
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, 'customer-picker-empty.png'), fullPage: false })

  const w = [full.width, many.width, zero.width, one.width]
  const sameWidth = w.every((v) => Math.abs(v - w[0]) < 2)
  return { measures: { full, many, zero, one }, sameWidth }
}

async function main() {
  if (!USER || !PASS) throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS required')
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await login(page)

  await page.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)

  const pcChrome = page.locator('.app-workspace-chrome-header, .pc-workspace-header--navigation-only')
  const mobileChrome = page.locator('.mobile-topbar')
  const hasPc = (await pcChrome.count()) > 0 && (await pcChrome.first().isVisible())
  const immersiveHidden = await page.evaluate(() => {
    const header = document.querySelector('.app-workspace-chrome-header')
    if (!header) return true
    const style = window.getComputedStyle(header)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  if (hasPc || immersiveHidden) pass('crm-shell', 'workspace chrome visible')
  else fail('crm-shell', 'CRM header missing or hidden')

  const badgeTexts = await page.locator('.workspace-sidebar__menu-item-badge').allTextContents()
  const badEntitlement = badgeTexts.filter((t) => /유료|GA 전용/.test(t))
  if (badEntitlement.length === 0) pass('menu-badges', 'no 유료/GA 전용 in sidebar badges')
  else fail('menu-badges', badEntitlement.join(', '))

  await openEditor(page)

  const apiCalls = []
  page.on('request', (req) => {
    if (req.url().includes('/api/coverage-simulator/')) apiCalls.push(req.url())
  })
  await page.goto(`${BASE}/coverage-simulator-preview/pc`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (apiCalls.length === 0) pass('preview-api-isolation', 'no CRM storage API on preview')
  else fail('preview-api-isolation', apiCalls.slice(0, 3).join('; '))

  await openEditor(page)
  const allMetrics = {}
  for (const width of VIEWPORTS) {
    allMetrics[width] = await captureViewModes(page, width)
  }

  const w1280 = allMetrics[1280]
  const rootWidths = Object.values(w1280).map((m) => m.rootWidth)
  const stableOuter = rootWidths.every((w) => Math.abs(w - rootWidths[0]) < 3)
  if (stableOuter) pass('viewmode-outer-width', `1280 widths ${rootWidths.join(',')}`)
  else fail('viewmode-outer-width', rootWidths.join(','))

  const rowHeights = Object.values(w1280).map((m) => m.rowHeight).filter((h) => h > 0)
  if (rowHeights.length && Math.max(...rowHeights) < 120) pass('basic-row-density', `max row ${Math.max(...rowHeights)}px`)
  else if (rowHeights.length) fail('basic-row-density', `max row ${Math.max(...rowHeights)}px (card-like?)`)
  else fail('basic-row-density', 'no row measured')

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  const picker = await customerPickerWidths(page)
  if (picker.sameWidth) pass('customer-picker-width', JSON.stringify(picker.measures))
  else fail('customer-picker-width', JSON.stringify(picker.measures))

  const searchYs = [picker.measures.full.searchY, picker.measures.many.searchY, picker.measures.zero.searchY, picker.measures.one.searchY]
  const topStable = searchYs.every((y) => Math.abs(y - searchYs[0]) < 2)
  if (topStable) pass('customer-picker-top-anchor', searchYs.join(','))
  else fail('customer-picker-top-anchor', searchYs.join(','))

  await page.getByRole('button', { name: '닫기' }).click().catch(() => {})
  await openEditor(page)
  await page.getByTestId('coverage-view-mode-default').click()
  await page.locator('.cs-axis-insert__btn').first().click({ timeout: 15000 })
  await page.getByText('항목 추가').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByRole('button', { name: '치료' }).click().catch(() => {})
  const favStar = page.getByRole('button', { name: /즐겨찾기/ }).first()
  const grid = page.getByTestId('coverage-catalog-grid')
  if ((await grid.count()) > 0) pass('add-item-grid', 'catalog grid present')
  else fail('add-item-grid', 'grid missing')
  if ((await favStar.count()) > 0) pass('add-item-favorite-ui', 'favorite control present')
  else fail('add-item-favorite-ui', 'star not found')

  await browser.close()

  const summary = {
    base: BASE,
    results,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    metrics: allMetrics,
    picker,
  }
  await writeFile(join(OUT, 'results.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail }))
  if (summary.fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
