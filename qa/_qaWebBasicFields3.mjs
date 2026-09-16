import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/workspace/insurance-prod-push/qa/basic-fields'
fs.mkdirSync(outDir, { recursive: true })
const base = 'http://127.0.0.1:3000'

async function login(page) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(800)
  if (page.url().includes('/customers')) return
  const pass = page.locator('input[type="password"]').first()
  if (!(await pass.count())) return
  const inputs = page.locator('input')
  const n = await inputs.count()
  for (let i = 0; i < n; i++) {
    const t = await inputs.nth(i).getAttribute('type')
    if (t !== 'password') {
      await inputs.nth(i).fill('tjddyd55')
      break
    }
  }
  await pass.fill('QaBizFire20260910!')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(2500)
}

async function openAndExpand(page) {
  await page.goto(base + '/customers', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)
  const search = page.locator('input[placeholder*="검색"], input[aria-label*="검색"]').first()
  if (await search.count()) {
    await search.fill('고객사업자화재QA')
    await page.waitForTimeout(1500)
  }
  const card = page.locator('text=고객사업자화재QA').first()
  if (await card.count()) await card.click({ force: true })
  else await page.locator('.customer-expand-summary').first().click({ force: true })
  await page.waitForTimeout(2000)
  const expandBtn = page.locator('button:has-text("고객 정보 펼치기")')
  if (await expandBtn.count() && await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click()
    await page.waitForTimeout(1000)
  }
  await page.waitForSelector('#customer-detail-read-basic-info', { timeout: 20000 })
}

function labelsFrom(html) {
  const out = []
  const re = /customer-detail-read__info-label[^>]*>([^<]+)</g
  let m
  while ((m = re.exec(html))) out.push(m[1].replace(/:$/, '').trim())
  return out
}

const viewports = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 'm412', width: 412, height: 915 },
]

const browser = await chromium.launch({ headless: true })
const results = []
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  const result = { name: vp.name, width: vp.width, ok: false, labels: [], errors: [] }
  try {
    await login(page)
    await openAndExpand(page)
    // hard reload once to ensure latest module
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    // re-expand after reload
    const card = page.locator('text=고객사업자화재QA').first()
    if (await card.count()) await card.click({ force: true })
    await page.waitForTimeout(1500)
    const expandBtn = page.locator('button:has-text("고객 정보 펼치기")')
    if (await expandBtn.count() && await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click()
      await page.waitForTimeout(800)
    }
    await page.waitForSelector('#customer-detail-read-basic-info', { timeout: 20000 })
    const basic = page.locator('#customer-detail-read-basic-info')
    const html = await basic.innerHTML()
    result.labels = labelsFrom(html)
    const orderWanted = ['이름','연락처','주민번호','상령일','보험나이','문자 수신','통신사','주소','키/몸무게']
    const filtered = []
    for (const l of result.labels) {
      if (orderWanted.includes(l) || l.startsWith('직업') || l === '운전여부' || l === '유입 경로') filtered.push(l)
    }
    result.filtered = filtered
    result.orderPrefixOk = orderWanted.every((l, i) => filtered[i] === l)
    const metrics = await basic.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    result.metrics = metrics
    result.overflowSuspect = metrics.sw > metrics.cw + 2
    const rows = basic.locator('.customer-detail-read__info-row')
    const n = Math.min(await rows.count(), 10)
    const boxes = []
    for (let i = 0; i < n; i++) boxes.push(await rows.nth(i).boundingBox())
    let overlap = false
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i-1], b = boxes[i]
      if (a && b && b.y < a.y + a.height - 1) overlap = true
    }
    result.overlap = overlap
    result.hasName = filtered.includes('이름')
    result.hasPhone = filtered.includes('연락처')
    result.hasInsAge = filtered.includes('보험나이')
    result.noOldPhone = !html.includes('핸드폰번호')
    result.screenshot = path.join(outDir, `web3-${vp.name}.png`)
    await basic.screenshot({ path: result.screenshot })
    result.ok = result.orderPrefixOk && result.hasName && result.hasPhone && result.hasInsAge && !result.overflowSuspect && !result.overlap && result.noOldPhone
  } catch (e) {
    result.errors.push(String(e.stack || e))
    try { result.screenshot = path.join(outDir, `web3-${vp.name}-err.png`); await page.screenshot({ path: result.screenshot }) } catch {}
  }
  results.push(result)
  await page.close()
}
await browser.close()
fs.writeFileSync(path.join(outDir, 'web-report3.json'), JSON.stringify(results, null, 2), 'utf8')
console.log(JSON.stringify(results, null, 2))
