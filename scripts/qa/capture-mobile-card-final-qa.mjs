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

const browser = await chromium.launch({ headless: true })
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await mobile.newPage()

const themes = [
  ['01-classic-with-business-card.png', '1안'],
  ['02-brand-with-business-card.png', '2안'],
  ['03-premium-with-business-card.png', '3안'],
]

await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.pap-hero').first().waitFor({ timeout: 30000 })

for (const [file, label] of themes) {
  await page.getByRole('button', { name: new RegExp(label) }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, file), fullPage: true })
  console.log('saved', file)
}

const gap = await page.evaluate(() => {
  const bar = document.querySelector('.pap-dev-theme-review')
  const hero = document.querySelector('.pap-fc-card--hero')
  if (!bar || !hero) return { hasBar: Boolean(bar), gapPx: null }
  const b = bar.getBoundingClientRect()
  const h = hero.getBoundingClientRect()
  return { hasBar: true, gapPx: Math.round(h.top - b.bottom) }
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
