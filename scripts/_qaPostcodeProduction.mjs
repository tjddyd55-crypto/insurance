import { chromium } from '../qa/node_modules/playwright/index.mjs'

const WEB = process.env.WEB_BASE_URL ?? 'https://insurance-production-7bd8.up.railway.app'
const USER = process.env.QA_USER ?? 'tjddyd55'
const PASS = process.env.QA_PASS ?? 'QaBizFire20260910!'
const report = { basic: false, business: null, fire: null, repeat: false, refresh: false, errors: [], scriptUrl: null, retryUiPresent: false }

async function login(page) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.field').filter({ hasText: '아이디' }).locator('input').fill(USER)
  await page.locator('.field').filter({ hasText: '비밀번호' }).locator('input').fill(PASS)
  await page.locator('button').filter({ hasText: '로그인' }).click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
}

async function openCustomerEdit(page) {
  await page.goto(`${WEB}/customers`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const search = page.locator('input[placeholder*="검색"]').first()
  await search.waitFor({ timeout: 30000 })
  await search.fill('01099090910')
  await page.waitForTimeout(1500)
  const card = page.locator('[data-customer-id], [id^="customer-"]').first()
  await card.waitFor({ timeout: 30000 })
  await card.click({ position: { x: 40, y: 28 } })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: '수정' }).first().click({ force: true })
  await page.waitForSelector('button:has-text("주소 검색")', { timeout: 30000 })
}

async function postcodeOpen(page) {
  const hasWidget = await page.locator('.address-search-field__embed iframe, [id^="__kakao__layer"]').count()
  const hasError = await page.locator('.address-search-field__error').count()
  if (hasWidget > 0) return 'open'
  if (hasError > 0) return `error:${await page.locator('.address-search-field__error').first().innerText()}`
  return 'none'
}

async function clickFirstAddressSearch(page) {
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
  await openCustomerEdit(page)

  await clickFirstAddressSearch(page)
  const basic = await postcodeOpen(page)
  if (basic === 'open') {
    report.basic = true
    await closeIfOpen(page)
  } else {
    report.errors.push(`basic:${basic}`)
  }

  const bizBtn = page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).getByRole('button', { name: '주소 검색' })
  if (await bizBtn.count()) {
    await bizBtn.first().click()
    await page.waitForTimeout(2000)
    report.business = (await postcodeOpen(page)) === 'open'
    await closeIfOpen(page)
  } else {
    report.business = 'n/a'
  }

  const fireSection = page.locator('.customer-form-section').filter({ hasText: '화재보험 정보' })
  if (await fireSection.count()) {
    await fireSection.first().scrollIntoViewIfNeeded()
    await fireSection.first().getByRole('button', { name: '주소 검색' }).first().click()
    await page.waitForTimeout(2000)
    report.fire = (await postcodeOpen(page)) === 'open'
    await closeIfOpen(page)
  } else {
    report.fire = 'n/a'
  }

  await clickFirstAddressSearch(page)
  const r1 = await postcodeOpen(page)
  if (r1 === 'open') {
    await closeIfOpen(page)
    await clickFirstAddressSearch(page)
    report.repeat = (await postcodeOpen(page)) === 'open'
    await closeIfOpen(page)
  } else {
    report.errors.push(`repeat-first:${r1}`)
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button:has-text("주소 검색")', { timeout: 30000 })
  await clickFirstAddressSearch(page)
  report.refresh = (await postcodeOpen(page)) === 'open'

  report.scriptUrl = await page.evaluate(() => {
    const s = document.querySelector('script[data-kakao-postcode-loader]')
    return s ? s.src : null
  })
  report.retryUiPresent = await page.evaluate(() => document.body.innerHTML.includes('다시 시도'))
} catch (e) {
  report.errors.push(String(e))
} finally {
  await browser.close()
}

const pass =
  report.basic &&
  report.repeat &&
  report.refresh &&
  report.errors.length === 0 &&
  (report.scriptUrl?.includes('t1.kakaocdn.net') ?? false)

console.log(JSON.stringify({ ...report, pass, verdict: pass ? 'KAKAO_POSTCODE_PRODUCTION_SYNC_COMPLETE' : 'KAKAO_POSTCODE_PRODUCTION_SYNC_BLOCKED' }, null, 2))
process.exit(pass ? 0 : 1)
