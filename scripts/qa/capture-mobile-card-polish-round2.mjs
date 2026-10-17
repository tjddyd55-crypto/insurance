/**
 * Development QA — mobile card UI polish round 2 captures.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-card-polish-round2')
mkdirSync(OUT, { recursive: true })

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

const browser = await chromium.launch({ headless: true })
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await mobile.newPage()

const themes = [
  ['01-classic-updated.png', '1안'],
  ['02-brand-updated.png', '2안'],
  ['03-premium-updated.png', '3안'],
]

await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.locator('.pap-hero').first().waitFor({ timeout: 45000 })

for (const [file, label] of themes) {
  await page.getByRole('button', { name: new RegExp(label) }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, file), fullPage: true })
  console.log('saved', file)
}

const bizSection = page.locator('.pap-section--business-card')
if (await bizSection.count()) {
  await bizSection.screenshot({ path: join(OUT, '04-business-card-front-only.png') })
}

await page.locator('button:has-text("명함")').first().click({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(400)
if (await page.locator('.pap-lightbox').count()) {
  await page.screenshot({ path: join(OUT, '04-business-card-lightbox.png') })
  await page.keyboard.press('Escape').catch(() => {})
}

const qa = await page.evaluate(() => {
  const titles = ['소개', '내 명함', '활동 모습', '상담 문의']
  const visibleTitles = titles.filter((t) => {
    const h2 = [...document.querySelectorAll('.pap-home-sections h2')].some((el) => el.textContent?.trim() === t)
    return h2
  })
  const card = document.querySelector('.pap-business-card-tile')
  const cardRect = card?.getBoundingClientRect()
  const ratio = cardRect && cardRect.height > 0 ? cardRect.width / cardRect.height : null
  const radius = card ? getComputedStyle(card).borderRadius : null
  const panel = document.querySelector('.pap-hero-premium__panel')
  const panelBg = panel ? getComputedStyle(panel).backgroundColor : null
  return {
    visibleSectionTitles: visibleTitles,
    businessCardAspectRatio: ratio ? Math.round(ratio * 100) / 100 : null,
    businessCardBorderRadius: radius,
    premiumPanelBackground: panelBg,
    hasLightboxBackNav: document.querySelector('.pap-lightbox-business-nav') !== null,
  }
})
console.log('qa-metrics', JSON.stringify(qa, null, 2))

const crm = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const crmPage = await crm.newPage()
if (PASS) {
  await login(crmPage)
  await crmPage.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await crmPage.locator('h1').first().waitFor({ timeout: 45000 })
  const biz = crmPage.locator('.pap-editor-business-card-row')
  if (await biz.count()) {
    await biz.screenshot({ path: join(OUT, '05-mobile-card-editor-front-only.png') })
  }
}

await browser.close()
console.log('output', OUT)
