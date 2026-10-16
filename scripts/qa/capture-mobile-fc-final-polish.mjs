import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = 'qa-public-advisor-dev'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-fc-final-polish')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: join(OUT, name), ...opts })
  console.log('saved', name)
}

const ctx390 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const p390 = await ctx390.newPage()
await p390.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })

await p390.locator('.pap-hero--billboard').screenshot({ path: join(OUT, '390-01-hero-action.png') })
console.log('saved 390-01-hero-action.png')

await p390.locator('.pap-section--intro').scrollIntoViewIfNeeded()
await p390.waitForTimeout(300)
await shot(p390, '390-02-intro-gallery-start.png')

await p390.locator('.pap-section--gallery').screenshot({ path: join(OUT, '390-03-gallery-six.png') })
console.log('saved 390-03-gallery-six.png')

await p390.locator('.pap-section--facts').scrollIntoViewIfNeeded()
await p390.waitForTimeout(300)
await shot(p390, '390-04-info-card.png')

await p390.locator('.pap-section--contact-inline').scrollIntoViewIfNeeded()
await p390.waitForTimeout(300)
await shot(p390, '390-05-consult-sticky.png')

await shot(p390, '390-06-full-page.png', { fullPage: true })

await ctx390.close()

const ctx360 = await browser.newContext({
  viewport: { width: 360, height: 800 },
  isMobile: true,
  hasTouch: true,
})
const p360 = await ctx360.newPage()
await p360.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
await shot(p360, '360-full-page.png', { fullPage: true })
await ctx360.close()

const ctx430 = await browser.newContext({
  viewport: { width: 430, height: 932 },
  isMobile: true,
  hasTouch: true,
})
const p430 = await ctx430.newPage()
await p430.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
await p430.locator('.pap-hero--billboard').screenshot({ path: join(OUT, '430-hero.png') })
console.log('saved 430-hero.png')
await ctx430.close()

await browser.close()
console.log('OUT', OUT)
