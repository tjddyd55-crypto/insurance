import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHOT = path.join(__dirname, 'screenshots')
const API = 'http://127.0.0.1:3001/backend/api'
const WEB = 'http://127.0.0.1:3000'
const USER = 'tjddyd55'
const PASS = 'QaBizFire20260910!'
const CID = 1342
const BASELINE_MEMO = '경영인 정기보험 상담 예정'
const BASELINE_ADDR = '서울특별시 테스트구 테스트로 10'
const BASELINE_REP = '홍길동'
const BASELINE_BIZNO = '123-45-67890'
const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '412', width: 412, height: 915 },
]
fs.mkdirSync(SHOT, { recursive: true })

const report = {
  viewports: {},
  saveSmoke: null,
  blockers: [],
  finalState: null,
  notes: [],
}

async function apiLogin() {
  const body = await (
    await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASS }),
    })
  ).json()
  if (!body.token) throw new Error('login fail')
  return body.token
}
async function apiGet(token, p) {
  const res = await fetch(API + p, { headers: { Authorization: 'Bearer ' + token } })
  const json = await res.json()
  if (!res.ok) throw new Error(p + ' ' + res.status)
  return json
}
async function apiPutBusiness(token, businessInfo) {
  return fetch(API + '/customers/' + CID, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessInfo }),
  })
}

async function shot(page, name) {
  const fp = path.join(SHOT, name + '.png')
  await page.screenshot({ path: fp, fullPage: true })
  return fp
}

async function login(page) {
  await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('form.auth-form')
  await page.locator('.field').filter({ hasText: '아이디' }).locator('input').fill(USER)
  await page.locator('.field').filter({ hasText: '비밀번호' }).locator('input').fill(PASS)
  await page.locator('button').filter({ hasText: '로그인' }).click()
  await page.waitForFunction(() => !location.pathname.includes('/login'))
}

async function gotoCustomerDetail(page) {
  await page.goto(WEB + '/customers?customerId=' + CID, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('이름 / 전화번호 검색').fill('고객사업자화재QA')
  await page.waitForTimeout(1000)
  const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
  await card.waitFor({ timeout: 45000 })
  await card.click({ position: { x: 30, y: 25 } })
  await page.waitForTimeout(800)
  const expand = page.getByText('고객 정보 펼치기', { exact: false }).first()
  if (await expand.count()) {
    await expand.click({ force: true })
    await page.waitForTimeout(800)
  }
  await page.waitForFunction(() => {
    const t = document.body.innerText
    return (t.includes('사업자 정보') || t.includes('대표자')) && (t.includes('화재') || t.includes('소재지'))
  }, null, { timeout: 25000 })
}

async function ensureDetailExpanded(page) {
  const need = await page.evaluate(() => {
    const t = document.body.innerText
    return !(t.includes('사업자 정보') || t.includes('대표자명'))
  })
  if (need) {
    const expand = page.getByText('고객 정보 펼치기', { exact: false }).first()
    if (await expand.count()) {
      await expand.click({ force: true })
      await page.waitForTimeout(700)
    }
  }
}

async function openEdit(page) {
  await ensureDetailExpanded(page)
  await page.getByRole('button', { name: '수정' }).first().click({ force: true })
  await page.waitForFunction(() => {
    const s = [...document.querySelectorAll('.customer-form-section')].find((x) =>
      (x.textContent || '').includes('사업자'),
    )
    const ta = s && s.querySelector('textarea')
    return ta && !ta.disabled
  }, null, { timeout: 25000 })
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const biz = page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).first()
    const rep = biz.locator('.field').filter({ hasText: '대표자명' }).locator('input')
    if (await rep.count()) {
      if ((await rep.inputValue()).includes('홍길동')) return
    }
    await page.waitForTimeout(300)
  }
}

async function clickSave(page) {
  const t0 = Date.now()
  await page.getByRole('button', { name: '저장' }).first().click({ force: true })
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '저장')
    return !b || !(b.textContent || '').includes('저장 중')
  }, null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
  return Date.now() - t0
}

function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth)
    const clientW = doc.clientWidth
    const overflow = scrollW > clientW + 2
    const offenders = []
    for (const el of document.querySelectorAll('*')) {
      if (!(el instanceof HTMLElement)) continue
      if (el.scrollWidth > clientW + 2) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          offenders.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 80),
            scrollW: el.scrollWidth,
            text: (el.innerText || '').slice(0, 40),
          })
        }
      }
    }
    return { scrollW, clientW, overflow, offenderCount: offenders.length, offenders: offenders.slice(0, 8) }
  })
}

