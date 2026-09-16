import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/workspace/insurance-prod-push/qa/basic-fields'
fs.mkdirSync(outDir, { recursive: true })

const loginUser = 'tjddyd55'
const loginPass = 'QaBizFire20260910!'
const bases = ['http://127.0.0.1:3000', 'http://127.0.0.1:3001']

async function login(page, base) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(800)
  // try common login fields
  const user = page.locator('input[name="username"], input[name="email"], input[type="text"], input[autocomplete="username"]').first()
  const pass = page.locator('input[type="password"]').first()
  if (await user.count()) {
    await user.fill(loginUser)
    await pass.fill(loginPass)
    const submit = page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("Login")').first()
    await submit.click()
    await page.waitForTimeout(2500)
  }
  return page.url()
}

async function openCustomers(page, base) {
  // try direct routes
  const candidates = [
    base + '/customers',
    base + '/app/customers',
    base + '/workspace/customers',
  ]
  for (const url of candidates) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null)
    await page.waitForTimeout(1200)
    if (page.url().includes('customer') || (await page.locator('text=고객').count()) > 0) {
      return page.url()
    }
  }
  // click nav
  const nav = page.locator('a:has-text("고객"), button:has-text("고객")').first()
  if (await nav.count()) {
    await nav.click()
    await page.waitForTimeout(1500)
  }
  return page.url()
}

async function expandCustomer(page) {
  // search for QA customer if search exists
  const search = page.locator('input[placeholder*="검색"], input[aria-label*="검색"]').first()
  if (await search.count()) {
    await search.fill('고객사업자화재QA')
    await page.waitForTimeout(1000)
  }
  // click a customer card / row
  const card = page.locator('text=고객사업자화재QA').first()
  if (await card.count()) {
    await card.click()
    await page.waitForTimeout(1500)
  } else {
    // fallback first expand
    const any = page.locator('.customer-expand-summary, [class*="customer-card"]').first()
    if (await any.count()) await any.click()
    await page.waitForTimeout(1500)
  }
  // ensure mobile info expanded if button present
  const expandBtn = page.locator('button:has-text("고객 정보 펼치기")')
  if (await expandBtn.count()) {
    await expandBtn.click()
    await page.waitForTimeout(800)
  }
}

function collectLabels(html) {
  const labels = []
  const re = /customer-detail-read__info-label[^>]*>([^<]+)</g
  let m
  while ((m = re.exec(html))) labels.push(m[1].replace(':', '').trim())
  return labels
}

async function checkViewport(browser, base, name, size) {
  const page = await browser.newPage({ viewport: size })
  const result = { base, name, size, urlAfterLogin: null, urlCustomers: null, labels: [], hasBasicSection: false, hasName: false, hasPhone: false, hasInsAge: false, overflowSuspect: false, screenshot: null, errors: [] }
  try {
    result.urlAfterLogin = await login(page, base)
    result.urlCustomers = await openCustomers(page, base)
    await expandCustomer(page)
    await page.waitForTimeout(1000)
    const basic = page.locator('#customer-detail-read-basic-info')
    result.hasBasicSection = (await basic.count()) > 0
    const html = result.hasBasicSection ? await basic.innerHTML() : await page.content()
    result.labels = collectLabels(html)
    result.hasName = result.labels.includes('이름') || html.includes('>이름:<')
    result.hasPhone = result.labels.includes('연락처') || html.includes('>연락처:<')
    result.hasInsAge = result.labels.includes('보험나이') || html.includes('>보험나이:<')
    // overflow heuristic: check basic section scrollWidth
    if (result.hasBasicSection) {
      const box = await basic.boundingBox()
      const metrics = await basic.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight }))
      result.overflowSuspect = metrics.sw > metrics.cw + 2
      result.metrics = metrics
      result.box = box
    }
    const shot = path.join(outDir, `${name}-${size.width}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    result.screenshot = shot
  } catch (e) {
    result.errors.push(String(e && e.stack ? e.stack : e))
    try {
      const shot = path.join(outDir, `${name}-${size.width}-error.png`)
      await page.screenshot({ path: shot, fullPage: true })
      result.screenshot = shot
    } catch {}
  }
  await page.close()
  return result
}

const browser = await chromium.launch({ headless: true })
const viewports = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 'm412', width: 412, height: 915 },
]
const results = []
for (const base of bases) {
  for (const vp of viewports) {
    results.push(await checkViewport(browser, base, `${base.includes('3001') ? '3001' : '3000'}-${vp.name}`, { width: vp.width, height: vp.height }))
  }
}
await browser.close()
const out = path.join(outDir, 'web-report.json')
fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf8')
console.log(JSON.stringify(results.map(r => ({
  base: r.base, name: r.name, hasBasicSection: r.hasBasicSection, hasName: r.hasName, hasPhone: r.hasPhone, hasInsAge: r.hasInsAge,
  overflowSuspect: r.overflowSuspect, labels: r.labels.slice(0, 15), urlAfterLogin: r.urlAfterLogin, urlCustomers: r.urlCustomers, errors: r.errors
})), null, 2))
console.log('wrote', out)
