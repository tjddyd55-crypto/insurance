import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/workspace/insurance-prod-push/qa/basic-fields'
fs.mkdirSync(outDir, { recursive: true })
const base = 'http://127.0.0.1:3000'

async function login(page) {
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(500)
  const inputs = page.locator('input')
  await inputs.nth(0).fill('tjddyd55')
  await inputs.nth(1).fill('QaBizFire20260910!')
  await page.locator('button[type="submit"], button').first().click()
  await page.waitForTimeout(2500)
}

async function openCustomer(page) {
  await page.goto(base + '/customers', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)
  const search = page.locator('input[placeholder*="검색"], input[aria-label*="검색"]').first()
  if (await search.count()) {
    await search.fill('고객사업자화재QA')
    await page.waitForTimeout(1500)
  }
  const hit = page.getByText('고객사업자화재QA', { exact: false }).first()
  await hit.waitFor({ timeout: 15000 })
  await hit.click({ force: true })
  await page.waitForTimeout(1800)
  const expandBtn = page.getByRole('button', { name: /고객 정보 펼치기/ })
  if (await expandBtn.count() && await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click()
    await page.waitForTimeout(800)
  }
  await page.waitForSelector('#customer-detail-read-basic-info', { timeout: 20000 })
}

function fontOf(page, sel) {
  return page.locator(sel).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return { fontSize: cs.fontSize, fontWeight: cs.fontWeight }
  })
}

const browser = await chromium.launch({ headless: true })
const results = []
for (const vp of [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  const r = { name: vp.name, ok: false, errors: [] }
  try {
    await login(page)
    await openCustomer(page)
    const basic = page.locator('#customer-detail-read-basic-info')
    const html = await basic.innerHTML()
    r.hasName = html.includes('이름')
    r.hasPhone = html.includes('연락처')
    r.hasInsAge = html.includes('보험나이')
    r.noOldPhone = !html.includes('핸드폰번호')
    r.basicLabel = await fontOf(page, '#customer-detail-read-basic-info .customer-detail-read__info-label')
    r.basicValue = await fontOf(page, '#customer-detail-read-basic-info .customer-detail-read__info-value')
    const car = page.locator('.customer-car-read-card').first()
    if (await car.count()) {
      await car.scrollIntoViewIfNeeded()
      r.carLabel = await fontOf(page, '.customer-car-read-card .customer-detail-read__info-label, .customer-car-read-card__label')
      r.carValue = await fontOf(page, '.customer-car-read-card .customer-detail-read__info-value, .customer-car-read-card__value')
    }
    const biz = page.locator('#customer-business-info-heading')
    if (await biz.count()) {
      await biz.scrollIntoViewIfNeeded()
      const section = page.locator('section[aria-labelledby="customer-business-info-heading"]')
      if (await section.locator('.customer-detail-read__info-label').count()) {
        r.bizLabel = await fontOf(page, 'section[aria-labelledby="customer-business-info-heading"] .customer-detail-read__info-label')
        r.bizValue = await fontOf(page, 'section[aria-labelledby="customer-business-info-heading"] .customer-detail-read__info-value')
      }
    }
    const metrics = await basic.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    r.overflow = metrics.sw > metrics.cw + 2
    r.sameAsCar = !r.carLabel || r.carLabel.fontSize === r.basicLabel.fontSize
    r.sameAsBiz = !r.bizLabel || r.bizLabel.fontSize === r.basicLabel.fontSize
    r.screenshot = path.join(outDir, `unify2-${vp.name}.png`)
    await page.screenshot({ path: r.screenshot, fullPage: false })
    r.ok = r.hasName && r.hasPhone && r.hasInsAge && r.noOldPhone && !r.overflow && r.sameAsCar && r.sameAsBiz
  } catch (e) {
    r.errors.push(String(e.stack || e))
    try {
      r.screenshot = path.join(outDir, `unify2-${vp.name}-err.png`)
      await page.screenshot({ path: r.screenshot, fullPage: true })
    } catch {}
  }
  results.push(r)
  await page.close()
}
await browser.close()
fs.writeFileSync(path.join(outDir, 'unify-report2.json'), JSON.stringify(results, null, 2), 'utf8')
console.log(JSON.stringify(results, null, 2))
