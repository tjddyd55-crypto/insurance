/**
 * Dev QA — mobile card editor live preview + upload flow captures.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-card-editor-live-preview')
mkdirSync(OUT, { recursive: true })

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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
const desktop = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await desktop.newPage()

const consoleMixed = []
page.on('console', (msg) => {
  const t = msg.text()
  if (/mixed content/i.test(t)) consoleMixed.push(t)
})

await login(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.locator('h1').first().waitFor({ timeout: 45000 })

await page.screenshot({ path: join(OUT, '01-mobile-card-editor-live-preview-top.png'), fullPage: false })
await page.screenshot({ path: join(OUT, '08-live-preview-scroll-sticky.png'), fullPage: true })

const profileInput = page.locator('.pap-editor-photo-row input[type="file"]')
await profileInput.setInputFiles({
  name: 'qa-profile.png',
  mimeType: 'image/png',
  buffer: PNG_1X1,
})
await page.waitForTimeout(800)
await page.locator('.pap-editor-avatar').first().waitFor({ timeout: 15000 })
await page.screenshot({ path: join(OUT, '02-profile-photo-uploaded.png') })

const cardInput = page.locator('.pap-editor-business-card-slot input[type="file"]')
await cardInput.setInputFiles({
  name: 'qa-card.png',
  mimeType: 'image/png',
  buffer: PNG_1X1,
})
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT, '03-business-card-uploaded.png') })

await page.locator('.pap-theme-picker__card', { hasText: '프리미엄형' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, '04-live-preview-premium.png') })

await page.getByRole('button', { name: '저장' }).click()
await page.waitForTimeout(2000)
await page.screenshot({ path: join(OUT, '05-editor-save-success.png') })

const publishOff = page.locator('.pap-editor-toolbar input[type="checkbox"]').first()
if (await publishOff.isChecked()) {
  await publishOff.click()
  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForTimeout(2000)
}
await page.screenshot({ path: join(OUT, '07-public-off-editor-media.png') })

const metrics = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')]
  const broken = imgs.filter((img) => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'))
  const httpSrc = imgs.map((i) => i.src).filter((s) => s.startsWith('http://'))
  const preview = document.querySelector('.pap-editor-live-preview__scroll')
  const sticky = document.querySelector('.pap-editor-layout__preview')
  const cardThumb = document.querySelector('.pap-editor-business-card-thumb, .pap-editor-business-card-slot img')
  const cardRect = cardThumb?.getBoundingClientRect()
  const ratio = cardRect && cardRect.height > 0 ? cardRect.width / cardRect.height : null
  return {
    brokenCount: broken.length,
    httpImgCount: httpSrc.length,
    hasLivePreview: Boolean(preview),
    stickyPreview: sticky ? getComputedStyle(sticky).position : null,
    businessCardRatio: ratio ? Math.round(ratio * 100) / 100 : null,
    statusText: document.querySelector('[role="status"]')?.textContent?.trim() ?? '',
  }
})

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const pub = await mobile.newPage()
await pub.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await pub.locator('.pap-hero').first().waitFor({ timeout: 45000 })
await pub.screenshot({ path: join(OUT, '06-public-profile-after-save.png'), fullPage: true })

const pubMetrics = await pub.evaluate(() => ({
  broken: [...document.querySelectorAll('img')].filter(
    (img) => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'),
  ).length,
  httpImgs: [...document.querySelectorAll('img')].map((i) => i.src).filter((s) => s.startsWith('http://')).length,
}))

const narrow = await browser.newContext({ viewport: { width: 1000, height: 800 } })
const narrowPage = await narrow.newPage()
await login(narrowPage)
await narrowPage.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
const narrowMetrics = await narrowPage.evaluate(() => ({
  previewDisplay: document.querySelector('.pap-editor-layout__preview')
    ? getComputedStyle(document.querySelector('.pap-editor-layout__preview')).display
    : null,
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}))

writeFileSync(
  join(OUT, 'qa-metrics.json'),
  JSON.stringify({ metrics, pubMetrics, narrowMetrics, consoleMixed }, null, 2),
)

await browser.close()
console.log('output', OUT)
console.log(JSON.stringify({ metrics, pubMetrics, narrowMetrics, consoleMixed }, null, 2))
