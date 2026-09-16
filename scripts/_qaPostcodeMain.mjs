import { chromium } from '../qa/node_modules/playwright/index.mjs'

const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000'
const USER = process.env.QA_USER ?? 'tjddyd55'
const PASS = process.env.QA_PASS ?? 'QaBizFire20260910!'
const report = { basic: false, repeat: false, refresh: false, select: false, retryContract: true, errors: [] }

async function login(page) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('.field').filter({ hasText: '아이디' }).locator('input').fill(USER)
  await page.locator('.field').filter({ hasText: '비밀번호' }).locator('input').fill(PASS)
  await page.locator('button').filter({ hasText: '로그인' }).click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
}

async function openAnyCustomerEdit(page) {
  await page.goto(`${WEB}/customers`, { waitUntil: 'domcontentloaded' })
  const search = page.locator('input[placeholder*="검색"]').first()
  await search.waitFor({ timeout: 30000 })
  await search.fill('010')
  await page.waitForTimeout(1500)
  const card = page.locator('[data-customer-id], [id^="customer-"]').first()
  await card.waitFor({ timeout: 30000 })
  await card.click({ position: { x: 40, y: 28 } })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: '수정' }).first().click({ force: true })
  await page.waitForSelector('button:has-text("주소 검색")', { timeout: 30000 })
}

async function postcodeState(page) {
  const hasWidget = await page.locator('.address-search-field__embed iframe, [id^="__kakao__layer"]').count()
  const hasError = await page.locator('.address-search-field__error').count()
  if (hasWidget > 0) return 'open'
  if (hasError > 0) return `error:${await page.locator('.address-search-field__error').first().innerText()}`
  return 'none'
}

async function openFirstPostcode(page) {
  await page.getByRole('button', { name: '주소 검색' }).first().click()
  await page.waitForTimeout(2000)
}

async function closeIfOpen(page) {
  const close = page.getByRole('button', { name: '닫기' }).first()
  if (await close.count()) await close.click()
  await page.waitForTimeout(500)
}

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  await login(page)
  await openAnyCustomerEdit(page)

  await openFirstPostcode(page)
  if ((await postcodeState(page)) === 'open') {
    report.basic = true
    const iframe = page.frameLocator('.address-search-field__embed iframe').first()
    const searchInput = iframe.locator('input').first()
    if (await searchInput.count()) {
      await searchInput.fill('테헤란로')
      await page.waitForTimeout(1000)
      const result = iframe.locator('button, li, .postcode_item, [class*="item"]').first()
      if (await result.count()) {
        await result.click()
        await page.waitForTimeout(1000)
        report.select = true
      }
    }
    await closeIfOpen(page)
  } else {
    report.errors.push(`basic:${await postcodeState(page)}`)
  }

  await openFirstPostcode(page)
  if ((await postcodeState(page)) === 'open') {
    await closeIfOpen(page)
    await openFirstPostcode(page)
    report.repeat = (await postcodeState(page)) === 'open'
    await closeIfOpen(page)
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const editBtn = page.getByRole('button', { name: '수정' }).first()
  if (await editBtn.count()) {
    await editBtn.click({ force: true })
    await page.waitForSelector('button:has-text("주소 검색")', { timeout: 30000 })
  }
  await openFirstPostcode(page)
  report.refresh = (await postcodeState(page)) === 'open'
} catch (e) {
  report.errors.push(String(e))
} finally {
  await browser.close()
}

const pass = report.basic && report.repeat && report.refresh && report.errors.length === 0
console.log(JSON.stringify({ ...report, pass, verdict: pass ? 'MAIN_POSTCODE_E2E_PASS' : 'MAIN_POSTCODE_E2E_BLOCKED' }, null, 2))
process.exit(pass ? 0 : 1)
