import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const MOBILE = `${BASE}/coverage-simulator-preview/mobile`
const STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'pdf')

function buildScenario() {
  const now = new Date().toISOString()
  const labels = ['암 진단금', '암 수술비', '항암약물치료', '방사선치료']
  const items = labels.map((label, index) => ({
    id: `preview-stability-${index}`,
    type: 'coverage',
    category: index === 0 ? 'diagnosis' : 'treatment',
    label,
    currentAmount: (index + 1) * 1_000_000,
    proposedAmount: (index + 5) * 1_000_000,
    order: index,
  }))
  items.push({
    id: 'preview-stability-marker',
    type: 'time-marker',
    label: '1년 후',
    order: items.length,
  })
  items.push({
    id: 'preview-stability-support',
    type: 'coverage',
    category: 'support',
    label: '간병비',
    currentAmount: 0,
    proposedAmount: 10_000_000,
    order: items.length,
  })
  return {
    id: 'pdf-preview-stability-qa',
    title: 'PDF Preview 안정성 QA',
    diseaseType: 'cancer',
    description: '',
    consultationDate: '2026-09-26',
    customerNameSnapshot: '김민수',
    items,
    createdAt: now,
    updatedAt: now,
  }
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector(
      '[data-testid="coverage-pdf-preview-viewport"]',
    )
    const source = document.querySelector(
      '[data-testid="coverage-pdf-print-source"]',
    )
    const sourceRect = source?.getBoundingClientRect()
    const sourceIntersectsViewport = sourceRect
      ? sourceRect.right > 0 &&
        sourceRect.bottom > 0 &&
        sourceRect.left < window.innerWidth &&
        sourceRect.top < window.innerHeight
      : false
    return {
      fitScale: Number(viewport?.getAttribute('data-fit-scale') ?? '0'),
      zoom: Number(viewport?.getAttribute('data-zoom') ?? '0'),
      renderCount: Number(viewport?.getAttribute('data-render-count') ?? '0'),
      resizeCallbackCount: Number(
        viewport?.getAttribute('data-resize-callback-count') ?? '0',
      ),
      scrollLeft: viewport?.scrollLeft ?? 0,
      scrollTop: viewport?.scrollTop ?? 0,
      visibleDocumentCount: document.querySelectorAll(
        '[data-testid="coverage-pdf-preview-visible-document"]',
      ).length,
      printSourceCount: document.querySelectorAll(
        '[data-testid="coverage-pdf-print-source"]',
      ).length,
      printRootCount: document.querySelectorAll(
        '[data-testid="coverage-simulator-print-root"]',
      ).length,
      sourceIntersectsViewport,
      viewportWidth: viewport?.clientWidth ?? 0,
      viewportScrollWidth: viewport?.scrollWidth ?? 0,
      viewportScrollHeight: viewport?.scrollHeight ?? 0,
    }
  })
}

async function dispatchPinch(page, startDistance, endDistance) {
  await page.evaluate(({ startDistance, endDistance }) => {
    const target = document.querySelector(
      '[data-testid="coverage-pdf-preview-viewport"]',
    )
    if (!(target instanceof HTMLElement)) throw new Error('missing preview viewport')
    const rect = target.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + Math.min(rect.height / 2, 240)
    const createTouch = (identifier, x) => new Touch({
      identifier,
      target,
      clientX: x,
      clientY: centerY,
      pageX: x,
      pageY: centerY,
      screenX: x,
      screenY: centerY,
      radiusX: 2,
      radiusY: 2,
      rotationAngle: 0,
      force: 1,
    })
    const pair = (distance) => [
      createTouch(1, centerX - distance / 2),
      createTouch(2, centerX + distance / 2),
    ]
    target.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: pair(startDistance),
      targetTouches: pair(startDistance),
      changedTouches: pair(startDistance),
    }))
    target.dispatchEvent(new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: pair(endDistance),
      targetTouches: pair(endDistance),
      changedTouches: pair(endDistance),
    }))
    target.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: pair(endDistance),
    }))
  }, { startDistance, endDistance })
  await page.waitForTimeout(300)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.goto(MOBILE, { waitUntil: 'domcontentloaded' })
  const scenario = buildScenario()
  await page.evaluate(
    ({ key, scenario }) => localStorage.setItem(key, JSON.stringify([scenario])),
    { key: STORAGE_KEY, scenario },
  )
  await page.goto(`${MOBILE}/scenarios/${scenario.id}/pdf`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForSelector('[data-testid="coverage-pdf-preview-viewport"]')
  await page.waitForTimeout(300)

  const idleStart = await readMetrics(page)
  const samples = []
  for (let index = 0; index < 50; index += 1) {
    samples.push(await readMetrics(page))
    await page.waitForTimeout(100)
  }
  const idleEnd = await readMetrics(page)

  await dispatchPinch(page, 100, 220)
  const afterPinch = await readMetrics(page)
  const viewport = page.locator('[data-testid="coverage-pdf-preview-viewport"]')
  const box = await viewport.boundingBox()
  if (!box) throw new Error('missing preview viewport bounds')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2 - 90,
    box.y + box.height / 2,
    { steps: 5 },
  )
  await page.mouse.up()
  const afterHorizontalPan = await readMetrics(page)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2 - 90,
    { steps: 5 },
  )
  await page.mouse.up()
  await page.waitForTimeout(200)
  const afterPan = await readMetrics(page)

  await dispatchPinch(page, 220, 80)
  const afterZoomOut = await readMetrics(page)

  const fitScales = [...new Set(samples.map((sample) => sample.fitScale))]
  const zoomValues = [...new Set(samples.map((sample) => sample.zoom))]
  const failures = []
  if (idleEnd.visibleDocumentCount !== 1) failures.push('visible-document-count')
  if (idleEnd.printSourceCount > 1) failures.push('print-source-count')
  if (idleEnd.sourceIntersectsViewport) failures.push('print-source-intersection')
  if (fitScales.length !== 1) failures.push('fit-scale-jitter')
  if (zoomValues.length !== 1 || zoomValues[0] !== 1) failures.push('idle-zoom')
  if (idleEnd.resizeCallbackCount - idleStart.resizeCallbackCount > 2) {
    failures.push('resize-observer-loop')
  }
  if (afterPinch.zoom <= 1) failures.push('pinch-zoom')
  if (afterHorizontalPan.scrollLeft === afterPinch.scrollLeft) failures.push('horizontal-pan')
  if (afterPan.scrollTop === afterHorizontalPan.scrollTop) failures.push('vertical-pan')
  if (Math.abs(afterZoomOut.zoom - 1) >= 0.001) failures.push('zoom-out')

  await page.screenshot({
    path: join(outDir, 'pdf-preview-stability-mobile-390.png'),
    fullPage: true,
  })
  const result = {
    idleStart,
    idleEnd,
    fitScales,
    zoomValues,
    afterPinch,
    afterHorizontalPan,
    afterPan,
    afterZoomOut,
    failures,
  }
  await writeFile(
    join(outDir, 'pdf-preview-stability-results.json'),
    JSON.stringify(result, null, 2),
  )
  await browser.close()
  if (failures.length > 0) {
    console.error('[FAIL] coverageSimulatorPdfPreviewStabilityQa', result)
    process.exit(1)
  }
  console.log('[PASS] coverageSimulatorPdfPreviewStabilityQa', result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
