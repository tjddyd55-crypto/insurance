import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const OUT = path.resolve('scripts/qa/screenshots/mobile-card-editor-round5')
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

async function dismiss(page) {
  await page.waitForTimeout(350)
  const closeBtn = page.locator('.customer-ui-modal-backdrop button').filter({ hasText: /닫기|확인|나중/ })
  if (await closeBtn.count()) await closeBtn.first().click().catch(() => {})
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await login(page)
await dismiss(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await dismiss(page)
await page.locator('h1').first().waitFor({ timeout: 45000 })

await page.locator('.pap-hero-editor-field').first().screenshot({ path: path.join(OUT, '01-hero-visibility-controls.png') })

await page.locator('.pap-hero-editor-field').first().locator('button', { hasText: '비노출' }).click()
await page.waitForTimeout(350)
await page.locator('.pap-editor-live-preview__scroll .pap-hero').screenshot({ path: path.join(OUT, '02-hero-eyebrow-hidden.png') })

await page.locator('.pap-editor-live-preview__scroll .pap-section--business-card').screenshot({
  path: path.join(OUT, '03-business-card-clean-full-width.png'),
}).catch(() => {})

const themes = [
  ['classic', '04-classic-og.png'],
  ['brand', '05-brand-og-circle.png'],
  ['premium', '06-premium-og.png'],
]
for (const [theme, file] of themes) {
  await page.locator('.pap-theme-picker__card', { hasText: theme === 'classic' ? '기본형' : theme === 'brand' ? '브랜드형' : '프리미엄형' }).click()
  await page.locator('form.pap-editor-form .pap-cta-row button').filter({ hasText: '저장' }).click()
  await page.waitForTimeout(2500)
  const og = await page.request.get(`${BASE}/api/public/advisors/${SLUG}/og-card.png`)
  if (og.ok()) fs.writeFileSync(path.join(OUT, file), Buffer.from(await og.body()))
}

await page.locator('.pap-editor-toolbar input[type="checkbox"]').first().setChecked(false)
await page.locator('button', { hasText: '공유' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(OUT, '07-share-disabled-when-private.png') })

await page.locator('.pap-editor-layout__preview').screenshot({ path: path.join(OUT, '08-editor-round5-overview.png') })

await browser.close()
console.log(JSON.stringify({ output: OUT }, null, 2))
