import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT = path.join(__dirname, 'screenshots', 'polish')
const API = 'http://127.0.0.1:3001/backend/api'
const WEB = 'http://127.0.0.1:3000'
const USER = 'tjddyd55'
const PASS = 'QaBizFire20260910!'
const CID = 1342
const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '412', width: 412, height: 915 },
]
fs.mkdirSync(SHOT, { recursive: true })
const report = { viewports: {}, pc: null, blockers: [], notes: [] }

async function apiLogin() {
  const body = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) })).json()
  if (!body.token) throw new Error('login fail')
  return body.token
}

async function login(page) {
  await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('form.auth-form')
  await page.locator('.field').filter({ hasText: '아이디' }).locator('input').fill(USER)
  await page.locator('.field').filter({ hasText: '비밀번호' }).locator('input').fill(PASS)
  await page.locator('button').filter({ hasText: '로그인' }).click()
  await page.waitForFunction(() => !location.pathname.includes('/login'))
}

async function openCustomer(page) {
  await page.goto(WEB + '/customers?customerId=' + CID, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('이름 / 전화번호 검색').fill('고객사업자화재QA')
  await page.waitForTimeout(900)
  const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
  await card.waitFor({ timeout: 45000 })
  await card.click({ position: { x: 30, y: 25 } })
  await page.waitForTimeout(700)
  const expand = page.getByText('고객 정보 펼치기', { exact: false }).first()
  if (await expand.isVisible().catch(() => false)) {
    await expand.click()
    await page.waitForTimeout(500)
  }
  return card
}

async function openEdit(page) {
  await page.getByRole('button', { name: '수정' }).first().click()
  await page.waitForSelector('.customer-edit-form', { timeout: 20000 })
  await page.waitForTimeout(600)
}

async function checkViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const out = { viewport: vp, checks: {}, screenshots: [], errors: [], pass: true }
  try {
    await login(page)
    await openCustomer(page)
    const dShot = path.join(SHOT, `mobile-${vp.name}-detail.png`)
    await page.screenshot({ path: dShot, fullPage: true })
    out.screenshots.push(dShot)
    out.checks.actionsOnlyToolbar = (await page.locator('.customer-detail-toolbar--actions-only').count()) > 0
    out.checks.phoneSmsInSummary = (await page.locator('a[aria-label="전화 걸기"]').count()) > 0
    const overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }))
    out.checks.detailOverflow = { ...overflow, overflow: overflow.scrollW > overflow.clientW + 1 }

    await openEdit(page)
    const tShot = path.join(SHOT, `mobile-${vp.name}-edit-top.png`)
    await page.screenshot({ path: tShot, fullPage: false })
    out.screenshots.push(tShot)
    await page.getByText('사업자 정보', { exact: true }).first().scrollIntoViewIfNeeded()
    const bShot = path.join(SHOT, `mobile-${vp.name}-edit-business.png`)
    await page.screenshot({ path: bShot, fullPage: false })
    out.screenshots.push(bShot)
    await page.getByText('화재보험 정보', { exact: true }).first().scrollIntoViewIfNeeded()
    const fShot = path.join(SHOT, `mobile-${vp.name}-edit-fire.png`)
    await page.screenshot({ path: fShot, fullPage: false })
    out.screenshots.push(fShot)

    const fireSnippet = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('.customer-fire-locations-editor, .customer-form-section')].find((el) => (el.textContent || '').includes('화재보험 정보'))
      return sec ? sec.innerText.slice(0, 400) : ''
    })
    out.checks.fire = {
      hasLocHeader: /소재지\s*1/.test(fireSnippet) && fireSnippet.includes('삭제'),
      addAtBottom: fireSnippet.includes('+ 소재지 추가'),
      snippet: fireSnippet.replace(/\s+/g, ' ').slice(0, 220),
    }
    out.checks.fireHeaderRow = await page.evaluate(() => {
      const header = document.querySelector('.customer-fire-location-edit-card__header')
      if (!header) return null
      const title = header.querySelector('.customer-fire-location-edit-card__title')
      const btn = header.querySelector('button')
      if (!title || !btn) return null
      const tr = title.getBoundingClientRect()
      const br = btn.getBoundingClientRect()
      const tc = (tr.top + tr.bottom) / 2; const bc = (br.top + br.bottom) / 2; return { sameRow: Math.abs(tc - bc) < 14, titleLeftOfBtn: tr.left < br.left, delta: Math.abs(tc - bc) }
    })
    const addBtn = page.locator('.customer-fire-locations-editor__add').first()
    out.checks.addButtonVisible = await addBtn.isVisible()
    const addBox = await addBtn.boundingBox()
    out.checks.addButtonFullish = !!(addBox && addBox.width >= vp.width * 0.7)
    out.checks.noWrapOffenders = await page.evaluate(() => {
      const sels = ['.customer-form-section__title', '.customer-fire-location-edit-card__title', '.customer-fire-locations-editor__add', '.customer-detail-action-button']
      const offenders = []
      for (const sel of sels) {
        for (const el of document.querySelectorAll(sel)) {
          const style = getComputedStyle(el)
          if (style.whiteSpace !== 'nowrap' && el.scrollHeight > el.clientHeight + 2) offenders.push({ sel, text: (el.textContent || '').trim().slice(0, 40) })
        }
      }
      return offenders.slice(0, 8)
    })
    const editOverflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }))
    out.checks.editOverflow = { ...editOverflow, overflow: editOverflow.scrollW > editOverflow.clientW + 1 }
    const cancel = page.getByRole('button', { name: '취소' }).first()
    if (await cancel.isVisible()) await cancel.click()
    if (!out.checks.actionsOnlyToolbar) out.errors.push('missing actions-only toolbar')
    if (!out.checks.fire?.hasLocHeader) out.errors.push('fire header missing')
    if (!out.checks.fire?.addAtBottom) out.errors.push('add CTA missing')
    if (!out.checks.fireHeaderRow?.sameRow) out.errors.push('소재지/삭제 not same row')
    if (out.checks.detailOverflow.overflow || out.checks.editOverflow.overflow) out.errors.push('horizontal overflow')
    if (out.checks.noWrapOffenders.length) out.errors.push('wrap offenders')
    out.pass = out.errors.length === 0
  } catch (e) {
    out.pass = false
    out.errors.push(String(e && e.stack ? e.stack : e))
  } finally {
    await context.close()
  }
  return out
}

