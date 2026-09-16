import { chromium } from './node_modules/playwright/index.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'polish-verify-report.json')
const SHOT = path.join(__dirname, 'screenshots', 'polish-verify')
const WEB = 'http://127.0.0.1:3000'
const USER = 'tjddyd55'
const PASS = 'QaBizFire20260910!'
fs.mkdirSync(SHOT, { recursive: true })

async function login(page) {
  await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('input').nth(0).fill(USER)
  await page.locator('input').nth(1).fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
}

async function open1342(page) {
  await page.goto(WEB + '/customers', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForFunction(() => (document.body.innerText || '').includes('고객') || (document.body.innerText || '').includes('검색'), null, { timeout: 60000 })
  const search = page.locator('input[placeholder*="검색"]').first()
  await search.waitFor({ timeout: 30000 })
  await search.fill('01099090910')
  await page.waitForTimeout(1500)
  const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
  await card.waitFor({ timeout: 30000 })
  await card.scrollIntoViewIfNeeded()
  await card.click({ position: { x: 40, y: 28 } })
  await page.waitForTimeout(800)
  const expand = page.getByText('상세 정보 펼치기', { exact: false }).first()
  if (await expand.isVisible().catch(() => false)) {
    await expand.click()
    await page.waitForTimeout(700)
  }
  await page.waitForSelector('#customer-detail-read-basic-info', { state: 'visible', timeout: 30000 })
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const report = { pass: false, checks: {}, errors: [], screenshots: [] }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(page)
  await open1342(page)
  const dShot = path.join(SHOT, 'pc-detail.png')
  await page.screenshot({ path: dShot, fullPage: false })
  report.screenshots.push(dShot)

  report.checks.typography = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: (el.textContent || '').trim().slice(0, 40) }
    }
    return {
      basicLabel: pick('#customer-detail-read-basic-info .customer-detail-read__info-label'),
      basicValue: pick('#customer-detail-read-basic-info .customer-detail-read__info-value'),
      relationsTitle: pick('.customer-relations-strip__title'),
      fireTitle: pick('.customer-fire-location-read-block__title, .customer-fire-location-edit-card__title'),
      special: pick('.customer-special-dates-read__empty, .customer-special-dates-read__memo, .customer-special-date-edit-card__title'),
      consult: pick('.customer-consultation-block__body, .customer-consultation-block__date, .customer-consultation-block'),
    }
  })

  const ind = page.getByRole('button', { name: '개별 연결' }).first()
  report.checks.individualLinkVisible = await ind.isVisible().catch(() => false)
  if (report.checks.individualLinkVisible) {
    await ind.click()
    await page.waitForTimeout(700)
    report.checks.individualLinkOpens = await page.evaluate(() => {
      const t = document.body.innerText || ''
      return t.includes('개별') || !!document.querySelector('[role="dialog"], .ui-modal, .modal, .customer-relations-legacy')
    })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const closer = page.getByRole('button', { name: /닫기|취소/ }).first()
    if (await closer.isVisible().catch(() => false)) await closer.click().catch(() => {})
    await page.waitForTimeout(300)
  }

  await page.getByRole('button', { name: '수정' }).first().click()
  await page.waitForSelector('.customer-edit-form', { timeout: 20000 })
  await page.waitForTimeout(800)
  const eShot = path.join(SHOT, 'pc-edit.png')
  await page.screenshot({ path: eShot, fullPage: false })
  report.screenshots.push(eShot)

  const minBtn = page.getByRole('button', { name: '최소' }).first()
  report.checks.minimizeVisible = await minBtn.isVisible().catch(() => false)
  if (report.checks.minimizeVisible) {
    report.checks.minimizeMeta = await minBtn.evaluate((el) => ({ tag: el.tagName, className: String(el.className || '').slice(0, 180) }))
    const input = page.locator('.customer-edit-form input').first()
    if (await input.count()) {
      const v = await input.inputValue().catch(() => '')
      await input.fill(v + 'Q')
      await page.waitForTimeout(200)
    }
    await minBtn.click()
    await page.waitForTimeout(700)
    const dShot2 = path.join(SHOT, 'pc-discard.png')
    await page.screenshot({ path: dShot2, fullPage: false })
    report.screenshots.push(dShot2)
    report.checks.discardDialog = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button,[role="button"]')].map((b) => (b.textContent || '').trim()).filter(Boolean)
      const body = document.body.innerText || ''
      return {
        hasTitle: body.includes('변경사항 닫기') || body.includes('저장되지 않았습니다'),
        hasSaveAnHam: buttons.some((t) => t === '저장안함' || t.includes('저장안함')),
        hasContinue: buttons.some((t) => t.includes('계속 편집')),
        buttons: buttons.filter((t) => /저장|편집|닫기|취소/.test(t)).slice(0, 12),
      }
    })
    const cont = page.getByRole('button', { name: '계속 편집' }).first()
    if (await cont.isVisible().catch(() => false)) await cont.click()
  }

  const t = report.checks.typography || {}
  report.checks.typoOk = {
    basicLabel16: t.basicLabel?.fontSize === '16px',
    basicValue17: t.basicValue?.fontSize === '17px',
    relationsTitle16: !t.relationsTitle || t.relationsTitle.fontSize === '16px',
    fireTitle16: !t.fireTitle || t.fireTitle.fontSize === '16px',
    consult17: !t.consult || t.consult.fontSize === '17px',
  }

  report.pass = !!(
    report.checks.minimizeVisible &&
    report.checks.discardDialog?.hasSaveAnHam &&
    report.checks.individualLinkVisible &&
    report.checks.individualLinkOpens &&
    report.checks.typoOk.basicLabel16
  )
} catch (e) {
  report.errors.push(String(e && e.stack || e))
} finally {
  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
}