import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
const WEB = 'http://127.0.0.1:3000'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const out = { steps: [] }
try {
  await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input').nth(0).fill('tjddyd55')
  await page.locator('input').nth(1).fill('QaBizFire20260910!')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
  out.steps.push({ login: page.url() })
  await page.goto(WEB + '/customers?customerId=1342', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  out.steps.push({ url: page.url(), title: await page.title() })
  const ph = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({ ph: i.placeholder, aria: i.getAttribute('aria-label'), val: i.value })).slice(0, 8))
  out.inputs = ph
  const cardCount = await page.locator('#customer-1342, [data-customer-id="1342"]').count()
  out.cardCount = cardCount
  const bodySnippet = await page.evaluate(() => (document.body.innerText || '').slice(0, 800))
  out.bodySnippet = bodySnippet
  await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-list.png', fullPage: true })
  if (cardCount) {
    const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
    await card.click({ position: { x: 30, y: 25 } })
    await page.waitForTimeout(1000)
    const texts = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, [role="button"], a')].map(b => (b.textContent||'').trim()).filter(t => t && t.length < 40)
      return btns.slice(0, 40)
    })
    out.buttonsAfterClick = texts
    await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-after-click.png', fullPage: true })
  } else {
    // try search
    const search = page.locator('input').filter({ hasNot: page.locator('[type=password]') }).first()
    // find search by placeholder containing 검색
    const search2 = page.locator('input[placeholder*="검색"]')
    out.searchCount = await search2.count()
    if (await search2.count()) {
      await search2.first().fill('01099090910')
      await page.waitForTimeout(1500)
      out.cardAfterSearch = await page.locator('#customer-1342, [data-customer-id="1342"]').count()
      out.bodyAfterSearch = await page.evaluate(() => (document.body.innerText || '').slice(0, 800))
      await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-search.png', fullPage: true })
    }
  }
} catch (e) {
  out.error = String(e.stack || e)
  try { await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-err.png', fullPage: true }) } catch {}
}
fs.writeFileSync('qa/polish-debug.json', JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify(out, null, 2))
await browser.close()
