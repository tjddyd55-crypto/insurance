/**
 * 390px /fc/:slug UI 검수 캡처 (명함·갤러리·full).
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = 'qa-public-advisor-dev'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-fc-390')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })

await page.locator('.pap-hero-photo-wrap').screenshot({ path: join(OUT, '01-hero-photo.png') })
await page.locator('.pap-hero--billboard').screenshot({ path: join(OUT, '02-billboard-card.png') })

await page.locator('.pap-section--gallery').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.locator('.pap-section--gallery').screenshot({ path: join(OUT, '03-gallery-six.png') })

await page.screenshot({ path: join(OUT, '04-full-page.png'), fullPage: true })

await browser.close()
console.log('Saved to', OUT)
