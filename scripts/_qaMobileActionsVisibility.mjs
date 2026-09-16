import { chromium, devices } from '../qa/node_modules/playwright/index.mjs'

const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000'
const USER = process.env.QA_USER ?? 'tjddyd55'
const PASS = process.env.QA_PASS ?? 'QaBizFire20260910!'

async function loginAndOpenCustomer(page) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('input').nth(0).fill(USER)
  await page.locator('input').nth(1).fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
  await page.goto(`${WEB}/customers`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const search = page.locator('input[placeholder*="검색"]').first()
  await search.waitFor({ timeout: 30000 })
  await search.fill('010')
  await page.waitForTimeout(1500)
  const card = page.locator('[data-customer-id], [id^="customer-"]').first()
  await card.waitFor({ timeout: 30000 })
  await card.click({ position: { x: 40, y: 28 } })
  await page.waitForTimeout(1000)
}

async function check(label, contextOptions) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  const report = {
    label,
    mapVisible: false,
    cardVisible: false,
    mobileClass: false,
    pcTabs: false,
  }

  try {
    await loginAndOpenCustomer(page)
    const body = await page.locator('body').innerText()
    report.mapVisible = body.includes('지도에서 보기')
    report.cardVisible = body.includes('카드 수납')
    report.mobileClass = (await page.locator('.customers-page--mobile').count()) > 0
    report.pcTabs = (await page.locator('.customer-workspace-layout__tab-bar').count()) > 0
  } catch (error) {
    report.error = String(error)
  } finally {
    await browser.close()
  }

  return report
}

const results = [
  await check('pc', { viewport: { width: 1440, height: 900 } }),
  await check('mobile-pixel5', { ...devices['Pixel 5'] }),
  await check('mobile-360', {
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 800 },
  }),
]

const pc = results.find((result) => result.label === 'pc')
const mobile = results.filter((result) => result.label !== 'pc')
const pass =
  pc &&
  !pc.error &&
  pc.mapVisible &&
  pc.cardVisible &&
  pc.pcTabs &&
  mobile.every((result) => !result.error && !result.mapVisible && !result.cardVisible && result.mobileClass)

console.log(
  JSON.stringify(
    {
      web: WEB,
      results,
      pass,
      verdict: pass ? 'VISIBILITY_PASS' : 'VISIBILITY_BLOCKED',
    },
    null,
    2,
  ),
)
process.exit(pass ? 0 : 1)
