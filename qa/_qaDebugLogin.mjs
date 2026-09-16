import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/workspace/insurance-prod-push/qa/basic-fields'
fs.mkdirSync(outDir, { recursive: true })
const page = await (await chromium.launch({ headless: true })).newPage({ viewport: { width: 390, height: 844 } })
const log = []
page.on('console', (m) => log.push(m.text()))
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(1000)
await page.screenshot({ path: path.join(outDir, 'debug-home.png') })
const html = await page.content()
fs.writeFileSync(path.join(outDir, 'debug-home.html'), html, 'utf8')
const inputs = await page.locator('input').evaluateAll((els) => els.map((e) => ({ type: e.type, name: e.name, placeholder: e.placeholder, id: e.id })))
console.log('url', page.url())
console.log('inputs', JSON.stringify(inputs))
console.log('has password', await page.locator('input[type=password]').count())
console.log('buttons', await page.locator('button').evaluateAll((els) => els.map((e) => e.textContent?.trim()).slice(0, 20)))
await page.close()
