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
const report = { A: null, B: null, C: null, D: null, E: null, notes: [], blockers: [] }

async function apiLogin() {
  const body = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) })).json()
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
  return fetch(API + '/customers/' + CID, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ businessInfo }) })
}
async function apiDeleteLoc(token, id) {
  return fetch(API + '/customers/' + CID + '/fire-insurance-locations/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
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

async function gotoCustomer(page) {
  await page.goto(WEB + '/customers?customerId=' + CID, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('이름 / 전화번호 검색').fill('고객사업자화재QA')
  await page.waitForTimeout(1000)
  const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
  await card.waitFor({ timeout: 45000 })
  await card.click({ position: { x: 30, y: 25 } })
  await page.waitForTimeout(600)
  await page.getByText('사업자 정보').first().waitFor({ timeout: 20000 })
  return card
}

async function waitBusinessRead(page) {
  await page.waitForFunction(() => {
    const t = document.body.innerText
    return t.includes('대표자명') || (t.includes('사업자 정보') && !t.includes('불러오는 중…'))
  }, null, { timeout: 30000 })
}

async function openCustomerEdit(page) {
  await gotoCustomer(page)
  await page.getByRole('button', { name: '수정' }).first().click({ force: true })
  await page.waitForFunction(() => {
    const s = [...document.querySelectorAll('.customer-form-section')].find((x) => (x.textContent || '').includes('사업자'))
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

async function fillBusinessMemo(page, text) {
  const biz = page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).first()
  await biz.locator('.field').filter({ hasText: '메모' }).locator('textarea').fill(text)
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

async function waitKakaoFrame(page) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const frame = page.frame({ name: '__kakao__viewerFrame_1' }) || page.frames().find((f) => f.url().includes('postcode.map.kakao'))
    if (frame) {
      try {
        await frame.waitForSelector('#region_name', { timeout: 2000 })
        return frame
      } catch {}
    }
    await page.waitForTimeout(300)
  }
  throw new Error('Kakao frame #region_name not ready')
}

async function selectKakaoAddress(page, query) {
  await page.locator('.address-search-field__dialog').waitFor({ timeout: 10000 })
  const frame = await waitKakaoFrame(page)
  await frame.fill('#region_name', query)
  await frame.click('button.btn_search')
  await page.waitForTimeout(1500)
  // click first result via evaluate for robustness
  const clicked = await frame.evaluate(() => {
    const nodes = [...document.querySelectorAll('button.list_item, .list_item, a.link_post, li .txt_addr, .txt_addr, #region_list li, .result_list li, li')]
    for (const n of nodes) {
      const t = (n.textContent || '').trim()
      if (t.length > 8 && !/검색|예\)|tip|도로명|지역명/.test(t)) {
        n.click()
        return t.slice(0, 100)
      }
    }
    // fallback: any clickable result link
    const a = document.querySelector('a[href="#"] , .link_post, button[onclick]')
    if (a) { a.click(); return (a.textContent || '').trim().slice(0, 100) }
    return null
  })
  if (!clicked) {
    fs.writeFileSync(path.join(SHOT, 'kakao-after-search.html'), (await frame.content()).slice(0, 60000))
    throw new Error('no kakao result to click')
  }
  await page.waitForTimeout(1000)
  return clicked
}

async function main() {
  fs.mkdirSync(SHOT, { recursive: true })
  const token = await apiLogin()
  report.notes.push({
    baselineBeforeUI: {
      businessInfo: (await apiGet(token, '/customers/' + CID)).businessInfo,
      fire: ((await apiGet(token, '/customers/' + CID + '/fire-insurance-locations')).fireInsuranceLocations || []).map((l) => ({ id: l.id, sortOrder: l.sortOrder, address: l.address, memo: l.memo })),
    },
  })

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })).newPage()
  page.setDefaultTimeout(25000)

  try {
    await login(page)

    // A
    try {
      await openCustomerEdit(page)
      const biz = page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).first()
      const evidence = {
        rep: await biz.locator('.field').filter({ hasText: '대표자명' }).locator('input').inputValue(),
        bizNo: await biz.locator('.field').filter({ hasText: '사업자번호' }).locator('input').inputValue(),
        memo: await biz.locator('.field').filter({ hasText: '메모' }).locator('textarea').inputValue(),
        baseAddr: await biz.locator('input[aria-label="기본 주소"]').inputValue(),
        loc1Memo: await page.getByLabel('소재지 1').locator('textarea').inputValue(),
        loc2Memo: await page.getByLabel('소재지 2').locator('textarea').inputValue(),
        loc1Addr: await page.getByLabel('소재지 1').locator('input[aria-label="기본 주소"]').inputValue(),
        loc2Addr: await page.getByLabel('소재지 2').locator('input[aria-label="기본 주소"]').inputValue(),
        saveEnabled: await page.getByRole('button', { name: '저장' }).first().isEnabled(),
      }
      const aOk = evidence.rep.includes(BASELINE_REP) && evidence.bizNo.includes(BASELINE_BIZNO) && evidence.memo.includes(BASELINE_MEMO) &&
        evidence.baseAddr.includes('테스트로') && evidence.loc1Memo.includes('본사') && evidence.loc2Memo.includes('물류창고') &&
        evidence.loc1Addr.includes('화재로') && evidence.loc2Addr.includes('창고로') && evidence.saveEnabled
      report.A = { pass: aOk, evidence, screenshot: await shot(page, 'A-edit-hydrated') }
    } catch (e) {
      report.A = { pass: false, error: String(e), screenshot: await shot(page, 'A-fail').catch(() => null) }
    }

    // B
    try {
      if (!(report.A && report.A.pass)) await openCustomerEdit(page)
      await fillBusinessMemo(page, 'Web Save QA')
      const saveMs = await clickSave(page)
      const apiMemo = (await apiGet(token, '/customers/' + CID)).businessInfo?.memo
      await gotoCustomer(page)
      await waitBusinessRead(page)
      const detailHas = (await page.locator('body').innerText()).includes('Web Save QA')
      report.B = { pass: saveMs < 10000 && apiMemo === 'Web Save QA' && detailHas, evidence: { saveMs, apiMemo, detailHas }, screenshot: await shot(page, 'B-after-save') }
      await openCustomerEdit(page)
      await fillBusinessMemo(page, BASELINE_MEMO)
      const restoreMs = await clickSave(page)
      const restored = (await apiGet(token, '/customers/' + CID)).businessInfo?.memo
      report.B.restore = { restoreMs, memo: restored }
      report.B.pass = Boolean(report.B.pass && restored === BASELINE_MEMO)
    } catch (e) {
      report.B = { pass: false, error: String(e), screenshot: await shot(page, 'B-fail').catch(() => null) }
      await apiPutBusiness(token, { representativeName: BASELINE_REP, businessNumber: BASELINE_BIZNO, businessAddress: BASELINE_ADDR, memo: BASELINE_MEMO })
    }

    // C
    try {
      await openCustomerEdit(page)
      const biz = page.locator('.customer-form-section').filter({ hasText: '사업자 정보' }).first()
      await biz.getByRole('button', { name: '주소 검색' }).click()
      const clicked = await selectKakaoAddress(page, '세종대로 110')
      const newBase = await biz.locator('input[aria-label="기본 주소"]').inputValue()
      const saveMs = await clickSave(page)
      const after = (await apiGet(token, '/customers/' + CID)).businessInfo
      const intact = after?.representativeName === BASELINE_REP && after?.businessNumber === BASELINE_BIZNO && after?.memo === BASELINE_MEMO
      report.C = {
        pass: saveMs < 10000 && (after?.businessAddress || '').length > 5 && after?.businessAddress !== BASELINE_ADDR && intact && newBase.length > 0,
        evidence: { clicked, newBase, apiAddress: after?.businessAddress, intact, saveMs },
        screenshot: await shot(page, 'C-after-address'),
      }
      await apiPutBusiness(token, { representativeName: BASELINE_REP, businessNumber: BASELINE_BIZNO, businessAddress: BASELINE_ADDR, memo: BASELINE_MEMO })
      report.C.restoredAddress = BASELINE_ADDR
    } catch (e) {
      report.C = { pass: false, error: String(e), screenshot: await shot(page, 'C-fail').catch(() => null) }
      report.blockers.push('C: ' + String(e))
      await apiPutBusiness(token, { representativeName: BASELINE_REP, businessNumber: BASELINE_BIZNO, businessAddress: BASELINE_ADDR, memo: BASELINE_MEMO })
    }

    // D
    let loc3Id = null
    try {
      await openCustomerEdit(page)
      await page.getByRole('button', { name: '소재지 추가' }).click()
      const loc3 = page.getByLabel('소재지 3')
      await loc3.waitFor()
      await loc3.getByRole('button', { name: '주소 검색' }).click()
      await selectKakaoAddress(page, '해운대구')
      await loc3.locator('textarea').fill('Web Fire QA')
      const saveMs1 = await clickSave(page)
      let locs = (await apiGet(token, '/customers/' + CID + '/fire-insurance-locations')).fireInsuranceLocations || []
      const loc3row = locs.find((l) => (l.memo || '').includes('Web Fire QA')) || locs.find((l) => l.sortOrder === 2)
      loc3Id = loc3row?.id ?? null
      const d1 = Boolean(loc3row && loc3row.sortOrder === 2)
      await gotoCustomer(page)
      await page.waitForTimeout(1500)
      const reloadShows = (await page.locator('body').innerText()).includes('Web Fire QA')

      await openCustomerEdit(page)
      await page.getByLabel('소재지 3').locator('textarea').fill('Web Fire QA 수정')
      const saveMs2 = await clickSave(page)
      locs = (await apiGet(token, '/customers/' + CID + '/fire-insurance-locations')).fireInsuranceLocations || []
      const d2 = Boolean(locs.find((l) => l.id === loc3Id)?.memo === 'Web Fire QA 수정' && locs.some((l) => l.memo === '본사') && locs.some((l) => l.memo === '물류창고'))

      await openCustomerEdit(page)
      await page.getByLabel('소재지 3').getByRole('button', { name: '삭제' }).click()
      const saveMs3 = await clickSave(page)
      locs = (await apiGet(token, '/customers/' + CID + '/fire-insurance-locations')).fireInsuranceLocations || []
      const d3 = Boolean(!locs.some((l) => l.id === loc3Id) && locs.some((l) => l.memo === '본사') && locs.some((l) => l.memo === '물류창고'))
      const stillCustomer = (await apiGet(token, '/customers/' + CID)).id === CID
      report.D = {
        pass: Boolean(d1 && reloadShows && d2 && d3 && stillCustomer),
        evidence: { saveMs1, saveMs2, saveMs3, loc3Id, d1, reloadShows, d2, d3, stillCustomer, finalLocs: locs.map((l) => ({ id: l.id, sortOrder: l.sortOrder, memo: l.memo, address: l.address })) },
        screenshot: await shot(page, 'D-after-delete'),
      }
    } catch (e) {
      report.D = { pass: false, error: String(e), loc3Id, screenshot: await shot(page, 'D-fail').catch(() => null) }
      report.blockers.push('D: ' + String(e))
      try {
        const locs = (await apiGet(token, '/customers/' + CID + '/fire-insurance-locations')).fireInsuranceLocations || []
        for (const l of locs) if ((l.memo || '').includes('Web Fire QA') || (l.sortOrder ?? 0) >= 2) await apiDeleteLoc(token, l.id)
      } catch {}
    }

    // E
    try {
      await gotoCustomer(page)
      await waitBusinessRead(page)
      const body = await page.locator('.customer-detail-read, body').first().innerText()
      const titles = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.customer-detail-read__section-title, .customer-relations-strip__title')]
        return nodes.map((n) => (n.textContent || '').trim()).filter(Boolean)
      })
      const pos = (re) => body.search(re)
      const order = { driving: pos(/운전여부/), cars: pos(/자동차보험/), relations: pos(/연계 고객/), business: pos(/사업자 정보/), fire: pos(/화재보험/), special: pos(/기념일/), hist: pos(/보험가입내역/), account: pos(/계좌번호/) }
      const eOk =
        order.cars >= 0 && order.relations > order.cars && order.business > order.relations &&
        order.fire > order.business && order.special > order.fire &&
        (order.driving < 0 || order.driving < order.cars) &&
        order.hist > order.special && order.account > order.hist
      report.E = { pass: Boolean(eOk), evidence: { order, titles }, screenshot: await shot(page, 'E-section-order') }
    } catch (e) {
      report.E = { pass: false, error: String(e), screenshot: await shot(page, 'E-fail').catch(() => null) }
    }

    await apiPutBusiness(token, { representativeName: BASELINE_REP, businessNumber: BASELINE_BIZNO, businessAddress: BASELINE_ADDR, memo: BASELINE_MEMO })
    report.finalState = {
      businessInfo: (await apiGet(token, '/customers/' + CID)).businessInfo,
      fire: ((await apiGet(token, '/customers/' + CID + '/fire-insurance-locations')).fireInsuranceLocations || []).map((l) => ({ id: l.id, sortOrder: l.sortOrder, address: l.address, memo: l.memo })),
    }
  } finally {
    await browser.close().catch(() => {})
  }

  const out = path.join(__dirname, 'webPcE2e1342-report.json')
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  console.log('REPORT_PATH=' + out)
}

main().catch((e) => { console.error(e); process.exit(1) })
