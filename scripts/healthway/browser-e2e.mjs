// Optional repeatable browser validation. Requires Playwright; screenshots stay outside the repo.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.HEALTHWAY_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.HEALTHWAY_E2E_BASE_URL, username = process.env.HEALTHWAY_E2E_USERNAME, password = process.env.HEALTHWAY_E2E_PASSWORD
if (!base || !username || !password) throw new Error('E2E base URL and credentials required')
const artifacts = process.env.HEALTHWAY_E2E_ARTIFACTS || '/tmp/healthway-e2e-artifacts'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.HEALTHWAY_CHROME_PATH || undefined, headless: true, args: ['--no-sandbox'] })
let stage = 'login', checks = 0
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }), page = await context.newPage()
  await page.goto(new URL('/login', base).href)
  await page.getByLabel('아이디', { exact: true }).fill(username)
  await page.getByLabel('비밀번호', { exact: true }).fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('insurance.auth.session')))
  assert.ok(session.token); checks++
  const customersResponse = await page.request.get(new URL('/backend/customers', base).href, { headers: { Authorization: `Bearer ${session.token}` } })
  const customers = await customersResponse.json(), rows = Array.isArray(customers) ? customers : customers.data || customers.customers
  const customerId = process.env.HEALTHWAY_E2E_CUSTOMER_ID || rows[0].id
  stage = 'FC healthway page'
  await page.goto(new URL(`/customers/${customerId}/healthway`, base).href)
  await page.locator('.healthway-page h2').filter({ hasText: /^건강정보$/ }).waitFor()
  await page.getByText('공식 조회 가능 기간', { exact: false }).first().waitFor(); checks++
  stage = 'request creation'
  await page.locator('.hw-request summary').click()
  await page.getByLabel('의료기관 진단·수술 (확장)', { exact: true }).check()
  await page.getByRole('button', { name: '요청 생성', exact: true }).click()
  const link = page.getByRole('link', { name: '고객 테스트 링크 열기' }); await link.waitFor(); const publicUrl = await link.getAttribute('href'); checks++
  const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), customer = await publicContext.newPage()
  stage = 'public consents'
  await customer.goto(publicUrl); await customer.getByRole('heading', { name: '약관 및 안내' }).waitFor()
  await customer.getByLabel('필수 이용약관 및 개인정보 처리 안내를 확인하고 테스트에 동의합니다.').check()
  await customer.getByLabel('국민건강보험공단 · 건강검진 / 진료이력', { exact: true }).check()
  await customer.getByLabel('심사평가원 · 투약이력', { exact: true }).check()
  await customer.getByLabel('의료기관 진단 / 수술·처치 데이터 (공식 샘플)', { exact: true }).check()
  await customer.screenshot({ path: `${artifacts}/public-mobile.png`, fullPage: true }); checks++
  stage = 'mock auth and SDK query'
  await customer.getByRole('button', { name: '동의하고 MOCK 인증 시작' }).click()
  await customer.getByRole('heading', { name: 'DEV 전용 MOCK 본인인증' }).waitFor()
  await customer.getByRole('button', { name: 'MOCK 인증·전송요구 완료' }).click()
  await customer.getByRole('heading', { name: '테스트 연결 완료' }).waitFor({ timeout: 90000 }); checks++
  stage = 'source tabs and evidence'
  await page.locator('.hw-request summary').click() // Keep bearer-link text out of screenshots.
  // Refresh before collapsing the request panel.
  await page.evaluate(() => { document.querySelector('.hw-request').open = true })
  await page.getByRole('button', { name: '상태 새로고침' }).click()
  await page.evaluate(() => { document.querySelector('.hw-request').open = false })
  await page.getByRole('button', { name: '심사평가원', exact: true }).click()
  await page.locator('.hw-card').filter({ hasText: '조제일' }).first().waitFor(); assert.equal(await page.locator('.hw-card').filter({ hasText: '조제일' }).count(), 24); checks++
  await page.getByRole('button', { name: '고지의무 확인', exact: true }).click()
  const evidenceButton = page.getByRole('button', { name: '근거 보기' }).and(page.locator('button:not([disabled])')).first()
  await evidenceButton.click(); await page.getByRole('dialog', { name: '고지 확인 후보 근거' }).waitFor()
  assert.ok(await page.locator('.hw-evidence-row').count()); await page.screenshot({ path: `${artifacts}/evidence.png`, fullPage: true })
  await page.getByRole('button', { name: '닫기', exact: true }).click(); checks++
  await page.evaluate(() => { document.querySelector('.hw-request').open = false })
  stage = 'desktop widths'
  await page.getByRole('button', { name: '국민건강보험공단', exact: true }).click()
  for (const width of [1920, 1280, 1024]) {
    await page.setViewportSize({ width, height: 1080 })
    const bounds = await page.locator('.healthway-page--pc').boundingBox(); assert.ok(bounds && bounds.width > 0)
    await page.locator('.healthway-page--pc').evaluate((e) => { for (let p = e.parentElement; p; p = p.parentElement) p.scrollTop = 0 })
    await page.screenshot({ path: `${artifacts}/fc-${width}.png`, fullPage: true }); checks++
  }
  stage = 'mobile FC'
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await mobileContext.addInitScript((value) => localStorage.setItem('insurance.auth.session', value), JSON.stringify(session))
  const mobile = await mobileContext.newPage(); await mobile.goto(new URL(`/customers/${customerId}/healthway`, base).href)
  await mobile.locator('.healthway-page--mobile .hw-segments').waitFor(); await mobile.screenshot({ path: `${artifacts}/fc-mobile.png`, fullPage: true }); checks++
  stage = 'mobile unsaved-request guard'
  await mobile.locator('.hw-request summary').click()
  await mobile.getByLabel('의료기관 진단·수술 (확장)', { exact: true }).check()
  await mobile.keyboard.press('Escape'); assert.ok(await mobile.locator('.healthway-page--mobile').isVisible()); checks++
  await mobile.getByRole('button', { name: '닫기', exact: true }).click()
  const unsaved = mobile.getByRole('dialog', { name: '요청 설정 변경' }); await unsaved.waitFor()
  await unsaved.getByRole('button', { name: '취소', exact: true }).click()
  assert.ok(await mobile.locator('.healthway-page--mobile').isVisible()); checks++
  console.log(`OFFLINE browser E2E passed: ${checks} checks; PC 1920/1280/1024 + mobile 390; source tabs/evidence/public flow.`)
} catch {
  console.error(`OFFLINE browser E2E failed at ${stage}; credentials, URLs and health payloads withheld.`); process.exitCode = 1
} finally { await browser.close() }
