/**
 * DEV UI QA: CRM coverage simulator server storage (two isolated contexts).
 *
 *   node scripts/qa/coverageSimulatorServerStorageUiQa.mjs https://insurance-dev.up.railway.app
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USERNAME = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASSWORD = process.env.COVERAGE_BINDER_QA_PASS
const OUT = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'dev-qa-server-storage-ui')

const results = []
const stamp = Date.now()
const QA_TITLE = `QA 서버저장 UI ${stamp}`

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
  await page.locator('input[name="username"], input[autocomplete="username"]').first().fill(USERNAME)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.getByRole('button', { name: /로그인|login/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 })
}

async function waitHydrate(page) {
  const loading = page.getByText('보장 시뮬레이션 데이터를 불러오는 중')
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: 'hidden', timeout: 120000 })
  }
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS 필요')
  }
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  const contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageA = await contextA.newPage()
  await login(pageA)
  await pageA.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitHydrate(pageA)
  pass('hydrate-a', pageA.url())

  await pageA.getByRole('button', { name: /시나리오 추가/ }).click()
  await pageA.locator('.coverage-simulator-input').first().fill(QA_TITLE)
  await pageA.getByRole('button', { name: '빈 템플릿으로 시작' }).click()
  await pageA.waitForURL(/templates\/\d+\/edit/, { timeout: 60000 })
  const templateUrlA = pageA.url()
  pass('template-create-a', templateUrlA)

  await pageA.goto(`${BASE}/coverage-simulator/cerebrovascular/new`, { waitUntil: 'domcontentloaded' })
  await pageA.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  await pageA.getByRole('button', { name: '저장' }).first().click()
  await pageA.waitForSelector('.coverage-simulator-dialog__input', { timeout: 15000 })
  await pageA.locator('.coverage-simulator-dialog__input').fill(`${QA_TITLE} sim`)
  await pageA.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  await pageA.waitForURL(/scenarios\/\d+/, { timeout: 60000 })
  const simUrlA = pageA.url()
  const simIdA = simUrlA.match(/scenarios\/(\d+)/)?.[1]
  if (simIdA) pass('simulation-save-a', simIdA)
  else fail('simulation-save-a', simUrlA)

  const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageB = await contextB.newPage()
  await login(pageB)
  await pageB.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitHydrate(pageB)
  const bodyB = await pageB.textContent('body')
  if (bodyB?.includes(QA_TITLE)) pass('multi-context-list', 'scenario visible in B')
  else fail('multi-context-list', 'QA title not found')

  await pageB.goto(`${BASE}/coverage-simulator/scenarios/${simIdA}`, { waitUntil: 'domcontentloaded' })
  await pageB.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  pass('multi-context-open-sim', simIdA)

  await pageB.goto(`${BASE}/coverage-simulator-preview/pc`, { waitUntil: 'domcontentloaded' })
  const previewCalls = []
  pageB.on('request', (req) => {
    if (req.url().includes('/api/coverage-simulator/')) previewCalls.push(req.url())
  })
  await pageB.waitForSelector('[data-testid="coverage-simulator-public-pc-root"]', { timeout: 60000 })
  if (previewCalls.length === 0) pass('preview-no-crm-api', 'ok')
  else fail('preview-no-crm-api', previewCalls.join(','))

  await browser.close()
  const summary = { results, pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length }
  await writeFile(join(OUT, 'results.json'), JSON.stringify(summary, null, 2))
  if (summary.fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
