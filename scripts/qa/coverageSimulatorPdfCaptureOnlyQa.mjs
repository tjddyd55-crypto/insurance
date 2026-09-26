import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const MOBILE = `${BASE}/coverage-simulator-preview/mobile`
const STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'pdf')

function buildScenario() {
  const now = new Date().toISOString()
  return {
    id: 'pdf-capture-badge-qa',
    title: '김민수 암 치료 1차 상담',
    diseaseType: 'cancer',
    description: 'badge QA',
    consultationDate: '2026-09-25',
    customerNameSnapshot: '김민수',
    items: [
      {
        id: 'b1',
        type: 'coverage',
        category: 'diagnosis',
        label: '암 진단금',
        currentAmount: 30_000_000,
        proposedAmount: 50_000_000,
        order: 0,
      },
      {
        id: 'b2',
        type: 'coverage',
        category: 'treatment',
        label: '암 수술비',
        currentAmount: 3_000_000,
        proposedAmount: 10_000_000,
        order: 1,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const scenario = buildScenario()
  await page.goto(MOBILE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ({ key, seed }) => localStorage.setItem(key, JSON.stringify([seed])),
    { key: STORAGE_KEY, seed: scenario },
  )
  await page.goto(`${MOBILE}/scenarios/${scenario.id}/pdf?coveragePdfDebug=1`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'PDF 저장' }).click()
  await page.waitForFunction(() => Boolean(window.__coveragePdfDebugCapture), null, {
    timeout: 60000,
  })
  const debugCapture = await page.evaluate(() => window.__coveragePdfDebugCapture)
  const badgeMetrics = await page.evaluate(() => {
    const root = document.querySelector(
      '.coverage-simulator-pdf-print-source [data-testid="coverage-simulator-print-root"]',
    )
    return Array.from(root?.querySelectorAll('.coverage-simulator-badge') ?? []).map((badge) => {
      const glyph = badge.querySelector('.coverage-simulator-badge__glyph')
      const box = badge.getBoundingClientRect()
      const glyphBox = glyph?.getBoundingClientRect()
      if (!glyphBox) return null
      return {
        label: glyph.textContent?.trim(),
        topGap: glyphBox.top - box.top,
        bottomGap: box.bottom - glyphBox.bottom,
        glyphTransform: glyph ? getComputedStyle(glyph).transform : '',
      }
    }).filter(Boolean)
  })
  await writeFile(
    join(outDir, 'capture-badge-optical-qa.png'),
    Buffer.from(debugCapture.pngDataUrl.split(',')[1], 'base64'),
  )
  await writeFile(
    join(outDir, 'badge-optical-metrics.json'),
    JSON.stringify({ badgeMetrics, diagnostics: debugCapture.diagnostics }, null, 2),
  )
  await page.screenshot({
    path: join(outDir, 'pdf-preview-mobile-width-390.png'),
    fullPage: true,
  })
  await browser.close()
  console.log('[PASS] coverageSimulatorPdfCaptureOnlyQa', { badgeMetrics })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
