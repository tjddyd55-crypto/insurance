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
const STORAGE_KEY = 'coverage-simulator-preview-mobile:consultations:v1'
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
    coverage('암 진단', 'diagnosis', 0, 3000, 5000),
    coverage('암 수술', 'treatment', 1, 300, 1000),
    coverage('항암', 'treatment', 2, 500, 2000),
    coverage('방사선', 'treatment', 3, 300, 1000),
    marker('1년 후', 4),
    coverage('표적항암', 'treatment', 5, 0, 2000),
    coverage('입원비', 'treatment', 6, 100, 500),
    marker('6개월 후', 7),
    coverage('간병', 'support', 8, 0, 1000),
  ]
  for (let i = 0; i < extraItems; i += 1) {
    items.push(coverage(`추가 항목 ${i + 1}`, 'other', 9 + i, 100 + i, 200 + i))
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

async function runScenario(page, scenario, tag) {
  await page.evaluate(
    ({ key, seed }) => {
      const rows = JSON.parse(localStorage.getItem(key) ?? '[]')
      const next = [seed, ...rows.filter((row) => row.id !== seed.id)]
      localStorage.setItem(key, JSON.stringify(next))
    },
    { key: STORAGE_KEY, seed: scenario },
  )

  await page.goto(`${MOBILE}/scenarios/${scenario.id}/pdf`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('[data-testid="coverage-simulator-print-root"]', { timeout: 60000 })

  const checks = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="coverage-simulator-print-root"]')
    const grand = document.querySelector('[data-testid="coverage-print-grand-total"]')
    const subtotals = document.querySelectorAll('[data-testid="coverage-period-subtotal"]').length
    const markers = document.querySelectorAll('[data-testid="coverage-print-marker"]').length
    const firstAmount = document.querySelector('.cs-print-item__amount--proposed')?.textContent?.trim() ?? ''
    const grandProposed = document.querySelector('.cs-print-grand-total__value--proposed')?.textContent?.trim() ?? ''
    return { root: Boolean(root), grand: Boolean(grand), subtotals, markers, firstAmount, grandProposed }
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(outDir, `pdf-preview-${tag}-390.png`), fullPage: true })

  page.on('pageerror', (err) => console.error('[pageerror]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console]', msg.text())
  })
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.getByRole('button', { name: 'PDF 저장' }).click(),
  ])
  const pdfPath = join(outDir, `coverage-simulator-${tag}.pdf`)
  await download.saveAs(pdfPath)

  const bytes = await import('node:fs/promises').then((fs) => fs.readFile(pdfPath))
  const doc = await PDFDocument.load(bytes)
  const pageCount = doc.getPageCount()

  return { checks, pdfPath, pageCount }
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

  const version = await fetch(`${BASE}/version.json`).then((r) => r.json())
  const results = []

  await page.goto(MOBILE, { waitUntil: 'domcontentloaded' })
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)

  const onePage = await runScenario(page, buildQaScenario(0), 'qa-1p')
  results.push({ id: 'pdf-1p', ...onePage })

  const long = await runScenario(page, buildQaScenario(12), 'qa-long')
  results.push({ id: 'pdf-long', ...long })

  await browser.close()

  const failures = []
  if (!onePage.checks.firstAmount.includes(' 만원')) failures.push('amount-spacing')
  if (!onePage.checks.grandProposed.includes(' 만원')) failures.push('grand-format')
  if (onePage.checks.subtotals < 2) failures.push('subtotals')
  if (onePage.checks.markers < 2) failures.push('markers')
  if (onePage.pageCount < 1) failures.push('pdf-empty')
  if (long.pageCount < 2) failures.push('long-multipage')

  await writeFile(join(outDir, 'pdf-final-qa-results.json'), JSON.stringify({ version, results, failures }, null, 2))

  if (failures.length) {
    console.error('[FAIL]', failures)
    process.exit(1)
  }
  console.log('[PASS] coverageSimulatorPdfFinalQa', { version: version.gitCommitSha, longPages: long.pageCount })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