async function checkPc(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const out = { checks: {}, screenshots: [], errors: [], pass: true }
  try {
    await login(page)
    await openCustomer(page)
    const d = path.join(SHOT, 'pc-detail.png')
    await page.screenshot({ path: d, fullPage: true })
    out.screenshots.push(d)
    await openEdit(page)
    await page.getByText('화재보험 정보', { exact: true }).first().scrollIntoViewIfNeeded()
    const f = path.join(SHOT, 'pc-edit-fire.png')
    await page.screenshot({ path: f, fullPage: false })
    out.screenshots.push(f)
    out.checks.addLabel = (await page.locator('.customer-fire-locations-editor__add').innerText()).trim()
    out.checks.actionsOnly = (await page.locator('.customer-detail-toolbar--actions-only').count()) > 0
    if (out.checks.addLabel !== '+ 소재지 추가') out.errors.push('pc add label')
    if (!out.checks.actionsOnly) out.errors.push('pc actions-only toolbar')
    out.pass = out.errors.length === 0
  } catch (e) {
    out.pass = false
    out.errors.push(String(e && e.stack ? e.stack : e))
  } finally {
    await context.close()
  }
  return out
}

const browser = await chromium.launch({ headless: true })
try {
  await apiLogin()
  for (const vp of VIEWPORTS) {
    report.viewports[vp.name] = await checkViewport(browser, vp)
    if (!report.viewports[vp.name].pass) report.blockers.push('mobile-' + vp.name)
  }
  report.pc = await checkPc(browser)
  if (!report.pc.pass) report.blockers.push('pc')
} finally {
  await browser.close()
}
const outPath = path.join(__dirname, 'uiPolish-report.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
console.log(JSON.stringify({ blockers: report.blockers, pcPass: report.pc?.pass, mobile: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { pass: v.pass, errors: v.errors }])) }, null, 2))
console.log('wrote', outPath)
