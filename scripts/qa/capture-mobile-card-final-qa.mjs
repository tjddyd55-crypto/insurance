/**
 * Development QA captures — mobile card editor + business card + themes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-card-final-qa')
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

await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.pap-hero').first().waitFor({ timeout: 30000 })
await page.screenshot({ path: join(OUT, '01-public-fc-hero-top.png'), fullPage: true })
console.log('saved 01-public-fc-hero-top.png')

const gap = await page.evaluate(() => {
  const devThemeBar = document.querySelector('.pap-dev-theme-review')
  const hero = document.querySelector('.pap-fc-card--hero, .pap-hero')
  return {
    devThemeBarAbsent: !devThemeBar,
    heroTopPx: hero ? Math.round(hero.getBoundingClientRect().top) : null,
  }
})
writeFileSync(join(OUT, 'gap-measure.json'), JSON.stringify(gap, null, 2))

await page.locator('button:has-text("명함")').first().click({ timeout: 5000 }).catch(() => {})
await page.waitForTimeout(500)
if (await page.locator('.pap-lightbox').count()) {
  await page.screenshot({ path: join(OUT, '08-business-card-lightbox-front.png') })
  const backBtn = page.locator('.pap-lightbox-business-nav__btn', { hasText: '뒷면' })
  if (await backBtn.count()) {
    await backBtn.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(OUT, '09-business-card-lightbox-back.png') })
  }
  await page.keyboard.press('Escape').catch(() => {})
}

const section = page.locator('.pap-section--business-card')
if (await section.count()) {
  await section.screenshot({ path: join(OUT, '07-business-card-section.png') })
}

const crm = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const crmPage = await crm.newPage()
if (PASS) {
  await login(crmPage)
  await crmPage.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await crmPage.locator('h1').first().waitFor({ timeout: 30000 })
  await dismissBlockingModals(crmPage)
  for (const [file, label] of [
    ['01-classic-with-business-card.png', '기본형'],
    ['02-brand-with-business-card.png', '브랜드형'],
    ['03-premium-with-business-card.png', '프리미엄형'],
  ]) {
    await crmPage.locator('.pap-theme-picker__card', { hasText: label }).click()
    await crmPage.waitForTimeout(400)
    await crmPage.locator('.pap-editor-live-preview__frame').screenshot({ path: join(OUT, file) })
    console.log('saved', file)
  }
  await crmPage.screenshot({ path: join(OUT, '04-mobile-card-editor-top.png') })
  const biz = crmPage.locator('.pap-editor-business-card-row')
  if (await biz.count()) {
    await biz.screenshot({ path: join(OUT, '05-mobile-card-editor-business-card-upload.png') })
  }
  await crmPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await crmPage.waitForTimeout(300)
  await crmPage.screenshot({ path: join(OUT, '06-mobile-card-editor-bottom.png') })
}

const html = await fetch(`${BASE}/fc/${SLUG}`).then((r) => r.text())
const ogCardHead = await fetch(`${BASE}/api/public/advisors/${SLUG}/og-card.png`, { method: 'HEAD' })
const ogMeta = {
  hasOgTitle: /property="og:title"/.test(html),
  hasOgDescription: /property="og:description"/.test(html),
  hasOgImage: /og-card\.png/.test(html),
  hasOgUrl: /property="og:url"/.test(html),
  hasCanonical: /rel="canonical"/.test(html),
  ogCardPng: ogCardHead.ok,
  ogCardContentType: ogCardHead.headers.get('content-type'),
}
writeFileSync(join(OUT, '10-og-meta-source.json'), JSON.stringify(ogMeta, null, 2))
await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded' })
await page.screenshot({ path: join(OUT, '10-og-meta-source.png'), fullPage: false })

await browser.close()
console.log('OUT', OUT)
console.log('gap', gap)
console.log('og', ogMeta)
