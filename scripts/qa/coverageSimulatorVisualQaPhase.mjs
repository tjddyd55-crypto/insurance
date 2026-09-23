/**
 * Coverage Simulator Visual QA capture (public preview — no login).
 *
 * Usage:
 *   node scripts/qa/coverageSimulatorVisualQaPhase.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || process.env.COVERAGE_SIM_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOBILE_PREVIEW = '/coverage-simulator-preview/mobile'
const PC_PREVIEW = '/coverage-simulator-preview/pc'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator')

async function shot(page, name, opts = {}) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? true })
  return file
}

async function setViewport(page, width, height = 900) {
  await page.setViewportSize({ width, height })
}

async function captureMobileFlow(page, log) {
  await setViewport(page, 390)
  await page.goto(`${BASE}${MOBILE_PREVIEW}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-simulator-public-mobile-root"]', { timeout: 30000 })
  await page.waitForSelector('[data-testid="coverage-simulator-root"]', { timeout: 30000 })
  log.push(await shot(page, 'mobile-preview-home-390'))

  await page.goto(`${BASE}${MOBILE_PREVIEW}/cancer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
  log.push(await shot(page, 'mobile-preview-cancer-390'))

  const addButtons = page.locator('.coverage-simulator-add-slot')
  await addButtons.first().click()
  await page.waitForSelector('.coverage-simulator-sheet')
  log.push(await shot(page, 'mobile-preview-add-sheet-390', { fullPage: false }))

  await page.locator('.coverage-simulator-sheet-backdrop').click({ force: true, position: { x: 8, y: 8 } })
  await page.waitForSelector('.coverage-simulator-sheet', { state: 'hidden', timeout: 5000 })
  await page.locator('.coverage-simulator-amount-box').first().click()
  await page.waitForSelector('.coverage-simulator-sheet', { timeout: 5000 })
  log.push(await shot(page, 'mobile-preview-amount-edit-390', { fullPage: false }))
  await page.getByRole('button', { name: '취소' }).click()

  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForTimeout(800)
  const savedUrl = page.url()
  log.push(`mobile saved url: ${savedUrl}`)

  const scenarioIdMatch = savedUrl.match(/scenarios\/([^/]+)/)
  const scenarioId = scenarioIdMatch?.[1]
  if (scenarioId) {
    await page.goto(`${BASE}${MOBILE_PREVIEW}/scenarios/${scenarioId}/pdf`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('.coverage-simulator-print-root', { timeout: 30000 })
    log.push(await shot(page, 'mobile-preview-pdf-screen'))

    await page.emulateMedia({ media: 'print' })
    await page.locator('.coverage-simulator-print-root').screenshot({
      path: join(outDir, 'mobile-preview-browser-print.png'),
    })
    await page.pdf({
      path: join(outDir, 'mobile-preview-browser-print.pdf'),
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    log.push(join(outDir, 'mobile-preview-browser-print.pdf'))
    await page.emulateMedia({ media: 'screen' })

    const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
    await page.getByRole('button', { name: 'PDF 저장' }).click()
    const download = await downloadPromise
    const generatedPdf = join(outDir, 'mobile-preview-generated.pdf')
    await download.saveAs(generatedPdf)
    log.push(generatedPdf)
  }

  for (const width of [360, 375, 412]) {
    await setViewport(page, width)
    await page.goto(`${BASE}${MOBILE_PREVIEW}/cancer`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
    log.push(await shot(page, `mobile-preview-cancer-${width}`))
  }
}

async function capturePcFlow(page, log) {
  await setViewport(page, 1440, 1200)
  await page.goto(`${BASE}${PC_PREVIEW}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-simulator-public-pc-root"]', { timeout: 30000 })
  log.push(await shot(page, 'pc-preview-home-1440'))

  await page.goto(`${BASE}${PC_PREVIEW}/cancer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
  log.push(await shot(page, 'pc-preview-cancer-1440'))

  await page.locator('.coverage-simulator-add-slot--pc, .coverage-simulator-add-slot').first().click()
  await page.waitForSelector('.coverage-simulator-sheet', { timeout: 10000 })
  log.push(await shot(page, 'pc-preview-add-sheet-1440', { fullPage: false }))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '저장' }).first().click()
  await page.waitForTimeout(800)
  log.push(`pc saved url: ${page.url()}`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const log = []

  await captureMobileFlow(page, log)
  await capturePcFlow(page, log)

  await browser.close()
  await writeFile(join(outDir, 'visual-qa-log.txt'), log.join('\n'), 'utf8')
  console.log(`[coverageSimulatorVisualQaPhase] saved ${log.length} artifacts to ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
