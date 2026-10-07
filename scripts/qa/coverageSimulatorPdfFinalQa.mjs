/**
 * PDF final QA: QA scenario seed + preview screenshot + jsPDF download + page count.
 * Usage: node scripts/qa/coverageSimulatorPdfFinalQa.mjs [baseUrl]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const MOBILE = `${BASE}/coverage-simulator-preview/mobile`
const PC = `${BASE}/coverage-simulator-preview/pc`
const PDF_RASTER_MODULE_BASE = process.env.COVERAGE_PDF_RASTER_BASE || 'http://localhost:3000'
const MOBILE_STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'
const PC_STORAGE_KEY = 'coverage-simulator-preview-pc:consultations:v1'
const MAN = 10_000
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'pdf')

function coverage(label, category, order, current, proposed) {
  return {
    id: `pdf-${order}`,
    type: 'coverage',
    category,
    label,
    order,
    currentAmount: current * MAN,
    proposedAmount: proposed * MAN,
  }
}

function marker(label, order) {
  return { id: `pdf-m-${order}`, type: 'time-marker', label, order }
}

function buildQaScenario(extraItems = 0) {
  const now = new Date().toISOString()
  const items = [
    coverage('암 진단금', 'diagnosis', 0, 3000, 5000),
    coverage('암 수술비', 'treatment', 1, 300, 1000),
    coverage('항암약물치료', 'treatment', 2, 500, 2000),
    coverage('방사선치료', 'treatment', 3, 300, 1000),
    marker('1년 후', 4),
    coverage('표적항암약물허가치료비', 'treatment', 5, 0, 2000),
    coverage('상급종합병원암주요치료비', 'treatment', 6, 100, 500),
  ]
  for (let i = 0; i < extraItems; i += 1) {
    items.push(
      coverage(
        i % 2 === 0
          ? `표적항암약물허가치료비 ${i + 1}`
          : `상급종합병원암주요치료비 ${i + 1}`,
        'other',
        7 + i,
        100 + i,
        200 + i,
      ),
    )
  }
  return {
    id: `pdf-qa-${extraItems}`,
    title: '김민수 암 치료 1차 상담',
    diseaseType: 'cancer',
    description: 'PDF QA',
    consultationDate: '2026-09-25',
    customerNameSnapshot: '김민수',
    items,
    createdAt: now,
    updatedAt: now,
  }
}

async function renderActualPdfPages(page, pdfBytes, tag) {
  const rasterPage = await page.context().newPage()
  await rasterPage.goto(PDF_RASTER_MODULE_BASE, { waitUntil: 'domcontentloaded' })
  const pageImages = await rasterPage.evaluate(async ({ base64 }) => {
    const pdfjs = await import('/node_modules/.vite/deps/pdfjs-dist.js')
    pdfjs.GlobalWorkerOptions.workerSrc =
      '/node_modules/.vite/deps/pdfjs-dist_build_pdf__worker__min__mjs.js'
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise
    const images = []
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const pdfPage = await pdfDocument.getPage(pageNumber)
      const viewport = pdfPage.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      await pdfPage.render({ canvasContext: context, viewport }).promise
      images.push(canvas.toDataURL('image/png'))
    }
    return images
  }, { base64: Buffer.from(pdfBytes).toString('base64') })
  await rasterPage.close()

  const paths = []
  for (let index = 0; index < pageImages.length; index += 1) {
    const path = join(outDir, `actual-pdf-${tag}-page-${index + 1}.png`)
    await writeFile(path, Buffer.from(pageImages[index].split(',')[1], 'base64'))
    paths.push(path)
  }
  return paths
}

async function runScenario(page, scenario, tag, surface) {
  await page.evaluate(
    ({ key, seed }) => {
      const rows = JSON.parse(localStorage.getItem(key) ?? '[]')
      const next = [seed, ...rows.filter((row) => row.id !== seed.id)]
      localStorage.setItem(key, JSON.stringify(next))
    },
    { key: surface.storageKey, seed: scenario },
  )

  await page.goto(`${surface.basePath}/scenarios/${scenario.id}/pdf?coveragePdfDebug=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  })
  await page.waitForSelector('[data-testid="coverage-simulator-print-root"]', { timeout: 60000 })

  const checks = await page.evaluate(() => {
    const root = document.querySelector('.coverage-simulator-pdf-print-source [data-testid="coverage-simulator-print-root"]')
    const grand = root?.querySelector('[data-testid="coverage-grand-total"]')
    const subtotals = document.querySelectorAll('[data-testid="coverage-period-subtotal"]').length
    const markers = document.querySelectorAll('.cs-axis-marker').length
    const firstAmount = root?.querySelector('.cs-axis-amount--proposed')?.textContent?.trim() ?? ''
    const grandProposed = root?.querySelector('.cs-axis-summary__value--proposed')?.textContent?.trim() ?? ''
    const labels = Array.from(root?.querySelectorAll('.cs-axis-event__label') ?? []).map((node) => node.textContent?.trim())
    return { root: Boolean(root), grand: Boolean(grand), subtotals, markers, firstAmount, grandProposed, labels }
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.coverage-simulator-pdf-preview__zoom-doc').screenshot({
    path: join(outDir, `print-dom-${tag}.png`),
  })

  page.on('pageerror', (err) => console.error('[pageerror]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console]', msg.text())
  })
  const downloadPromise = page
    .waitForEvent('download', { timeout: 30000 })
    .catch(() => null)
  await page.getByRole('button', { name: 'PDF 저장' }).click()
  try {
    await page.waitForFunction(() => Boolean(window.__coveragePdfDebugCapture), null, {
      timeout: 30000,
    })
  } catch (error) {
    const failureState = await page.evaluate(() => ({
      bodyText: document.body.innerText,
      debugReady: Boolean(window.__coveragePdfDebugCapture),
      titleStyles: Array.from(
        document.querySelectorAll(
          '.coverage-simulator-pdf-print-source .cs-axis-event__label',
        ),
      ).slice(0, 8).map((node) => {
        const element = /** @type {HTMLElement} */ (node)
        const style = getComputedStyle(element)
        return {
          text: element.textContent?.trim(),
          overflow: style.overflow,
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          display: style.display,
          lineHeight: style.lineHeight,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }
      }),
      modernColors: Array.from(
        document.querySelectorAll(
          '.coverage-simulator-pdf-print-source [data-testid="coverage-simulator-print-root"], .coverage-simulator-pdf-print-source [data-testid="coverage-simulator-print-root"] *',
        ),
      ).flatMap((node) => {
        const style = getComputedStyle(node)
        return [
          ['color', style.color],
          ['backgroundColor', style.backgroundColor],
          ['borderTopColor', style.borderTopColor],
          ['borderRightColor', style.borderRightColor],
          ['borderBottomColor', style.borderBottomColor],
          ['borderLeftColor', style.borderLeftColor],
          ['boxShadow', style.boxShadow],
        ].filter(([, value]) => value.includes('color(')).map(([property, value]) => ({
          className: node.className,
          property,
          value,
        }))
      }).slice(0, 30),
    }))
    await page.screenshot({
      path: join(outDir, `pdf-generation-failure-${tag}.png`),
      fullPage: true,
    })
    throw new Error(
      `PDF debug capture timeout: ${JSON.stringify(failureState)}`,
      { cause: error },
    )
  }
  const debugCapture = await page.evaluate(() => window.__coveragePdfDebugCapture)
  if (!debugCapture) throw new Error('missing coverage PDF debug capture')
  const pngBase64 = debugCapture.pngDataUrl.split(',')[1]
  await writeFile(join(outDir, `capture-${tag}.png`), Buffer.from(pngBase64, 'base64'))
  const pdfPath = join(outDir, `coverage-simulator-${tag}.pdf`)
  const download = await Promise.race([
    downloadPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
  ])
  if (download) {
    await download.saveAs(pdfPath)
  } else {
    const pdfBase64 = debugCapture.pdfDataUrl.split(',')[1]
    await writeFile(pdfPath, Buffer.from(pdfBase64, 'base64'))
  }

  const bytes = await import('node:fs/promises').then((fs) => fs.readFile(pdfPath))
  const doc = await PDFDocument.load(bytes)
  const pageCount = doc.getPageCount()

  const pdfScreenshots = await renderActualPdfPages(page, bytes, tag)

  return {
    checks,
    diagnostics: debugCapture.diagnostics,
    capturePngPath: join(outDir, `capture-${tag}.png`),
    pdfPath,
    pdfScreenshots,
    pageCount,
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    acceptDownloads: true,
  })
  const page = await context.newPage()

  const versionResponse = await fetch(`${BASE}/version.json`)
  const version = versionResponse.headers.get('content-type')?.includes('application/json')
    ? await versionResponse.json()
    : { gitCommitSha: 'local-dev' }
  const results = []

  await page.goto(MOBILE, { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), MOBILE_STORAGE_KEY)

  const mobileSurface = { basePath: MOBILE, storageKey: MOBILE_STORAGE_KEY }
  const onePage = await runScenario(page, buildQaScenario(0), 'qa-1p', mobileSurface)
  results.push({ id: 'pdf-1p', ...onePage })

  const long = await runScenario(page, buildQaScenario(14), 'qa-long', mobileSurface)
  results.push({ id: 'pdf-long', ...long })

  const pcContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  })
  const pcPage = await pcContext.newPage()
  await pcPage.goto(PC, { waitUntil: 'domcontentloaded' })
  await pcPage.evaluate((key) => localStorage.removeItem(key), PC_STORAGE_KEY)
  const pcOnePage = await runScenario(
    pcPage,
    buildQaScenario(0),
    'qa-pc-1p',
    { basePath: PC, storageKey: PC_STORAGE_KEY },
  )
  results.push({ id: 'pdf-pc-1p', ...pcOnePage })
  await pcContext.close()
  await browser.close()

  const failures = []
  if (!onePage.checks.firstAmount.includes(' 만원')) failures.push('amount-spacing')
  if (!onePage.checks.grandProposed.includes(' 만원')) failures.push('grand-format')
  if (onePage.checks.subtotals < 1) failures.push('subtotals')
  if (onePage.checks.markers < 1) failures.push('markers')
  if (onePage.pageCount !== 1) failures.push(`short-page-count:${onePage.pageCount}`)
  if (long.pageCount < 2) failures.push('long-multipage')
  if (onePage.diagnostics.calculatedPageCount !== onePage.pageCount) failures.push('short-calculated-page-count')
  if (long.diagnostics.calculatedPageCount !== long.pageCount) failures.push('long-calculated-page-count')
  if (onePage.diagnostics.title?.overflow !== 'visible') failures.push('title-overflow')
  if (onePage.diagnostics.title?.whiteSpace !== 'normal') failures.push('title-white-space')
  if (onePage.diagnostics.title?.transform !== 'none') failures.push('title-transform')
  for (const [surface, result] of [['mobile', onePage], ['pc', pcOnePage]]) {
    const badge = result.diagnostics.badge
    if (!['flex', 'inline-flex'].includes(badge?.display)) {
      failures.push(`${surface}-badge-display`)
    }
    if (badge?.alignItems !== 'center') failures.push(`${surface}-badge-align`)
    if (badge?.justifyContent !== 'center') failures.push(`${surface}-badge-justify`)
    if (badge?.lineHeight !== '10px') failures.push(`${surface}-badge-line-height`)
    if (badge?.paddingTop !== badge?.paddingBottom) failures.push(`${surface}-badge-padding`)
    if (badge?.transform !== 'none') failures.push(`${surface}-badge-transform`)
  }
  if (pcOnePage.pageCount !== 1) failures.push(`pc-short-page-count:${pcOnePage.pageCount}`)

  await writeFile(join(outDir, 'pdf-final-qa-results.json'), JSON.stringify({ version, results, failures }, null, 2))

  if (failures.length) {
    console.error('[FAIL]', failures)
    process.exit(1)
  }
  console.log('[PASS] coverageSimulatorPdfFinalQa', {
    version: version.gitCommitSha,
    shortPages: onePage.pageCount,
    longPages: long.pageCount,
    shortCanvas: `${onePage.diagnostics.canvasWidthPx}x${onePage.diagnostics.canvasHeightPx}`,
    longCanvas: `${long.diagnostics.canvasWidthPx}x${long.diagnostics.canvasHeightPx}`,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
