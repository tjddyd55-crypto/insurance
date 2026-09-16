import { chromium } from '../qa/node_modules/playwright/index.mjs'

const WEB = 'http://127.0.0.1:3000'
const USER = 'tjddyd55'
const PASS = 'QaBizFire20260910!'
const CID = 1342

async function login(page) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('form.auth-form')
  await page.locator('.field').filter({ hasText: '아이디' }).locator('input').fill(USER)
  await page.locator('.field').filter({ hasText: '비밀번호' }).locator('input').fill(PASS)
  await page.locator('button').filter({ hasText: '로그인' }).click()
  await page.waitForFunction(() => !location.pathname.includes('/login'))
}

async function openEdit(page) {
  await page.goto(`${WEB}/customers?customerId=${CID}`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('이름 / 전화번호 검색').fill('고객사업자화재QA')
  await page.waitForTimeout(1000)
  await page.locator('#customer-1342, [data-customer-id="1342"]').first().click({ position: { x: 30, y: 25 } })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '수정' }).first().click({ force: true })
  await page.waitForSelector('button:has-text("주소 검색")', { timeout: 30000 })
}

async function assertPostcodeOpens(page, label) {
  const buttons = page.getByRole('button', { name: '주소 검색' })
  const count = await buttons.count()
  let opened = false
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click()
    await page.waitForTimeout(1200)
    const hasWidget = await page.locator('.address-search-field__embed iframe, [id^="__kakao__layer"]').count()
    const hasError = await page.locator('.address-search-field__error').count()
    if (hasWidget > 0) {
      opened = true
      await page.getByRole('button', { name: '닫기' }).first().click()
      await page.waitForTimeout(400)
      break
    }
    if (hasError > 0) {
      const text = await page.locator('.address-search-field__error').first().innerText()
      throw new Error(`${label}: load error — ${text}`)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  if (!opened) throw new Error(`${label}: postcode widget did not open`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const report = { basic: false, business: false, fire: false, repeat: false }

  try {
    await login(page)
    await openEdit(page)

    await assertPostcodeOpens(page, 'basic')
    report.basic = true

    await page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).getByRole('button', { name: '주소 검색' }).click()
    await page.waitForTimeout(1200)
    if (await page.locator('.address-search-field__embed iframe, [id^="__kakao__layer"]').count()) {
      report.business = true
      await page.getByRole('button', { name: '닫기' }).first().click()
    }

    const fireSection = page.locator('.customer-form-section').filter({ hasText: '화재보험 정보' }).first()
    await fireSection.scrollIntoViewIfNeeded()
    await fireSection.getByRole('button', { name: '주소 검색' }).first().click()
    await page.waitForTimeout(1200)
    if (await page.locator('.address-search-field__embed iframe, [id^="__kakao__layer"]').count()) {
      report.fire = true
      await page.getByRole('button', { name: '닫기' }).first().click()
    }

    await page.getByRole('button', { name: '주소 검색' }).first().click()
    await page.waitForTimeout(1200)
    report.repeat = (await page.locator('.address-search-field__embed iframe, [id^="__kakao__layer"]').count()) > 0

    console.log(JSON.stringify({ verdict: 'KAKAO_POSTCODE_WEB_FIX_COMPLETE', report }, null, 2))
    if (!report.basic || !report.business || !report.fire || !report.repeat) process.exit(1)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ verdict: 'KAKAO_POSTCODE_WEB_FIX_BLOCKED', error: String(e) }, null, 2))
  process.exit(1)
})