async function checkSectionOrder(page) {
  return page.evaluate(() => {
    const positions = {}
    const body = document.body.innerText
    for (const lab of ['기본', '자동차', '연계', '사업자', '화재', '기념', '상담', '고객업무']) {
      const idx = body.indexOf(lab)
      if (idx >= 0) positions[lab] = idx
    }
    const sections = [...document.querySelectorAll('.customer-form-section, .customer-detail-section, section, [class*="section"]')]
      .map((el) => ({
        top: el.getBoundingClientRect().top + window.scrollY,
        title: (
          el.querySelector('h2,h3,.section-title,.customer-form-section__title') || el
        ).textContent
          ?.trim()
          ?.slice(0, 40),
      }))
      .filter((s) => s.title && s.title.length > 1)
    sections.sort((a, b) => a.top - b.top)
    const titles = sections.map((s) => s.title)
    const idxs = ['사업자', '화재'].map((w) => titles.findIndex((t) => t && t.includes(w)))
    const bizBeforeFire = idxs[0] >= 0 && idxs[1] >= 0 && idxs[0] < idxs[1]
    return {
      positions,
      titles: titles.slice(0, 20),
      bizBeforeFire,
      bodyHasBiz: body.includes('사업자'),
      bodyHasFire: body.includes('화재'),
    }
  })
}

async function checkAddressSearchNotClipped(page) {
  return page.evaluate(() => {
    const biz = [...document.querySelectorAll('.customer-form-section')].find((x) =>
      (x.textContent || '').includes('사업자'),
    )
    if (!biz) return { found: false }
    const btn = [...biz.querySelectorAll('button')].find((b) => /주소|검색|찾기/.test(b.textContent || ''))
    if (!btn) {
      const all = [...biz.querySelectorAll('button')]
      return { found: false, buttons: all.map((b) => b.textContent?.trim()).slice(0, 8) }
    }
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const clipped = r.right > vw + 1 || r.left < -1 || r.width < 8 || r.height < 8
    return {
      found: true,
      label: (btn.textContent || '').trim().slice(0, 40),
      rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
      vw,
      clipped,
    }
  })
}

async function checkLongAddressWrap(page) {
  return page.evaluate(() => {
    const long =
      '서울특별시 테스트구 테스트로 10 아주아주긴주소라인확인용텍스트ABCDEFG1234567890'
    const inputs = [...document.querySelectorAll('input, textarea')]
    const addr = inputs.find((el) => {
      const lab = el.closest('.field')?.textContent || ''
      return lab.includes('주소') || (el.value && el.value.includes('테스트로'))
    })
    if (!addr) return { found: false }
    const prev = addr.value
    addr.value = long
    addr.dispatchEvent(new Event('input', { bubbles: true }))
    const r = addr.getBoundingClientRect()
    const style = getComputedStyle(addr)
    addr.value = prev
    addr.dispatchEvent(new Event('input', { bubbles: true }))
    return {
      found: true,
      tag: addr.tagName,
      whiteSpace: style.whiteSpace,
      overflowX: style.overflowX,
      scrollW: addr.scrollWidth,
      clientW: Math.floor(r.width),
      wrapsOrScrollsLocally: addr.scrollWidth <= window.innerWidth + 2,
    }
  })
}

async function checkTextarea(page) {
  return page.evaluate(() => {
    const biz = [...document.querySelectorAll('.customer-form-section')].find((x) =>
      (x.textContent || '').includes('사업자'),
    )
    const ta = biz && biz.querySelector('textarea')
    if (!ta) return { found: false }
    const r = ta.getBoundingClientRect()
    return {
      found: true,
      disabled: ta.disabled,
      visible: r.width > 0 && r.height > 0,
      height: Math.round(r.height),
      width: Math.round(r.width),
      vw: window.innerWidth,
      withinViewport: r.left >= -2 && r.right <= window.innerWidth + 2,
    }
  })
}

async function checkFireLocations(page) {
  return page.evaluate(() => {
    const fire = [...document.querySelectorAll('.customer-form-section')].find((x) =>
      (x.textContent || '').includes('화재'),
    )
    if (!fire) return { found: false }
    const text = fire.innerText
    const has1 = text.includes('본사') || text.includes('소재지')
    const has2 = text.includes('물류창고') || (text.match(/소재지/g) || []).length >= 2
    return { found: true, hasLocHints: has1 && has2, snippet: text.slice(0, 200) }
  })
}

