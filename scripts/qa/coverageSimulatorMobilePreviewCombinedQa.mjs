/**
 * DEV combined QA: inline amount + scroll lock + list action sheet + save CRUD
 * Usage: node scripts/qa/coverageSimulatorMobilePreviewCombinedQa.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const MOBILE = `${BASE}/coverage-simulator-preview/mobile`
const STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'combined-qa')

const results = []
const pass = (id, d) => {
  results.push({ id, status: 'PASS', detail: d })
  console.log(`[PASS] ${id}: ${d}`)
}
const fail = (id, d) => {
  results.push({ id, status: 'FAIL', detail: d })
  console.error(`[FAIL] ${id}: ${d}`)
}

async function toast(page) {
  const el = page.locator('.coverage-simulator-toast')
  await el.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null)
  const text = (await el.textContent().catch(() => ''))?.trim() ?? ''
  await page.waitForTimeout(300)
  return text
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  const versionRes = await fetch(`${BASE}/version.json`)
  const version = await versionRes.json()
  pass('dev-version', version.gitCommitSha ?? 'unknown')

  await page.goto(MOBILE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)

  // --- A. Inline amount on new draft ---
  await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })

  const proposedCell = page.locator('.cs-axis-amount--proposed').first()
  const dockBefore = await page.locator('[data-testid="coverage-simulator-mobile-sticky-dock"]').textContent()

  await proposedCell.click()
  const inlineInput = page.locator('.cs-axis-amount__inline-input').first()
  const fullSheet = page.locator('.cs-amount-sheet')
  if (await inlineInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    pass('A-inline-opens', 'inline input visible')
  } else if (await fullSheet.isVisible().catch(() => false)) {
    fail('A-inline-opens', 'opened full sheet instead of inline')
  } else {
    fail('A-inline-opens', 'no editor opened')
  }

  await inlineInput.fill('2,500')
  await inlineInput.press('Enter')
  await page.waitForTimeout(400)
  const proposedText = await proposedCell.textContent()
  if (proposedText?.includes('2,500')) pass('A-inline-commit', proposedText.trim())
  else fail('A-inline-commit', proposedText ?? '')

  const dockAfter = await page.locator('[data-testid="coverage-simulator-mobile-sticky-dock"]').textContent()
  if (dockBefore !== dockAfter) pass('A-dock-total-update', 'dock text changed')
  else fail('A-dock-total-update', 'dock unchanged')

  // 없음 -> 500
  const currentCell = page.locator('.cs-axis-amount--current').nth(1)
  await currentCell.click()
  await page.locator('.cs-axis-amount__inline-input').first().fill('500')
  await page.locator('.cs-axis-amount__inline-input').first().press('Enter')
  const currentText = await currentCell.textContent()
  if (currentText?.includes('500')) pass('A-none-to-amount', currentText.trim())
  else fail('A-none-to-amount', currentText ?? '')

  // Scroll lock with full edit sheet
  await page.locator('.cs-axis-row-menu__trigger').first().click()
  await page.getByRole('menuitem', { name: '항목 수정' }).click()
  await page.waitForSelector('.cs-amount-sheet', { timeout: 8000 })
  const locked = await page.evaluate(() =>
    document.documentElement.classList.contains('coverage-simulator-overlay-scroll-lock'),
  )
  if (locked) pass('A-scroll-lock-class', 'overlay scroll lock active')
  else fail('A-scroll-lock-class', 'lock class missing')

  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(200)
  const scrollAfterWheel = await page.evaluate(() => window.scrollY)
  if (Math.abs(scrollAfterWheel - scrollBefore) < 8) pass('A-scroll-lock-wheel', `y=${scrollBefore}`)
  else fail('A-scroll-lock-wheel', `before=${scrollBefore} after=${scrollAfterWheel}`)

  await page.locator('.cs-amount-sheet__close').click()
  await page.screenshot({ path: join(outDir, 'inline-amount-390.png') })

  // Save draft + F5
  await page.locator('.cs-mobile-editor-header__action--save').click()
  await page.locator('.coverage-simulator-dialog__input').fill('QA Combined A')
  await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  const saveToast = await toast(page)
  if (saveToast.includes('저장되었습니다')) pass('A-save', saveToast)
  else fail('A-save', saveToast)

  const scenarioUrl = page.url()
  await page.reload({ waitUntil: 'domcontentloaded' })
  const reloaded = await page.locator('.cs-axis-amount--proposed').first().textContent()
  if (reloaded?.includes('2,500') || reloaded?.includes('2,500')) pass('A-f5', reloaded?.trim() ?? '')
  else fail('A-f5', reloaded ?? '')

  // --- B. List action sheet ---
  await page.goto(`${MOBILE}/cancer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cs-simulation-list__more', { timeout: 20000 })
  await page.locator('.cs-simulation-list__more').first().click()
  await page.waitForSelector('.cs-list-action-sheet', { timeout: 10000 })

  const sheetMetrics = await page.evaluate(() => {
    const panel = document.querySelector('.cs-list-action-sheet')
    const overlay = document.querySelector('.cs-overlay[data-cs-overlay-layer="action"]')
    const cancel = document.querySelector('.cs-list-action-sheet__cancel')
    return {
      z: overlay ? getComputedStyle(overlay).zIndex : null,
      cancelInside: Boolean(panel && cancel && panel.contains(cancel)),
      rows: document.querySelectorAll('.cs-list-action-sheet__row').length,
    }
  })
  if (sheetMetrics.cancelInside && sheetMetrics.rows === 3) pass('B-sheet-ui', JSON.stringify(sheetMetrics))
  else fail('B-sheet-ui', JSON.stringify(sheetMetrics))

  const listLocked = await page.evaluate(() =>
    document.documentElement.classList.contains('coverage-simulator-overlay-scroll-lock'),
  )
  if (listLocked) pass('B-list-scroll-lock', 'active')
  else fail('B-list-scroll-lock', 'missing')

  await page.screenshot({ path: join(outDir, 'list-action-sheet-390.png') })
  await page.getByRole('menuitem', { name: '제목 수정' }).click()
  await page.waitForSelector('.coverage-simulator-dialog__input', { timeout: 8000 })
  if (!(await page.locator('.cs-list-action-sheet').isVisible().catch(() => false))) {
    pass('B-rename-no-overlap', 'sheet closed before dialog')
  } else fail('B-rename-no-overlap', 'sheet still visible')

  await page.locator('.coverage-simulator-dialog__input').fill('QA Combined B Title')
  await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  const renameToast = await toast(page)
  if (renameToast.includes('제목이 수정되었습니다')) pass('B-rename', renameToast)
  else fail('B-rename', renameToast)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const title = await page.locator('.cs-simulation-list__title').first().textContent()
  if (title?.includes('Combined B Title')) pass('B-rename-reload', title.trim())
  else fail('B-rename-reload', title ?? '')

  await page.locator('.cs-simulation-list__more').first().click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await page.getByRole('button', { name: '삭제' }).click()
  const delToast = await toast(page)
  if (delToast.includes('삭제되었습니다')) pass('B-delete', delToast)
  else fail('B-delete', delToast)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const cards = await page.locator('.cs-simulation-list__card').count()
  if (cards === 0) pass('B-delete-reload', 'empty list')
  else fail('B-delete-reload', `cards=${cards}`)

  await writeFile(
    join(outDir, 'results.json'),
    JSON.stringify({ base: BASE, version, scenarioUrl, results }, null, 2),
    'utf8',
  )
  await browser.close()

  const failed = results.filter((r) => r.status === 'FAIL')
  if (failed.length) {
    console.error(`\n${failed.length} failure(s)`)
    process.exit(1)
  }
  console.log('\nAll combined DEV QA checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
