/**
 * Round6 QA captures — phone format, copy icons, OG hero-centric.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-card-round6')
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

async function dismiss(page) {
  await page.waitForTimeout(400)
  const closeBtn = page
    .locator('.customer-ui-modal-backdrop button')
    .filter({ hasText: /닫기|확인|나중/ })
  if (await closeBtn.count()) await closeBtn.first().click().catch(() => {})
}

const browser = await chromium.launch({ headless: true })
const desktop = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await desktop.newPage()
await login(page)
await dismiss(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await dismiss(page)
await page.locator('h1').first().waitFor({ timeout: 45000 })

await page.locator('.pap-hero-editor-field', { hasText: '전화번호' }).scrollIntoViewIfNeeded()
await page.screenshot({ path: join(OUT, '01-contact-phone-format.png') })

await page.locator('.pap-section--facts, .pap-custom-contacts-editor').first().scrollIntoViewIfNeeded().catch(() => {})
await page.screenshot({ path: join(OUT, '03-custom-info-label.png') })

await page.locator('.pap-editor-live-preview__scroll .pap-hero').screenshot({
  path: join(OUT, '04-hero-without-onefc-verification.png'),
})

await page.locator('.pap-editor-live-preview__frame').screenshot({ path: join(OUT, '05-live-preview-round6.png') })

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const m = await mobile.newPage()
await m.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await m.locator('.pap-hero').first().waitFor({ timeout: 45000 })
await m.locator('.pap-facts').screenshot({ path: join(OUT, '02-contact-copy-icons.png') }).catch(() => {})
await m.screenshot({ path: join(OUT, '07-public-profile-round6.png'), fullPage: true })

const og = await fetch(`${BASE}/api/public/advisors/${SLUG}/og-card.png`, { signal: AbortSignal.timeout(30000) })
if (og.ok) {
  const buf = Buffer.from(await og.arrayBuffer())
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(OUT, '06-og-hero-image.png'), buf)
}

await browser.close()
console.log('OUT', OUT)
