/**
 * 모바일 공개 프로필 캡처 (390 / 360).
 * npx playwright install chromium 후 실행.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = 'qa-public-advisor-dev'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-profile')
mkdirSync(OUT, { recursive: true })

async function capture(page, name, fullPage = false) {
  await page.screenshot({ path: join(OUT, name), fullPage })
  console.log('saved', name)
}

const browser = await chromium.launch({ headless: true })

for (const [label, width, height] of [
  ['390', 390, 844],
  ['360', 360, 800],
]) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
  if (label === '390') {
    await capture(page, '390-billboard.png')
    await capture(page, '390-top.png')
    await page.locator('.pap-section--intro').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await capture(page, '390-intro.png')
    await page.locator('.pap-section--gallery').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await capture(page, '390-gallery.png')
    await page.locator('.pap-section--facts').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await capture(page, '390-bottom-sticky.png')
    const tile = page.locator('.pap-gallery-tile').first()
    if (await tile.count()) {
      await tile.click()
      await page.waitForTimeout(400)
      await capture(page, '390-lightbox.png')
      await page.getByRole('button', { name: '닫기' }).click()
    }
  } else {
    await capture(page, '360-full.png', true)
  }
  await ctx.close()
}

await browser.close()
console.log('Screenshots:', OUT)
