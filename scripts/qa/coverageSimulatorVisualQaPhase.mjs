/**
 * Coverage Simulator Visual QA capture (public preview — no login).
 *
 * Usage:
 *   node scripts/qa/coverageSimulatorVisualQaPhase.mjs [baseUrl]
 *   node scripts/qa/coverageSimulatorVisualQaPhase.mjs https://insurance-dev.up.railway.app
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || process.env.COVERAGE_SIM_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const PREVIEW = '/coverage-simulator-preview'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator')

async function shot(page, name, opts = {}) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? true })
  return file
}

async function setViewport(page, width, height = 900) {
  await page.setViewportSize({ width, height })
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const log = []

  await login(page)
  log.push(`login ok -> ${page.url()}`)

  await setViewport(page, 390)
  await page.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/coverage-simulator\/?$/, { timeout: 30000 })
  await page.waitForSelector('[data-testid="coverage-simulator-root"]', { timeout: 30000 })
  log.push(await shot(page, 'coverage-simulator-home-390'))

  await page.goto(`${BASE}/coverage-simulator/cancer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]')
  log.push(await shot(page, 'coverage-simulator-cancer-390-before'))
  log.push(await shot(page, 'coverage-simulator-cancer-390'))

  const addButtons = page.locator('.coverage-simulator-add-slot')
  await addButtons.first().click()
  await page.waitForSelector('.coverage-simulator-sheet')
  log.push(await shot(page, 'coverage-simulator-add-sheet-390', { fullPage: false }))

  await page.locator('.coverage-simulator-sheet-backdrop').click({ force: true, position: { x: 8, y: 8 } })
  await page.waitForSelector('.coverage-simulator-sheet', { state: 'hidden', timeout: 5000 })
  await page.locator('.coverage-simulator-amount-box').first().click()
  await page.waitForSelector('.coverage-simulator-sheet', { timeout: 5000 })
  log.push(await shot(page, 'coverage-simulator-amount-edit-390', { fullPage: false }))
  await page.getByRole('button', { name: '취소' }).click()

  await page.evaluate(() => {
    const marker = document.querySelector('.coverage-simulator-time-marker')
    marker?.scrollIntoView({ block: 'center' })
  })
  log.push(await shot(page, 'coverage-simulator-time-marker-390', { fullPage: false }))

  await page.evaluate(() => {
    const summary = document.querySelector('.coverage-simulator-summary')
    summary?.scrollIntoView({ block: 'center' })
  })
  log.push(await shot(page, 'coverage-simulator-summary-390', { fullPage: false }))

  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForTimeout(800)
  const savedUrl = page.url()
  log.push(`saved url: ${savedUrl}`)

  await page.goto(`${BASE}/coverage-simulator/saved`, { waitUntil: 'domcontentloaded' })
  log.push(await shot(page, 'coverage-simulator-saved-390'))

  const scenarioIdMatch = savedUrl.match(/scenarios\/([^/]+)/)
  const scenarioId = scenarioIdMatch?.[1]
  if (scenarioId) {
    await page.goto(`${BASE}/coverage-simulator/scenarios/${scenarioId}/pdf`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('.coverage-simulator-print-root', { timeout: 30000 })
    log.push(await shot(page, 'coverage-simulator-pdf-preview'))

    await page.emulateMedia({ media: 'print' })
    await page.locator('.coverage-simulator-print-root').screenshot({
      path: join(outDir, 'coverage-simulator-browser-print-preview.png'),
    })
    await page.pdf({
      path: join(outDir, 'coverage-simulator-browser-print.pdf'),
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    log.push(join(outDir, 'coverage-simulator-browser-print.pdf'))
    await page.emulateMedia({ media: 'screen' })

    const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
    await page.getByRole('button', { name: 'PDF 저장' }).click()
    const download = await downloadPromise
    const generatedPdf = join(outDir, 'coverage-simulator-generated.pdf')
    await download.saveAs(generatedPdf)
    log.push(generatedPdf)
  }

  await setViewport(page, 1440, 1200)
  await page.goto(`${BASE}/coverage-simulator/cancer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
  log.push(await shot(page, 'coverage-simulator-desktop-1440'))

  for (const width of [360, 375, 412]) {
    await setViewport(page, width)
    await page.goto(`${BASE}/coverage-simulator/cancer`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
    log.push(await shot(page, `coverage-simulator-cancer-${width}`))
  }

  await browser.close()
  await writeFile(join(outDir, 'visual-qa-log.txt'), log.join('\n'), 'utf8')
  console.log(`[coverageSimulatorVisualQaPhase] saved ${log.length} artifacts to ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
