import { chromium } from '../qa/node_modules/playwright/index.mjs'

const WEB = process.env.WEB_BASE_URL ?? 'https://insurance-production-7bd8.up.railway.app'
const REGISTER_URL = `${WEB}/customer/register?ref=tjddyd55&ga=YJASSET`

const report = {
  url: REGISTER_URL,
  bundle: null,
  hasAnniversarySection: false,
  hasMedicalFormatHint: false,
  accountPlaceholder: null,
  hasAddressSearchButton: false,
  addressModalOpens: false,
  errors: [],
}

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  await page.goto(REGISTER_URL, { waitUntil: 'networkidle', timeout: 90000 })

  const scriptSrc = await page.locator('script[src*="/assets/index-"]').first().getAttribute('src')
  report.bundle = scriptSrc

  const bodyText = await page.locator('body').innerText()
  report.hasAnniversarySection = /기념일|알림일/.test(bodyText)
  report.hasMedicalFormatHint = /병력.*형식|형식.*병력|예:\s*고혈압/.test(bodyText)

  const accountSection = page.locator('.customer-form-section, section, fieldset').filter({ hasText: '계좌' }).last()
  if (await accountSection.count()) {
    const input = accountSection.locator('input').first()
    report.accountPlaceholder = await input.getAttribute('placeholder')
  } else {
    const placeholders = await page.locator('input[placeholder]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('placeholder')),
    )
    report.accountPlaceholder =
      placeholders.find((value) => value?.includes('은행명')) ??
      placeholders.find((value) => value?.includes('계좌')) ??
      null
  }

  const addressBtn = page.getByRole('button', { name: '주소 검색' }).first()
  report.hasAddressSearchButton = (await addressBtn.count()) > 0
  if (report.hasAddressSearchButton) {
    await addressBtn.click()
    await page.waitForTimeout(2000)
    const modalTitle = page.getByText('주소 검색', { exact: true })
    const closeBtn = page.getByRole('button', { name: '닫기' })
    report.addressModalOpens = (await modalTitle.count()) > 0 && (await closeBtn.count()) > 0
  }
} catch (error) {
  report.errors.push(String(error))
} finally {
  await browser.close()
}

const pass =
  report.errors.length === 0 &&
  !report.hasAnniversarySection &&
  !report.hasMedicalFormatHint &&
  report.accountPlaceholder === '은행명 / 계좌번호' &&
  report.hasAddressSearchButton &&
  report.addressModalOpens

console.log(JSON.stringify({ pass, report }, null, 2))
process.exit(pass ? 0 : 1)
