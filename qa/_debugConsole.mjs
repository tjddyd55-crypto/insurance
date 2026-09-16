import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
const WEB = 'http://127.0.0.1:3000'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const logs = []
page.on('console', m => logs.push({ type: m.type(), text: m.text() }))
page.on('pageerror', e => logs.push({ type: 'pageerror', text: String(e) }))
page.on('response', r => { if (r.url().includes('/backend/')) logs.push({ type: 'resp', status: r.status(), url: r.url() }) })
await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded' })
await page.locator('input').nth(0).fill('tjddyd55')
await page.locator('input').nth(1).fill('QaBizFire20260910!')
await page.locator('button[type="submit"]').first().click()
await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
await page.goto(WEB + '/customers', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
const text = await page.evaluate(() => document.body.innerText.slice(0, 800))
fs.writeFileSync('qa/polish-console.json', JSON.stringify({ text, logs: logs.slice(-80) }, null, 2), 'utf8')
console.log(JSON.stringify({ text, logs: logs.slice(-80) }, null, 2))
await browser.close()
