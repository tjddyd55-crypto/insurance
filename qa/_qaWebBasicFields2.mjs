import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/workspace/insurance-prod-push/qa/basic-fields'
fs.mkdirSync(outDir, { recursive: true })
const base = 'http://127.0.0.1:3000'
const loginUser = 'tjddyd55'
const loginPass = 'QaBizFire20260910!'

async function login(page) {
  await page.goto(base + '/login', { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
    await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 45000 })
  })
  await page.waitForTimeout(500)
  if (page.url().includes('/customers')) return
  const user = page.locator('input[type="password"]').locator('xpath=preceding::input[not(@type="password")][1]')
  const pass = page.locator('input[type="password"]').first()
  if (await pass.count()) {
    const userCandidates = [
      page.locator('input[name="username"]'),
      page.locator('input[name="loginId"]'),
      page.locator('input[autocomplete="username"]'),
      page.locator('input[type="text"]').first(),
      page.locator('input:not([type="password"])').first(),
    ]
    for (const c of userCandidates) {
      if (await c.count()) { await c.fill(loginUser); break }
    }
    await pass.fill(loginPass)
    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/customers|workspace|home|dashboard|\//, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1500)
  }
}

async function openAndExpand(page) {
  await page.goto(base + '/customers', { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)
  const search = page.locator('input[placeholder*="검색"], input[aria-label*="검색"]').first()
  if (await search.count()) {
    await search.fill('고객사업자화재QA')
    await page.waitForTimeout(1200)
  }
  const card = page.locator('text=고객사업자화재QA').first()
  if (await card.count()) {
    await card.click({ force: true })
  } else {
    await page.locator('.customer-expand-summary').first().click({ force: true })
  }
  await page.waitForTimeout(1800)
  const expandBtn = page.locator('button:has-text("고객 정보 펼치기")')
  if (await expandBtn.count() && await expandBtn.isVisible()) {
    await expandBtn.click()
    await page.waitForTimeout(800)
  }
  await page.locator('#customer-detail-read-basic-info').waitFor({ state: 'visible', timeout: 15000 })
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
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, bypassCSP: true })
  await context.route('**/*', (route) => route.continue())
  const page = await context.newPage()
  const result = { name: vp.name, width: vp.width, ok: false, labels: [], overflowSuspect: false, errors: [] }
  try {
    await login(page)
    await openAndExpand(page)
    const basic = page.locator('#customer-detail-read-basic-info')
    const html = await basic.innerHTML()
    result.labels = labelsFrom(html)
    result.hasName = result.labels[0] === '이름' || result.labels.includes('이름')
    result.hasPhone = result.labels.includes('연락처')
    result.hasSsn = result.labels.includes('주민번호')
    result.hasMaturity = result.labels.includes('상령일')
    result.hasInsAge = result.labels.includes('보험나이')
    result.noOldPhoneLabel = !html.includes('핸드폰번호')
    const orderWanted = ['이름','연락처','주민번호','상령일','보험나이','문자 수신','통신사','주소','키/몸무게']
    const filtered = result.labels.filter((l) => orderWanted.includes(l) || l.startsWith('직업') || l === '운전여부' || l === '유입 경로')
    result.filtered = filtered
    result.orderPrefixOk = orderWanted.every((l, i) => filtered[i] === l)
    const metrics = await basic.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    result.metrics = metrics
    result.overflowSuspect = metrics.sw > metrics.cw + 2
    // check overlap of first few rows
    const rows = basic.locator('.customer-detail-read__info-row')
    const n = Math.min(await rows.count(), 8)
    const boxes = []
    for (let i = 0; i < n; i++) {
      boxes.push(await rows.nth(i).boundingBox())
    }
    result.rowBoxes = boxes
    let overlap = false
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1], b = boxes[i]
      if (a && b && b.y < a.y + a.height - 1) overlap = true
    }
    result.overlap = overlap
    const shot = path.join(outDir, `web-${vp.name}.png`)
    await page.screenshot({ path: shot, fullPage: false })
    result.screenshot = shot
    result.ok = result.hasName && result.hasPhone && result.hasInsAge && result.hasMaturity && result.orderPrefixOk && !result.overflowSuspect && !result.overlap && result.noOldPhoneLabel
  } catch (e) {
    result.errors.push(String(e.stack || e))
    try { result.screenshot = path.join(outDir, `web-${vp.name}-err.png`); await page.screenshot({ path: result.screenshot, fullPage: true }) } catch {}
  }
  results.push(result)
  await context.close()
}
await browser.close()
fs.writeFileSync(path.join(outDir, 'web-report2.json'), JSON.stringify(results, null, 2), 'utf8')
console.log(JSON.stringify(results, null, 2))
