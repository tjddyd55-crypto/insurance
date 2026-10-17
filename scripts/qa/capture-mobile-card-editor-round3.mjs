import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-card-editor-round3')
mkdirSync(OUT, { recursive: true })

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function dismissBlockingModals(page) {
  await page.waitForTimeout(400)
  const closeBtn = page.locator('.customer-ui-modal-backdrop button').filter({ hasText: /닫기|확인|나중/ })
  if (await closeBtn.count()) await closeBtn.first().click().catch(() => {})
  await page.locator('.customer-ui-modal-backdrop').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
}

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
await login(page)
await dismissBlockingModals(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await dismissBlockingModals(page)
await page.locator('h1').first().waitFor({ timeout: 45000 })

await page.screenshot({ path: join(OUT, '01-editor-live-preview-round3-top.png') })

await page.locator('h2.pap-editor-section-title', { hasText: 'Hero 표시 문구' }).locator('xpath=following::label[1]/input').fill('ONE FC QA')
await page.locator('h2.pap-editor-section-title', { hasText: 'Hero 표시 문구' }).locator('xpath=following::label[2]/input').fill('박성용 FC')
await page.locator('h2.pap-editor-section-title', { hasText: 'Hero 표시 문구' }).locator('xpath=following::label[3]/input').fill('영진에셋 · 팀장')
await page.screenshot({ path: join(OUT, '05-hero-custom-text-fields.png') })

await page.locator('.pap-theme-picker__card', { hasText: '프리미엄형' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, '03-overlay-theme-taller-hero.png') })
await page.screenshot({ path: join(OUT, '04-live-preview-premium.png') })

const heroRadius = await page.evaluate(() => {
  const img = document.querySelector('.pap-editor-live-preview__scroll .pap-hero-photo, .pap-editor-live-preview__scroll .pap-hero-brand__photo-ring, .pap-editor-live-preview__scroll .pap-hero-premium__media')
  return img ? getComputedStyle(img).borderRadius : null
})
await page.locator('.pap-editor-live-preview__scroll').screenshot({ path: join(OUT, '02-hero-no-radius.png') })

const card = page.locator('.pap-editor-live-preview__scroll .pap-business-card-tile')
if (await card.count()) await card.screenshot({ path: join(OUT, '04-business-card-full-width.png') })

const sticky = await page.evaluate(() => {
  const cta = document.querySelector('.pap-editor-live-preview__scroll .pap-sticky-cta')
  const frame = document.querySelector('.pap-editor-live-preview__scroll')
  if (!cta || !frame) return { inside: false }
  const c = cta.getBoundingClientRect()
  const f = frame.getBoundingClientRect()
  return { inside: c.bottom <= f.bottom + 2 && c.top >= f.top, position: getComputedStyle(cta).position }
})
await page.screenshot({ path: join(OUT, '06-preview-sticky-inside-phone.png'), fullPage: false })
await page.locator('.pap-editor-live-preview__frame').screenshot({ path: join(OUT, '08-live-preview-scroll-sticky.png') })

const publishOn = page.locator('.pap-editor-toolbar input[type="checkbox"]').first()
if (!(await publishOn.isChecked())) await publishOn.click({ force: true })
await page.locator('form.pap-editor-form .pap-cta-row button').filter({ hasText: '저장' }).click()
await page.waitForTimeout(2500)
await page.screenshot({ path: join(OUT, '05-editor-save-success.png') })

const pub = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage()
await pub.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => pub.goto(`${BASE}/fc/${SLUG}`))
await pub.locator('.pap-hero, .pap-page--fc').first().waitFor({ timeout: 60000 })
await pub.screenshot({ path: join(OUT, '07-public-page-after-save-round3.png'), fullPage: true })

console.log(JSON.stringify({ heroRadius, sticky }, null, 2))
console.log('output', OUT)
await browser.close()
