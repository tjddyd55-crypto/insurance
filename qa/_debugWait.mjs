import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
const WEB = 'http://127.0.0.1:3000'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('response', async (res) => {
  if (res.url().includes('/backend/api/') && (res.status() >= 400 || res.url().includes('billing') || res.url().includes('entitlement') || res.url().includes('customers'))) {
    // collected later via evaluate
  }
})
const out = {}
await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded' })
await page.locator('input').nth(0).fill('tjddyd55')
await page.locator('input').nth(1).fill('QaBizFire20260910!')
await page.locator('button[type="submit"]').first().click()
await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
await page.goto(WEB + '/customers', { waitUntil: 'domcontentloaded' })
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000)
  const snap = await page.evaluate(() => ({
    url: location.href,
    text: (document.body.innerText || '').slice(0, 500),
    inputCount: document.querySelectorAll('input').length,
    customerCards: document.querySelectorAll('[id^=customer-], [data-customer-id]').length,
  }))
  out['t'+i] = snap
  if (snap.inputCount > 0 || snap.customerCards > 0 || snap.text.includes('고객')) break
}
await page.screenshot({ path: 'qa/screenshots/polish-verify/debug-wait.png', fullPage: true })
// collect failed API calls from performance
out.api = await page.evaluate(async () => {
  const entries = performance.getEntriesByType('resource').filter(e => e.name.includes('/backend/api/')).slice(-30).map(e => e.name)
  return entries
})
fs.writeFileSync('qa/polish-debug2.json', JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify(out, null, 2))
await browser.close()
