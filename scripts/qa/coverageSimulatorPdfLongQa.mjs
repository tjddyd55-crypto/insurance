/**
 * Long-scenario PDF page-break QA (login + localStorage seed + jsPDF download).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:3000'
const USER = process.env.COVERAGE_SIM_USER || 'tjddyd55'
const PASS = process.env.COVERAGE_SIM_PASS || 'QaBizFire20260910!'
const outDir = join(process.cwd(), 'store-screenshots', 'coverage-simulator')

const MAN = 10_000

function coverage(label, category, order) {
  return {
    id: crypto.randomUUID(),
    type: 'coverage',
    category,
    label,
    currentAmount: 200 * MAN,
    proposedAmount: 800 * MAN,
    order,
  }
}

function marker(label, order) {
  return { id: crypto.randomUUID(), type: 'time-marker', label, order }
}

function buildLongScenario() {
  const now = new Date().toISOString()
  const labels = [
    ['암 진단금', 'diagnosis'],
    ['암 수술비', 'treatment'],
    ['항암약물치료', 'treatment'],
    ['방사선치료', 'treatment'],
    ['간병비', 'support'],
    ['입원일당', 'treatment'],
    ['생활비', 'support'],
    ['재치료 항암', 'treatment'],
    ['재수술', 'treatment'],
    ['재활', 'recovery'],
    ['표적항암', 'treatment'],
    ['면역항암', 'treatment'],
  ]
  const items = []
  let order = 0
  for (const [label, category] of labels) {
    items.push(coverage(label, category, order))
    order += 1
    if (label === '생활비') {
      items.push(marker('6개월 후', order))
      order += 1
    }
    if (label === '재치료 항암') {
      items.push(marker('1년 후', order))
      order += 1
    }
  }
  return {
    id: crypto.randomUUID(),
    title: '암 치료 시나리오 (QA Long)',
    diseaseType: 'cancer',
    description: 'Visual QA long PDF page-break sample',
    consultationDate: now.slice(0, 10),
    customerName: 'QA 고객',
    items,
    createdAt: now,
    updatedAt: now,
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await login(page)

  const userKey = await page.evaluate(() => {
    const raw = window.localStorage.getItem('insurance.auth.session')
    if (!raw) throw new Error('missing insurance.auth.session')
    const parsed = JSON.parse(raw)
    const id = parsed?.user?.id
    if (!id) throw new Error('missing user id in auth session')
    return String(id)
  })

  const scenario = buildLongScenario()
  await page.evaluate(
    ({ seed, userKey }) => {
      const key = `onefc:coverage-simulator:v1:${userKey}`
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]')
      const next = [seed, ...existing.filter((row) => row.id !== seed.id)]
      localStorage.setItem(key, JSON.stringify(next))
    },
    { seed: scenario, userKey },
  )

  await page.goto(`${BASE}/coverage-simulator/scenarios/${scenario.id}/pdf`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForSelector('.coverage-simulator-print-root', { timeout: 30000 })
  await page.screenshot({
    path: join(outDir, 'coverage-simulator-pdf-long-preview.png'),
    fullPage: true,
  })

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
  await page.getByRole('button', { name: 'PDF 저장' }).click()
  const download = await downloadPromise
  const pdfPath = join(outDir, 'coverage-simulator-generated-long.pdf')
  await download.saveAs(pdfPath)

  const bytes = await import('node:fs/promises').then((fs) => fs.readFile(pdfPath))
  const doc = await PDFDocument.load(bytes)
  const pageCount = doc.getPageCount()

  await browser.close()
  const log = [
    `scenarioId=${scenario.id}`,
    `items=${scenario.items.length}`,
    `jspdfPages=${pageCount}`,
    pdfPath,
  ]
  await writeFile(join(outDir, 'pdf-long-qa-log.txt'), log.join('\n'), 'utf8')
  console.log(`[coverageSimulatorPdfLongQa] ${log.join(' | ')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
