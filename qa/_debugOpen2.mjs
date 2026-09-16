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
  await page.goto(WEB + '/customers?customerId=1342', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2500)
  out.steps.push({ url: page.url() })
  out.inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({ ph: i.placeholder, val: i.value })).slice(0, 10))
  out.cardCount = await page.locator('#customer-1342, [data-customer-id="1342"]').count()
  out.bodySnippet = await page.evaluate(() => (document.body.innerText || '').slice(0, 1000))
  await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-list.png', fullPage: true })
  const search2 = page.locator('input[placeholder*="검색"]')
  out.searchCount = await search2.count()
  if (await search2.count()) {
    await search2.first().fill('01099090910')
    await page.waitForTimeout(1500)
  }
  out.cardAfterSearch = await page.locator('#customer-1342, [data-customer-id="1342"]').count()
  if (out.cardAfterSearch || out.cardCount) {
    const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
    await card.waitFor({ timeout: 20000 })
    await card.click({ position: { x: 30, y: 25 } })
    await page.waitForTimeout(1000)
    out.buttonsAfterClick = await page.evaluate(() => [...document.querySelectorAll('button,[role=button]')].map(b => (b.textContent||'').trim()).filter(t => t && t.length < 50).slice(0, 50))
    const expand = page.getByText('상세 정보 펼치기', { exact: false }).first()
    out.expandVisible = await expand.isVisible().catch(() => false)
    if (out.expandVisible) {
      await expand.click()
      await page.waitForTimeout(800)
    }
    out.afterExpand = await page.evaluate(() => {
      const detail = document.querySelector('#customer-1342 .customer-expand-detail')
      const basic = document.querySelector('#customer-detail-read-basic-info')
      const hidden = detail ? detail.hasAttribute('hidden') : null
      return {
        hasDetail: !!detail,
        detailHidden: hidden,
        hasBasic: !!basic,
        basicVisible: basic ? !!(basic.offsetParent || basic.getClientRects().length) : false,
        texts: [...document.querySelectorAll('h3,h4,button')].map(e => (e.textContent||'').trim()).filter(Boolean).slice(0, 40),
      }
    })
    await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-expand.png', fullPage: true })
  }
} catch (e) {
  out.error = String(e.stack || e)
  try { await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-err.png', fullPage: true }) } catch {}
}
fs.writeFileSync('qa/polish-debug.json', JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify(out, null, 2))
await browser.close()
