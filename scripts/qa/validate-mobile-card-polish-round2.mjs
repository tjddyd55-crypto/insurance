import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function dismissBlockingModals(page) {
  await page.waitForTimeout(400)
  const closeBtn = page
    .locator('.customer-ui-modal-backdrop button, .notification-login-modal button')
    .filter({ hasText: /닫기|확인|나중에|다음에|건너/ })
  if (await closeBtn.count()) {
    await closeBtn.first().click({ timeout: 5000 }).catch(() => {})
  } else {
    await page.keyboard.press('Escape').catch(() => {})
  }
  await page.locator('.customer-ui-modal-backdrop').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
}

const browser = await chromium.launch({ headless: true })
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await mobile.newPage()

const results = {}

await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.locator('.pap-hero').first().waitFor({ timeout: 45000 })

const publicChecks = await page.evaluate(() => {
  const titles = ['소개', '내 명함', '활동 모습', '상담 문의']
  const visibleTitles = titles.filter((t) =>
    [...document.querySelectorAll('.pap-home-sections h2')].some((el) => el.textContent?.trim() === t),
  )
  const card = document.querySelector('.pap-business-card-tile')
  const cardRect = card?.getBoundingClientRect()
  const ratio = cardRect && cardRect.height > 0 ? cardRect.width / cardRect.height : null
  const img = document.querySelector('.pap-business-card-img')
  const objectFit = img ? getComputedStyle(img).objectFit : null
  const backTiles = document.querySelectorAll('.pap-business-card-tile').length
  const fcCard = document.querySelector('.pap-home-sections .pap-fc-card')
  const fcRadius = fcCard ? getComputedStyle(fcCard).borderRadius : null
  const fcShadow = fcCard ? getComputedStyle(fcCard).boxShadow : null
  const devThemeBar = document.querySelector('.pap-dev-theme-review')
  const hero = document.querySelector('.pap-fc-card--hero, .pap-hero')
  const heroTopPx = hero ? Math.round(hero.getBoundingClientRect().top) : null
  const sticky = document.querySelector('.pap-sticky-cta')
  const stickyVisible = sticky ? sticky.getBoundingClientRect().height > 0 : false
  return {
    visibleTitles,
    businessCardCount: backTiles,
    aspectRatio: ratio ? Math.round(ratio * 100) / 100 : null,
    objectFit,
    fcRadius,
    fcShadowNone: fcShadow === 'none' || fcShadow === '',
    devThemeBarAbsent: !devThemeBar,
    heroTopPx,
    stickyVisible,
  }
})
Object.assign(results, { public: publicChecks })

await page.locator('button:has-text("명함")').first().click({ timeout: 8000 })
await page.waitForTimeout(300)
const lightbox = await page.evaluate(() => ({
  open: Boolean(document.querySelector('.pap-lightbox')),
  backNav: Boolean(document.querySelector('.pap-lightbox-business-nav')),
  imgCount: document.querySelectorAll('.pap-lightbox img').length,
}))
results.lightbox = lightbox
await page.keyboard.press('Escape')

const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const crm = await desktop.newPage()
await login(crm)
await crm.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await crm.locator('h1').first().waitFor({ timeout: 45000 })
await dismissBlockingModals(crm)

const themePreview = {}
for (const [key, label] of [
  ['classic', '기본형'],
  ['brand', '브랜드형'],
  ['premium', '프리미엄형'],
]) {
  await crm.locator('.pap-theme-picker__card', { hasText: label }).click()
  await crm.waitForTimeout(350)
  const ok = await crm.locator('.pap-editor-live-preview__scroll .pap-hero').first().isVisible()
  const barInPreview = await crm.evaluate(() => Boolean(document.querySelector('.pap-dev-theme-review')))
  themePreview[key] = { heroVisible: ok, devBarInPreview: barInPreview }
}
results.editorThemePreview = themePreview

const crmChecks = await crm.evaluate(() => {
  const backSlot = [...document.querySelectorAll('.pap-editor-business-card-slot strong, .pap-editor-business-card-slot')].some(
    (el) => el.textContent?.includes('뒷면'),
  )
  const slots = document.querySelectorAll('.pap-editor-business-card-slot').length
  const img = document.querySelector('.pap-editor-business-card-slot img')
  const ratio =
    img && img.getBoundingClientRect().height > 0
      ? Math.round((img.getBoundingClientRect().width / img.getBoundingClientRect().height) * 100) / 100
      : null
  return { backSlotText: backSlot, slotCount: slots, thumbRatio: ratio }
})
results.crm = crmChecks

await crm.getByRole('button', { name: '저장' }).click({ timeout: 10000 }).catch(() => {})
await crm.waitForTimeout(1500)
await crm.reload({ waitUntil: 'domcontentloaded' })
await crm.locator('h1').first().waitFor({ timeout: 45000 })
const afterReload = await crm.evaluate(() => ({
  hasFrontImg: Boolean(document.querySelector('.pap-editor-business-card-slot img')),
  slots: document.querySelectorAll('.pap-editor-business-card-slot').length,
}))
results.crmAfterReload = afterReload

await browser.close()
console.log(JSON.stringify(results, null, 2))
