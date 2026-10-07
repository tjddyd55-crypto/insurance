/**
 * DEV QA: document CRUD, save dirty state, item action sheet (Playwright mobile viewport).
 *
 * Usage:
 *   node scripts/qa/coverageSimulatorDocumentCrudDevQa.mjs https://insurance-dev.up.railway.app
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || process.env.COVERAGE_SIM_BASE_URL || 'https://insurance-dev.up.railway.app').replace(
  /\/$/,
  '',
)
const MOBILE = `${BASE}/coverage-simulator-preview/mobile`
const STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'dev-qa-document-crud')

const results = []

function pass(id, detail) {
  results.push({ id, status: 'PASS', detail })
  console.log(`[PASS] ${id}: ${detail}`)
}

function fail(id, detail) {
  results.push({ id, status: 'FAIL', detail })
  console.error(`[FAIL] ${id}: ${detail}`)
}

async function readToast(page) {
  const toast = page.locator('.coverage-simulator-toast')
  await toast.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null)
  const text = (await toast.textContent().catch(() => ''))?.trim() ?? ''
  await page.waitForTimeout(400)
  return text
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  await page.goto(MOBILE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-simulator-public-mobile-root"]', { timeout: 60000 })

  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)

  await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })

  const proposedCell = page.locator('.cs-axis-amount--proposed').first()
  await proposedCell.click()
  const amountSheet = page.locator('.coverage-simulator-sheet')
  await amountSheet.waitFor({ timeout: 10000 })
  await page.locator('#edit-proposed').fill('1500')
  await amountSheet.getByRole('button', { name: '확인' }).click()
  await amountSheet.waitFor({ state: 'hidden', timeout: 10000 })

  await page.getByRole('button', { name: '저장' }).first().click()
  await page.waitForSelector('.coverage-simulator-dialog__input', { timeout: 10000 })
  await page.locator('.coverage-simulator-dialog__input').fill('QA 암 치료 DEV')
  await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  const firstSaveToast = await readToast(page)
  if (firstSaveToast.includes('저장되었습니다')) pass('3-save-after-edit', firstSaveToast)
  else fail('3-save-after-edit', `expected 저장되었습니다, got: ${firstSaveToast}`)

  const scenarioUrl = page.url()
  const scenarioId = scenarioUrl.match(/scenarios\/([^/]+)/)?.[1]
  if (!scenarioId) fail('scenario-id', scenarioUrl)
  else pass('scenario-id', scenarioId)

  await page.getByRole('button', { name: '저장' }).first().click()
  const unchangedToast = await readToast(page)
  if (unchangedToast.includes('변경된 내용이 없습니다')) pass('4-save-unchanged', unchangedToast)
  else fail('4-save-unchanged', `got: ${unchangedToast}`)

  await proposedCell.click()
  await amountSheet.waitFor({ timeout: 10000 })
  await page.locator('#edit-proposed').fill('2000')
  await amountSheet.getByRole('button', { name: '확인' }).click()
  await amountSheet.waitFor({ state: 'hidden', timeout: 10000 })
  await page.getByRole('button', { name: '저장' }).first().click()
  const secondSaveToast = await readToast(page)
  if (secondSaveToast.includes('저장되었습니다')) pass('3-save-amount-change', secondSaveToast)
  else fail('3-save-amount-change', `got: ${secondSaveToast}`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  const reloadedText = await proposedCell.textContent()
  if (reloadedText?.includes('2,000') || reloadedText?.includes('2000')) pass('3-f5-amount', reloadedText.trim())
  else fail('3-f5-amount', `got: ${reloadedText}`)

  await page.goto(`${MOBILE}/cancer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cs-simulation-list__card', { timeout: 15000 })
  await page.locator('.cs-simulation-list__more').first().click()
  await page.waitForSelector('.cs-item-action-sheet', { timeout: 5000 })
  await page.getByRole('menuitem', { name: '제목 수정' }).click()
  await page.locator('.coverage-simulator-dialog__input').fill('QA 암 치료 1차 상담')
  await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  const renameToast = await readToast(page)
  if (renameToast.includes('제목이 수정되었습니다')) pass('1-rename-toast', renameToast)
  else fail('1-rename-toast', renameToast)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const titleAfterReload = await page.locator('.cs-simulation-list__title').first().textContent()
  if (titleAfterReload?.includes('1차 상담')) pass('1-rename-reload', titleAfterReload.trim())
  else fail('1-rename-reload', titleAfterReload ?? '')

  await page.locator('.cs-simulation-list__more').first().click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await page.getByRole('button', { name: '삭제' }).click()
  const deleteToast = await readToast(page)
  if (deleteToast.includes('삭제되었습니다')) pass('2-delete-toast', deleteToast)
  else fail('2-delete-toast', deleteToast)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const cardCount = await page.locator('.cs-simulation-list__card').count()
  if (cardCount === 0) pass('2-delete-reload', 'list empty')
  else fail('2-delete-reload', `cards=${cardCount}`)

  await page.goto(`${MOBILE}/cancer/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  const rowsBefore = await page.locator('.cs-axis-event-row').count()
  const insertBtn = page.locator('.cs-axis-insert__btn').first()
  await insertBtn.click()
  await page.locator('.coverage-simulator-catalog-grid--time button').first().click()
  await page.waitForTimeout(400)
  const rowsAfterMarker = await page.locator('.cs-axis-event-row').count()
  if (rowsAfterMarker > rowsBefore) pass('5-marker-add', `rows ${rowsBefore}->${rowsAfterMarker}`)
  else fail('5-marker-add', `rows ${rowsBefore}->${rowsAfterMarker}`)

  await page.getByRole('button', { name: '저장' }).first().click()
  await page.locator('.coverage-simulator-dialog__input').fill('QA marker flow')
  await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  await readToast(page)
  const markerUrl = page.url()
  const markerId = markerUrl.match(/scenarios\/([^/]+)/)?.[1]

  await page.reload({ waitUntil: 'domcontentloaded' })
  const markerRowsReload = await page.locator('.cs-axis-marker').count()
  if (markerRowsReload >= 1) pass('5-marker-f5', `markers=${markerRowsReload}`)
  else fail('5-marker-f5', `markers=${markerRowsReload}`)

  const menuTrigger = page.locator('.cs-axis-row-menu__trigger').first()
  await menuTrigger.click()
  await page.waitForSelector('.cs-item-action-sheet', { timeout: 5000 })
  await page.screenshot({ path: join(outDir, 'item-action-sheet.png') })

  const sheetMetrics = await page.evaluate(() => {
    const overlay = document.querySelector('.cs-overlay[data-cs-overlay-layer="action"]')
    const dock = document.querySelector('[data-testid="coverage-simulator-mobile-sticky-dock"]')
    if (!overlay || !dock) return { ok: false, reason: 'missing overlay or dock' }
    const oz = getComputedStyle(overlay).zIndex
    const dz = getComputedStyle(dock).zIndex
    const overlayRect = overlay.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    const sheet = document.querySelector('.cs-item-action-sheet')
    const cancelInside = sheet?.contains(document.querySelector('.cs-item-action-sheet__cancel'))
    const sr = sheet?.getBoundingClientRect()
    const timelineBleed = sheet && sr
      ? Array.from(document.querySelectorAll('.cs-axis-event-row, .cs-axis-period-total')).some((el) => {
          const r = el.getBoundingClientRect()
          const overlapsY = r.bottom > sr.top + 8 && r.top < sr.bottom - 8
          const overlapsX = r.right > sr.left && r.left < sr.right
          return overlapsX && overlapsY
        })
      : false
    const ozNum = oz === 'auto' ? 0 : Number(oz)
    return {
      ok: ozNum >= 1200 && Number(dz) < ozNum && cancelInside && !timelineBleed,
      oz,
      dz,
      cancelInside,
      timelineBleed,
      overlayH: overlayRect.height,
    }
  })

  if (sheetMetrics.ok) pass('6-action-sheet-layer', JSON.stringify(sheetMetrics))
  else fail('6-action-sheet-layer', JSON.stringify(sheetMetrics))

  await page.getByRole('button', { name: '취소' }).click()
  await page.waitForSelector('.cs-item-action-sheet', { state: 'hidden', timeout: 5000 })
  pass('7-cancel', 'sheet closed')

  await menuTrigger.click()
  await page.getByRole('menuitem', { name: '항목 수정' }).click()
  const editOpen = await page.locator('.coverage-simulator-sheet').isVisible()
  const actionClosed = (await page.locator('.cs-item-action-sheet').count()) === 0
  if (editOpen && actionClosed) pass('7-edit-opens', 'edit sheet only')
  else fail('7-edit-opens', `edit=${editOpen} actionClosed=${actionClosed}`)

  await page.getByRole('button', { name: '취소' }).click()

  await menuTrigger.click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await page.getByRole('button', { name: '삭제' }).click()
  await page.waitForTimeout(500)
  const rowsAfterDelete = await page.locator('.cs-axis-event-row').count()
  await page.getByRole('button', { name: '저장' }).first().click()
  const deleteSaveToast = await readToast(page)
  if (deleteSaveToast.includes('저장되었습니다')) pass('5-item-delete-save', deleteSaveToast)
  else fail('5-item-delete-save', deleteSaveToast)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const rowsAfterF5 = await page.locator('.cs-axis-event-row').count()
  if (rowsAfterF5 === rowsAfterDelete) pass('5-delete-f5', `rows=${rowsAfterF5}`)
  else fail('5-delete-f5', `expected ${rowsAfterDelete}, got ${rowsAfterF5}`)

  if (markerId) {
    await page.evaluate(
      ({ key, id }) => {
        const raw = localStorage.getItem(key)
        if (!raw) return
        const list = JSON.parse(raw)
        localStorage.setItem(key, JSON.stringify(list.filter((row) => row.id !== id)))
      },
      { key: STORAGE_KEY, id: markerId },
    )
  }

  const versionRes = await fetch(`${BASE}/version.json`)
  const version = await versionRes.json()
  pass('dev-sha', version.gitCommitSha ?? 'unknown')

  await writeFile(join(outDir, 'results.json'), JSON.stringify({ base: BASE, results, version }, null, 2), 'utf8')

  await browser.close()
  const failed = results.filter((r) => r.status === 'FAIL')
  if (failed.length) {
    console.error(`\n${failed.length} failure(s)`)
    process.exit(1)
  }
  console.log('\nAll Playwright DEV checks passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