async function runViewport(browser, vp, doSave) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  })
  const page = await context.newPage()
  const result = { viewport: vp, checks: {}, screenshots: [], pass: true, errors: [], notes: [] }
  try {
    await login(page)
    await gotoCustomerDetail(page)
    result.screenshots.push(await shot(page, 'mobile-' + vp.name + '-detail'))
    const detailOrder = await checkSectionOrder(page)
    const detailOverflow = await measureOverflow(page)
    result.checks.detailOrder = detailOrder
    result.checks.detailOverflow = detailOverflow

    await openEdit(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    result.screenshots.push(await shot(page, 'mobile-' + vp.name + '-edit-top'))

    await page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).first().scrollIntoViewIfNeeded()
    result.screenshots.push(await shot(page, 'mobile-' + vp.name + '-edit-business'))
    result.checks.addressSearch = await checkAddressSearchNotClipped(page)
    result.checks.longAddress = await checkLongAddressWrap(page)
    result.checks.textarea = await checkTextarea(page)

    try {
      await page.locator('.customer-form-section').filter({ hasText: '화재보험' }).first().scrollIntoViewIfNeeded()
    } catch {
      await page.locator('.customer-form-section').filter({ hasText: '화재' }).first().scrollIntoViewIfNeeded()
    }
    result.screenshots.push(await shot(page, 'mobile-' + vp.name + '-edit-fire'))
    result.checks.fire = await checkFireLocations(page)
    result.checks.editOrder = await checkSectionOrder(page)
    result.checks.editOverflow = await measureOverflow(page)

    const fail = (msg) => {
      result.pass = false
      result.errors.push(msg)
    }
    if (!detailOrder.bodyHasBiz || !detailOrder.bodyHasFire) fail('detail missing business/fire sections')
    if (!result.checks.editOrder.bodyHasBiz || !result.checks.editOrder.bodyHasFire) fail('edit missing business/fire')
    if (detailOverflow.overflow) fail('detail horizontal overflow scrollW=' + detailOverflow.scrollW)
    if (result.checks.editOverflow.overflow) fail('edit horizontal overflow scrollW=' + result.checks.editOverflow.scrollW)
    if (!result.checks.addressSearch.found) fail('address search button not found')
    else if (result.checks.addressSearch.clipped) fail('address search button clipped')
    if (!result.checks.textarea.found || !result.checks.textarea.visible || !result.checks.textarea.withinViewport)
      fail('textarea not OK')
    if (!result.checks.fire.found || !result.checks.fire.hasLocHints) fail('2+ fire locations not visible')
    if (!result.checks.longAddress.found) fail('address field not found for wrap check')
    else if (!result.checks.longAddress.wrapsOrScrollsLocally) fail('long address causes page-level overflow risk')

    if (doSave) {
      const biz = page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).first()
      await biz.scrollIntoViewIfNeeded()
      const memoField = biz.locator('.field').filter({ hasText: '메모' }).locator('textarea')
      await memoField.fill('Mobile Web QA ' + vp.name)
      const saveMs = await clickSave(page)
      const token = await apiLogin()
      const detail = await apiGet(token, '/customers/' + CID)
      const apiMemo = detail.businessInfo?.memo
      const saveOk = apiMemo === 'Mobile Web QA ' + vp.name
      await apiPutBusiness(token, {
        representativeName: BASELINE_REP,
        businessNumber: BASELINE_BIZNO,
        businessAddress: BASELINE_ADDR,
        memo: BASELINE_MEMO,
      })
      try {
        await openEdit(page)
        await memoField.fill(BASELINE_MEMO)
        await clickSave(page)
      } catch (e) {
        result.notes.push('UI restore skipped: ' + e.message)
      }
      result.checks.saveSmoke = { saveMs, apiMemo, saveOk }
      report.saveSmoke = result.checks.saveSmoke
      if (!saveOk) fail('save smoke failed apiMemo=' + apiMemo)
      if (saveMs > 15000) fail('save too slow ' + saveMs)
    }
  } catch (e) {
    result.pass = false
    result.errors.push(String((e && e.stack) || e))
  }
  await context.close()
  return result
}

async function main() {
  const token = await apiLogin()
  const before = await apiGet(token, '/customers/' + CID)
  report.notes.push({
    baselineBefore: { businessInfo: before.businessInfo, fire: before.fireInsuranceLocations },
  })

  const browser = await chromium.launch({ headless: true })
  for (const vp of VIEWPORTS) {
    const doSave = vp.name === '390'
    console.log('Running viewport', vp.name, 'save=', doSave)
    const r = await runViewport(browser, vp, doSave)
    report.viewports[vp.name] = r
    console.log('viewport', vp.name, 'pass=', r.pass, 'errors=', r.errors)
    if (!r.pass) report.blockers.push(...r.errors.map((e) => vp.name + ': ' + e))
  }
  await browser.close()

  let final = await apiGet(await apiLogin(), '/customers/' + CID)
  if (final.businessInfo?.memo !== BASELINE_MEMO) {
    await apiPutBusiness(await apiLogin(), {
      representativeName: BASELINE_REP,
      businessNumber: BASELINE_BIZNO,
      businessAddress: BASELINE_ADDR,
      memo: BASELINE_MEMO,
    })
    final = await apiGet(await apiLogin(), '/customers/' + CID)
  }
  report.finalState = { businessInfo: final.businessInfo, fire: final.fireInsuranceLocations }
  report.allPass = Object.values(report.viewports).every((v) => v.pass) && report.blockers.length === 0
  fs.writeFileSync(path.join(__dirname, 'mobileWeb-report.json'), JSON.stringify(report, null, 2), 'utf8')
  console.log('WROTE mobileWeb-report.json allPass=', report.allPass)
  if (!report.allPass) process.exitCode = 1
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
