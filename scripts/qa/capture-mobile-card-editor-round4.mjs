import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const OUT = path.resolve('scripts/qa/screenshots/mobile-card-editor-round4')
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'

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

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()

await login(page)
await dismissBlockingModals(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await dismissBlockingModals(page)
await page.locator('h1').first().waitFor({ timeout: 45000 })

const heroSection = () =>
  page.locator('h2.pap-editor-section-title', { hasText: 'Hero 표시 문구' }).locator('xpath=..')

await heroSection().locator('label').nth(0).locator('input').fill('')
await heroSection().locator('label').nth(1).locator('input').fill('')
await heroSection().locator('label').nth(2).locator('input').fill('')
await page.locator('label').filter({ hasText: '호칭' }).locator('input').fill('')
await page.waitForTimeout(300)

const inputVals = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('h2.pap-editor-section-title')]
    .find((h) => h.textContent?.includes('Hero 표시 문구'))
    ?.parentElement?.querySelectorAll('label input') ?? []
  const honor = [...document.querySelectorAll('label')].find((l) => l.textContent?.includes('호칭'))?.querySelector('input')
  return {
    hero: [...labels].map((i) => i.value),
    honorific: honor?.value ?? '',
  }
})

await page.screenshot({ path: path.join(OUT, '01-empty-input-no-forced-value.png'), fullPage: false })

await page.locator('.pap-theme-picker__card', { hasText: '브랜드형' }).click()
await page.waitForTimeout(400)
const brandCircle = await page.evaluate(() => {
  const ring = document.querySelector('.pap-editor-live-preview__scroll .pap-hero-brand__photo-ring')
  if (!ring) return null
  const s = getComputedStyle(ring)
  return { radius: s.borderRadius, width: s.width, height: s.height }
})
await page.locator('.pap-editor-live-preview__scroll .pap-hero-brand__photo-ring').screenshot({
  path: path.join(OUT, '02-brand-restored-circle-hero.png'),
})

await page.locator('.pap-theme-picker__card', { hasText: '프리미엄형' }).click()
await page.waitForTimeout(400)
const premium = await page.evaluate(() => {
  const media = document.querySelector('.pap-editor-live-preview__scroll .pap-hero-premium__media')
  if (!media) return null
  const rect = media.getBoundingClientRect()
  return { aspect: getComputedStyle(media).aspectRatio, height: Math.round(rect.height) }
})
await page.locator('.pap-editor-live-preview__scroll .pap-hero-premium__media').screenshot({
  path: path.join(OUT, '03-premium-taller-photo-overlay.png'),
})

await page.locator('.pap-editor-live-preview__scroll .pap-section--business-card').screenshot({
  path: path.join(OUT, '04-business-card-full-width-fixed.png'),
}).catch(() => {})

const publishOn = page.locator('.pap-editor-toolbar input[type="checkbox"]').first()
if (!(await publishOn.isChecked())) await publishOn.click({ force: true })
await page.locator('form.pap-editor-form .pap-cta-row button').filter({ hasText: '저장' }).click()
await page.waitForTimeout(2500)

const slugVal = await page.locator('label').filter({ hasText: '공개 주소' }).locator('input').inputValue()
const publicUrl = `${BASE}/fc/${encodeURIComponent(slugVal || SLUG)}`
await page.goto(publicUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.locator('.pap-hero').first().waitFor({ timeout: 60000 })
await page.screenshot({ path: path.join(OUT, '05-share-link-valid-public-page.png') })

const ogRes = await page.request.get(`${BASE}/fc/${encodeURIComponent(slugVal || SLUG)}`)
const ogHtml = await ogRes.text()
const ogTitle = ogHtml.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ''
await page.screenshot({ path: path.join(OUT, '06-og-preview-no-profile-not-found.png'), fullPage: false })

await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded' })
await dismissBlockingModals(page)
await page.locator('.pap-editor-layout__preview').screenshot({
  path: path.join(OUT, '07-editor-preview-round4-overview.png'),
})

await browser.close()
console.log(
  JSON.stringify({ inputVals, brandCircle, premium, ogTitle, publicUrl, output: OUT }, null, 2),
)
