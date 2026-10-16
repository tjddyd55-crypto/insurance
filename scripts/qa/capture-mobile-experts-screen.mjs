import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-experts')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
await page.goto(`${BASE}/experts?q=${encodeURIComponent('QA')}`, { waitUntil: 'networkidle' })
await page.screenshot({ path: join(OUT, '390-experts-list.png'), fullPage: true })
console.log('saved', join(OUT, '390-experts-list.png'))
await browser.close()
