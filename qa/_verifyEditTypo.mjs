import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
const WEB = 'http://127.0.0.1:3000'
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded' })
await page.locator('input').nth(0).fill('tjddyd55')
await page.locator('input').nth(1).fill('QaBizFire20260910!')
await page.locator('button[type="submit"]').first().click()
await page.waitForFunction(() => !location.pathname.includes('/login'))
await page.goto(WEB + '/customers', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => (document.body.innerText || '').includes('검색'))
await page.locator('input[placeholder*="검색"]').first().fill('01099090910')
await page.waitForTimeout(1200)
const card = page.locator('#customer-1342').first()
await card.waitFor()
await card.click({ position: { x: 40, y: 28 } })
await page.waitForTimeout(600)
const expand = page.getByText('상세 정보 펼치기', { exact: false }).first()
if (await expand.isVisible().catch(() => false)) await expand.click()
await page.waitForSelector('#customer-detail-read-basic-info', { state: 'visible' })
await page.getByRole('button', { name: '수정' }).first().click()
await page.waitForSelector('.customer-edit-form')
await page.waitForTimeout(1000)
// scroll sections
for (const t of ['화재보험', '기념일', '상담']) {
  const el = page.getByText(t, { exact: false }).first()
  if (await el.count()) await el.scrollIntoViewIfNeeded().catch(() => {})
}
await page.waitForTimeout(400)
const fonts = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: (el.textContent||'').trim().slice(0,50) }
  }
  return {
    fieldLabel: pick('.customer-edit-form .field__label, .customer-expand-detail .field__label'),
    fieldControl: pick('.customer-edit-form .field__control, .customer-expand-detail .field__control'),
    fireTitle: pick('.customer-fire-location-edit-card__title'),
    fireLabel: pick('.customer-fire-location-edit-card .field__label'),
    specialTitle: pick('.customer-special-date-edit-card__title'),
    specialHint: pick('.customer-special-dates-editor__empty-hint'),
    consultBody: pick('.customer-consultation-block__body, .customer-consultation-block'),
    consultDate: pick('.customer-consultation-block__date'),
    relationsTitle: pick('.customer-relations-strip__title'),
  }
})
fs.writeFileSync('qa/polish-edit-typo.json', JSON.stringify(fonts, null, 2), 'utf8')
console.log(JSON.stringify(fonts, null, 2))
await page.screenshot({ path: 'qa/screenshots/polish-verify/pc-edit-sections.png', fullPage: true })
await browser.close()
