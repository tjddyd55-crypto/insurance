import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/workspace/insurance-prod-push/qa/basic-fields'
fs.mkdirSync(outDir, { recursive: true })
const base = 'http://127.0.0.1:3000'

async function login(page) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(700)
  if (page.url().includes('/customers')) return
  const pass = page.locator('input[type="password"]').first()
  if (!(await pass.count())) return
  const inputs = page.locator('input')
  for (let i = 0; i < await inputs.count(); i++) {
    const t = await inputs.nth(i).getAttribute('type')
    if (t !== 'password') { await inputs.nth(i).fill('tjddyd55'); break }
  }
  await pass.fill('QaBizFire20260910!')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(2200)
}

async function expand(page) {
  await page.goto(base + '/customers', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1200)
  const search = page.locator('input[placeholder*="검색"], input[aria-label*="검색"]').first()
  if (await search.count()) { await search.fill('고객사업자화재QA'); await page.waitForTimeout(1200) }
  const card = page.locator('text=고객사업자화재QA').first()
  if (await card.count()) await card.click({ force: true })
  else await page.locator('.customer-expand-summary').first().click({ force: true })
  await page.waitForTimeout(1600)
  const expandBtn = page.locator('button:has-text("고객 정보 펼치기")')
  if (await expandBtn.count() && await expandBtn.isVisible().catch(()=>false)) {
    await expandBtn.click(); await page.waitForTimeout(700)
  }
  await page.waitForSelector('#customer-detail-read-basic-info', { timeout: 20000 })
}

function fonts(page, sel) {
  return page.locator(sel).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: el.textContent?.trim().slice(0,40) }
  }).catch(() => null)
}

const browser = await chromium.launch({ headless: true })
const results = []
for (const vp of [{name:'pc',width:1440,height:900},{name:'m360',width:360,height:800}]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  const r = { name: vp.name, ok: false, errors: [] }
  try {
    await login(page)
    await expand(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const card = page.locator('text=고객사업자화재QA').first()
    if (await card.count()) await card.click({ force: true })
    await page.waitForTimeout(1200)
    const expandBtn = page.locator('button:has-text("고객 정보 펼치기")')
    if (await expandBtn.count() && await expandBtn.isVisible().catch(()=>false)) await expandBtn.click()
    await page.waitForSelector('#customer-detail-read-basic-info', { timeout: 20000 })
    const basic = page.locator('#customer-detail-read-basic-info')
    const html = await basic.innerHTML()
    r.hasName = html.includes('이름:')
    r.hasPhone = html.includes('연락처:')
    r.hasInsAge = html.includes('보험나이:')
    r.noOldPhone = !html.includes('핸드폰번호')
    r.basicLabel = await fonts(page, '#customer-detail-read-basic-info .customer-detail-read__info-label')
    r.basicValue = await fonts(page, '#customer-detail-read-basic-info .customer-detail-read__info-value')
    // scroll/find car card
    const carLabel = page.locator('.customer-car-read-card__label, .customer-car-read-card .customer-detail-read__info-label').first()
    if (await carLabel.count()) {
      await carLabel.scrollIntoViewIfNeeded()
      r.carLabel = await fonts(page, '.customer-car-read-card__label, .customer-car-read-card .customer-detail-read__info-label')
      r.carValue = await fonts(page, '.customer-car-read-card__value, .customer-car-read-card .customer-detail-read__info-value')
    }
    const bizLabel = page.locator('#customer-business-info-heading').locator('xpath=ancestor::section[1]').locator('.customer-detail-read__info-label').first()
    if (await bizLabel.count()) {
      await bizLabel.scrollIntoViewIfNeeded()
      r.bizLabel = await fonts(page, '#customer-business-info-heading >> xpath=ancestor::section[1] >> .customer-detail-read__info-label')
      r.bizValue = await fonts(page, '#customer-business-info-heading >> xpath=ancestor::section[1] >> .customer-detail-read__info-value')
    }
    const metrics = await basic.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    r.overflow = metrics.sw > metrics.cw + 2
    r.metrics = metrics
    r.screenshot = path.join(outDir, `unify-${vp.name}.png`)
    await page.screenshot({ path: r.screenshot, fullPage: false })
    const sameSize = r.carLabel && r.basicLabel && r.carLabel.fontSize === r.basicLabel.fontSize
    r.sameLabelSize = sameSize
    r.ok = r.hasName && r.hasPhone && r.hasInsAge && r.noOldPhone && !r.overflow && (!r.carLabel || sameSize)
  } catch (e) {
    r.errors.push(String(e.stack || e))
  }
  results.push(r)
  await page.close()
}
await browser.close()
fs.writeFileSync(path.join(outDir, 'unify-report.json'), JSON.stringify(results, null, 2), 'utf8')
console.log(JSON.stringify(results, null, 2))
