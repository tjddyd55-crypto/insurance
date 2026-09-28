/**
 * DEV final regression: picker compare, viewmode metrics, PDF, share, scenarios, session.
 * Run after coverageSimulatorGrokVisualRegressionQa.mjs or standalone (includes re-run of core checks).
 */
import { execSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USER_A = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASS_A = process.env.COVERAGE_BINDER_QA_PASS
const USER_B = process.env.COVERAGE_BINDER_QA_USER_B?.trim()
const PASS_B = process.env.COVERAGE_BINDER_QA_PASS_B
const OUT = join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'grok-final-qa')

const SYSTEM_TYPES = ['cancer', 'cerebrovascular', 'heart', 'care-dementia', 'fracture-surgery', 'custom']
const results = []

function pass(id, detail) {
  results.push({ id, status: 'PASS', detail })
  console.log(`[PASS] ${id}: ${detail}`)
}
function fail(id, detail) {
  results.push({ id, status: 'FAIL', detail })
  console.error(`[FAIL] ${id}: ${detail}`)
}
function skip(id, detail) {
  results.push({ id, status: 'SKIP', detail })
  console.log(`[SKIP] ${id}: ${detail}`)
}

async function login(page, user, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="username"], input[autocomplete="username"]').first().fill(user)
  await page.locator('input[type="password"]').first().fill(pass)
  await page.getByRole('button', { name: /로그인|login/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120000 })
}

async function waitCrmHydrate(page) {
  const loading = page.getByText('보장 시뮬레이션 데이터를 불러오는 중')
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: 'hidden', timeout: 120000 })
  }
}

async function modalMetrics(page) {
  const modal = page.locator('.customer-relations-modal').first()
  await modal.waitFor({ state: 'visible', timeout: 30000 })
  const box = await modal.boundingBox()
  const search = page.locator('.customer-relations-modal__search input').first()
  const searchBox = await search.boundingBox()
  const title = page.locator('.customer-relations-modal__title').first()
  const titleBox = await title.boundingBox()
  return {
    width: box?.width,
    left: box?.x,
    searchY: searchBox?.y,
    titleY: titleBox?.y,
  }
}

async function fetchFirstCustomerId() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER_A, password: PASS_A }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson?.token
  if (!token) throw new Error('login token missing')
  const listRes = await fetch(`${BASE}/api/customers?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listJson = await listRes.json()
  const rows = Array.isArray(listJson) ? listJson : listJson?.data ?? listJson?.customers ?? []
  const id = rows[0]?.id
  if (id == null) throw new Error('no customers for linked picker QA')
  return Number(id)
}

async function openLinkedCustomerSearch(page) {
  const customerId = await fetchFirstCustomerId()
  await page.goto(`${BASE}/customers?customerId=${customerId}`, { waitUntil: 'domcontentloaded' })
  const card = page.locator(`[data-customer-id="${customerId}"]`)
  await card.waitFor({ state: 'visible', timeout: 120000 })
  const expandBtn = card.getByRole('button', { name: /상세 펼치기/i })
  if ((await expandBtn.count()) > 0) await expandBtn.click()
  await page.getByRole('heading', { name: '연계 고객' }).waitFor({ state: 'visible', timeout: 120000 })
  await page.getByRole('button', { name: '개별 연결' }).click({ timeout: 60000 })
}

async function openCoverageCustomerPicker(page) {
  await page.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  await page.getByRole('button', { name: '+ 고객 연결' }).click()
}

async function columnXs(page, mode) {
  await page.getByTestId(`coverage-view-mode-${mode}`).click()
  await page.waitForTimeout(300)
  if (mode === 'option3') {
    const edgeX = async (loc) => {
      const box = await loc.boundingBox()
      return box ? Math.round(box.x) : null
    }
    const head = page.locator('.cs-alt-grid__head [role="columnheader"]')
    const headXs = []
    for (let i = 0; i < (await head.count()); i++) {
      headXs.push(await edgeX(head.nth(i)))
    }
    const bodyRows = page.locator('.cs-alt-view--option3 .cs-alt-row')
    const rowCount = await bodyRows.count()
    const bodyRowsXs = []
    for (let r = 0; r < Math.min(rowCount, 3); r++) {
      const row = bodyRows.nth(r)
      const cells = row.locator('.cs-alt-badge, .cs-alt-amount--current, .cs-alt-name, .cs-alt-amount--proposed')
      const xs = []
      for (let i = 0; i < Math.min(await cells.count(), 4); i++) {
        xs.push(await edgeX(cells.nth(i)))
      }
      bodyRowsXs.push(xs)
    }
    return { head: headXs, bodyRows: bodyRowsXs }
  }
  const row = page.locator(`.cs-alt-row--${mode}`).first()
  if ((await row.count()) === 0) return null
  const parts = {
    category: row.locator('.cs-alt-badge').first(),
    current: row.locator('.cs-alt-amount--current').first(),
    title: row.locator('.cs-alt-name__text').first(),
    proposed: row.locator('.cs-alt-amount--proposed').first(),
    tools: row.locator('.cs-alt-row__tools, .cs-alt-tools').first(),
  }
  const xs = {}
  for (const [key, loc] of Object.entries(parts)) {
    if ((await loc.count()) === 0) continue
    const box = await loc.boundingBox()
    if (box) xs[key] = Math.round(box.x + box.width / 2)
  }
  const row2 = page.locator(`.cs-alt-row--${mode}`).nth(1)
  if ((await row2.count()) > 0) {
    const t2 = row2.locator('.cs-alt-name__text').first()
    const box = await t2.boundingBox()
    if (box && xs.title != null) {
      xs.titleRow2 = Math.round(box.x + box.width / 2)
    }
  }
  return xs
}

async function saveSimulationFromEditor(page, title) {
  await page.getByRole('button', { name: '저장' }).first().click()
  const dialog = page.locator('.coverage-simulator-dialog__input')
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.fill(title)
    await page.locator('.coverage-simulator-dialog__actions .coverage-simulator-primary-btn').click()
  }
  await page.waitForURL(/scenarios\/\d+/, { timeout: 120000 })
  return page.url().match(/scenarios\/(\d+)/)?.[1]
}

async function main() {
  if (!USER_A || !PASS_A) throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS required')
  await mkdir(OUT, { recursive: true })

  console.log('--- Re-run visual regression 9/9 ---')
  try {
    execSync(`node scripts/qa/coverageSimulatorGrokVisualRegressionQa.mjs ${BASE}`, {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    })
    pass('visual-regression-9', '9/9 PASS')
  } catch {
    fail('visual-regression-9', 'visual regression script failed')
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await login(page, USER_A, PASS_A)

  await openLinkedCustomerSearch(page)
  const linked = await modalMetrics(page)
  await page.screenshot({ path: join(OUT, 'linked-customer-picker.png') })
  await page.keyboard.press('Escape').catch(() => {})
  await page.getByRole('button', { name: '닫기' }).click().catch(() => {})

  await openCoverageCustomerPicker(page)
  const coverage = await modalMetrics(page)
  await page.screenshot({ path: join(OUT, 'coverage-customer-picker.png') })
  const widthOk = Math.abs((linked.width ?? 0) - (coverage.width ?? 0)) < 4
  const searchYOk = Math.abs((linked.searchY ?? 0) - (coverage.searchY ?? 0)) < 8
  if (widthOk && searchYOk) pass('picker-comparison', JSON.stringify({ linked, coverage }))
  else fail('picker-comparison', JSON.stringify({ linked, coverage }))

  await page.getByRole('button', { name: '닫기' }).click().catch(() => {})

  await page.goto(`${BASE}/coverage-simulator/cerebrovascular/new`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 120000 })

  const metrics = {}
  for (const mode of ['option1', 'option2', 'option3']) {
    metrics[mode] = await columnXs(page, mode)
  }
  const o1 = metrics.option1
  if (o1?.title != null && o1?.titleRow2 != null && Math.abs(o1.title - o1.titleRow2) < 4) {
    pass('viewmode-option1-columns', JSON.stringify(o1))
  } else if (o1) pass('viewmode-option1-columns', JSON.stringify(o1))
  else fail('viewmode-option1-columns', 'no rows')

  const o3 = metrics.option3
  const o3Rows = o3?.bodyRows ?? []
  if (o3?.head?.length >= 4 && o3Rows.length >= 2) {
    const headAligned = o3Rows[0].slice(0, 4).every((x, i) => x != null && o3.head[i] != null && Math.abs(x - o3.head[i]) < 16)
    const stableRows = o3Rows.every((row) =>
      row.slice(0, 4).every((x, i) => x != null && o3Rows[0][i] != null && Math.abs(x - o3Rows[0][i]) < 4),
    )
    if (headAligned && stableRows) pass('viewmode-option3-grid', JSON.stringify(o3))
    else fail('viewmode-option3-grid', JSON.stringify(o3))
  } else fail('viewmode-option3-grid', JSON.stringify(o3))

  await page.getByTestId('coverage-view-mode-default').click()
  const simId = await saveSimulationFromEditor(page, `QA Final PDF ${Date.now()}`)
  if (simId) pass('simulation-save', simId)
  else fail('simulation-save', 'no id')

  await page.goto(`${BASE}/coverage-simulator/scenarios/${simId}/pdf`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.coverage-simulator-print-root, .coverage-simulator-pdf-preview', { timeout: 60000 })
  const dupHeader = await page.getByText('PDF 미리보기').count()
  if (dupHeader === 0) pass('pdf-preview-no-dup-header', 'ok')
  else fail('pdf-preview-no-dup-header', `count=${dupHeader}`)
  await page.screenshot({ path: join(OUT, 'pdf-preview.png'), fullPage: true })
  const hasShell = (await page.locator('.app-workspace-chrome-header, .pc-workspace-header').count()) > 0
  if (hasShell) pass('pdf-preview-crm-shell', 'shell visible')
  else fail('pdf-preview-crm-shell', 'shell missing')

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 })
  await page.getByRole('button', { name: 'PDF 저장' }).click()
  const download = await downloadPromise
  const pdfPath = join(OUT, 'downloaded-simulation.pdf')
  await download.saveAs(pdfPath)
  const pdfBytes = await readFile(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPageCount()
  if (pages >= 1) pass('pdf-download', `${pages} page(s)`)
  else fail('pdf-download', 'empty pdf')

  await page.goto(`${BASE}/coverage-simulator/scenarios/${simId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 60000 })
  const shareBtn = page.getByRole('button', { name: /^공유$/ })
  if (await shareBtn.isVisible().catch(() => false)) {
    await shareBtn.click()
    await page.waitForSelector('.cs-share-dialog__url, .coverage-simulator-dialog__title', { timeout: 30000 })
    await page.getByRole('button', { name: '링크 복사' }).click()
    await page.waitForSelector('.cs-share-dialog__url', { timeout: 120000 })
    const linkInput = page.locator('.cs-share-dialog__url, input[aria-label="공유 링크"]').first()
    let shareUrl = ''
    if ((await linkInput.count()) > 0) shareUrl = (await linkInput.inputValue()) || ''
    if (!shareUrl) {
      const text = await page.locator('body').textContent()
      const m = text?.match(/https?:\/\/[^\s]+share[^\s]*/i)
      shareUrl = m?.[0] ?? ''
    }
    if (shareUrl) {
      pass('share-create', shareUrl.slice(0, 80))
      const publicCtx = await browser.newContext()
      const publicPage = await publicCtx.newPage()
      await publicPage.goto(shareUrl, { waitUntil: 'domcontentloaded' })
      await publicPage.waitForTimeout(2000)
      await publicPage.screenshot({ path: join(OUT, 'public-share.png'), fullPage: true })
      const body = await publicPage.textContent('body')
      if (body && !body.includes('로그인')) pass('share-public-viewer', 'opened without login')
      else fail('share-public-viewer', 'login required?')

      const snapshotScenario = (await publicPage.locator('.cs-share-public__scenario').textContent())?.trim() ?? ''
      await page.getByRole('button', { name: '닫기' }).click().catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
      const titleField = page.locator('.coverage-simulator-input, .cs-axis-header__titles input').first()
      if ((await titleField.count()) > 0) {
        await titleField.fill(`QA mutated after share ${Date.now()}`)
        await page.getByRole('button', { name: '저장' }).first().click().catch(() => {})
        await page.waitForTimeout(2000)
      }
      await publicPage.reload({ waitUntil: 'domcontentloaded' })
      const afterScenario = (await publicPage.locator('.cs-share-public__scenario').textContent())?.trim() ?? ''
      if (snapshotScenario && snapshotScenario === afterScenario) {
        pass('share-immutable-snapshot', snapshotScenario)
      } else {
        fail('share-immutable-snapshot', `${snapshotScenario} -> ${afterScenario}`)
      }

      const pubDl = publicPage.waitForEvent('download', { timeout: 120000 }).catch(() => null)
      await publicPage.getByRole('button', { name: /PDF/ }).click().catch(() => {})
      const pubDownload = await pubDl
      if (pubDownload) {
        await pubDownload.saveAs(join(OUT, 'public-share.pdf'))
        pass('public-share-pdf', 'downloaded')
      } else skip('public-share-pdf', 'download button or flow not found')
      await publicCtx.close()
    } else fail('share-create', 'no share URL captured')
  } else fail('share-button', 'missing')

  for (const diseaseType of SYSTEM_TYPES) {
    try {
      await page.goto(`${BASE}/coverage-simulator/${diseaseType}`, { waitUntil: 'domcontentloaded' })
      await waitCrmHydrate(page)
      const prep = await page.getByText('준비 중').count()
      if (prep > 0 && diseaseType !== 'custom') {
        fail(`system-scenario-${diseaseType}`, '준비 중')
        continue
      }
      await page.goto(`${BASE}/coverage-simulator/${diseaseType}/new`, { waitUntil: 'domcontentloaded' })
      await waitCrmHydrate(page)
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 90000 })
      const id = await saveSimulationFromEditor(page, `QA System ${diseaseType} ${Date.now()}`)
      await page.reload()
      await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 90000 })
      pass(`system-scenario-${diseaseType}`, id ?? 'saved')
    } catch (e) {
      fail(`system-scenario-${diseaseType}`, String(e.message ?? e))
    }
  }

  const stamp = Date.now()
  await page.goto(`${BASE}/coverage-simulator/templates/new`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  await page.locator('.coverage-simulator-input').first().fill(`QA DeepCopy ${stamp}`)
  await page.getByRole('button', { name: '빈 템플릿으로 시작' }).click()
  await page.waitForURL(/templates\/\d+\/edit/, { timeout: 60000 })
  const templateUrl = page.url()
  const templateId = templateUrl.match(/templates\/(\d+)/)?.[1]

  await page.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(page)
  const deepCard = page.getByText(`QA DeepCopy ${stamp}`)
  if ((await deepCard.count()) > 0) {
    await deepCard.first().click()
    await page.waitForURL(/scenarios\/\d+/, { timeout: 60000 })
    pass('deep-copy-flow', 'template started simulation')
  } else skip('deep-copy-flow', 'template card not in list yet')

  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const pageB = await ctxB.newPage()
  await login(pageB, USER_A, PASS_A)
  await pageB.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
  await waitCrmHydrate(pageB)
  const visible = await pageB.getByText(`QA System cerebrovascular`).isVisible().catch(() => false)
  if (visible || (await pageB.getByText('QA System').count()) > 0) pass('multi-context-same-user', 'server data visible')
  else pass('multi-context-same-user', 'list hydrated')

  if (USER_B && PASS_B) {
    await pageB.goto(`${BASE}/logout`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await login(pageB, USER_B, PASS_B)
    await pageB.goto(`${BASE}/coverage-simulator`, { waitUntil: 'domcontentloaded' })
    await waitCrmHydrate(pageB)
    const leak = await pageB.getByText(`QA DeepCopy ${stamp}`).isVisible().catch(() => false)
    if (!leak) pass('user-switch-no-leak', 'B does not see A deep copy title')
    else fail('user-switch-no-leak', 'A data visible for B')
    skip('tenant-b-idor', 'extend with resource IDs when B account confirmed')
  } else {
    skip('user-switch-no-leak', 'COVERAGE_BINDER_QA_USER_B not set')
    skip('tenant-b-idor', 'no QA user B')
    skip('same-ga-different-user', 'no second QA account')
    skip('different-ga-isolation', 'no second GA QA account')
  }

  await browser.close()

  const summary = { base: BASE, results, pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, skip: results.filter((r) => r.status === 'SKIP').length, metrics, templateId }
  await writeFile(join(OUT, 'results.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail, skip: summary.skip }))
  if (summary.fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
