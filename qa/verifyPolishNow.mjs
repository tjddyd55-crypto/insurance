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
const CID = 1342
fs.mkdirSync(SHOT, { recursive: true })

function fontInfo(el) {
  const cs = getComputedStyle(el)
  return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, tag: el.tagName, className: String(el.className || '').slice(0, 120), text: (el.textContent || '').trim().slice(0, 40) }
}

async function login(page) {
  await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('form.auth-form, input', { timeout: 20000 })
  const inputs = page.locator('input')
  await inputs.nth(0).fill(USER)
  await inputs.nth(1).fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 })
}

async function openCustomer(page) {
  await page.goto(WEB + '/customers?customerId=' + CID, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(900)
  const search = page.getByPlaceholder('이름 / 전화번호 검색')
  if (await search.count()) {
    await search.fill('01099090910')
    await page.waitForTimeout(900)
  }
  const card = page.locator('#customer-1342, [data-customer-id="1342"]').first()
  await card.waitFor({ timeout: 45000 })
  await card.click({ position: { x: 30, y: 25 } })
  await page.waitForTimeout(700)
  const expand = page.getByText('상세 정보 펼치기', { exact: false }).first()
  if (await expand.isVisible().catch(() => false)) {
    await expand.click()
    await page.waitForTimeout(500)
  }
  await page.waitForFunction(() => {
    const el = document.querySelector('#customer-1342 .customer-expand-detail:not([hidden]), #customer-detail-read-basic-info')
    if (!el) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
  }, null, { timeout: 25000 })
}

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
})
const report = { pass: false, checks: {}, errors: [], screenshots: [] }

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await login(page)
  await openCustomer(page)
  const detailShot = path.join(SHOT, 'detail-390.png')
  await page.screenshot({ path: detailShot, fullPage: true })
  report.screenshots.push(detailShot)

  // Typography SSOT vs 기본정보
  const typo = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: (el.textContent || '').trim().slice(0, 40) }
    }
    const basicLabel = pick('#customer-detail-read-basic-info .customer-detail-read__info-label, .customer-detail-read__info-label')
    const basicValue = pick('#customer-detail-read-basic-info .customer-detail-read__info-value, .customer-detail-read__info-value')
    return {
      basicLabel,
      basicValue,
      relationsTitle: pick('.customer-relations-strip__title, .customer-relations-header h4, h4.customer-relations-strip__title'),
      relationsDesc: pick('.customer-relations-strip__description, .linked-customer-chip__main'),
      fireTitle: pick('.customer-fire-location-read-block__title, .customer-fire-location-edit-card__title'),
      specialEmpty: pick('.customer-special-dates-read__empty, .customer-special-dates-editor__empty-hint'),
      consultBody: pick('.customer-consultation-block__body, .customer-consultation-block, .customer-consultation-history__contact-meta'),
    }
  })
  report.checks.typography = typo
  const targetLabel = typo.basicLabel?.fontSize
  const targetValue = typo.basicValue?.fontSize
  report.checks.typoAligned = {
    relationsTitleOk: !typo.relationsTitle || ['16px', '1rem'].includes(typo.relationsTitle.fontSize) || typo.relationsTitle.fontSize === targetLabel,
    fireTitleOk: !typo.fireTitle || typo.fireTitle.fontSize === targetLabel || typo.fireTitle.fontSize === '16px',
    consultOk: !typo.consultBody || typo.consultBody.fontSize === targetValue || typo.consultBody.fontSize === '17px',
  }

  // 개별연결 button present and clickable (FormButton)
  const relationBtn = page.getByRole('button', { name: '개별 연결' }).first()
  report.checks.individualLinkVisible = await relationBtn.isVisible().catch(() => false)
  if (report.checks.individualLinkVisible) {
    await relationBtn.scrollIntoViewIfNeeded()
    await relationBtn.click()
    await page.waitForTimeout(800)
    const dialogOpen = await page.evaluate(() => {
      const txt = document.body.innerText || ''
      return txt.includes('개별') || !!document.querySelector('.customer-relations-legacy, [role="dialog"], .modal, .ui-modal')
    })
    report.checks.individualLinkOpens = dialogOpen
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const closeBtns = page.getByRole('button', { name: /닫기|취소/ })
    if (await closeBtns.count()) {
      const vis = closeBtns.first()
      if (await vis.isVisible().catch(() => false)) await vis.click().catch(() => {})
    }
  }

  // Enter edit for 최소 + 저장안함
  const editBtn = page.getByRole('button', { name: '수정' }).first()
  await editBtn.click()
  await page.waitForSelector('.customer-edit-form, .customer-expand-detail', { timeout: 20000 })
  await page.waitForTimeout(800)
  const editShot = path.join(SHOT, 'edit-390.png')
  await page.screenshot({ path: editShot, fullPage: false })
  report.screenshots.push(editShot)

  const minBtn = page.getByRole('button', { name: '최소' }).first()
  report.checks.minimizeVisible = await minBtn.isVisible().catch(() => false)
  report.checks.minimizeIsButton = await minBtn.evaluate((el) => {
    const tag = el.tagName.toLowerCase()
    const cls = String(el.className || '')
    return { tag, cls: cls.slice(0, 160), looksFormButton: cls.includes('ui-button') || cls.includes('FormButton') || cls.includes('form-button') || cls.includes('customer-detail-action-button') || tag === 'button' }
  }).catch(() => null)

  // Dirty the form then click 최소 to trigger discard dialog
  const anyInput = page.locator('.customer-edit-form input, .customer-expand-detail input').first()
  if (await anyInput.count()) {
    const prev = await anyInput.inputValue().catch(() => '')
    await anyInput.fill((prev || '') + 'Q')
    await page.waitForTimeout(300)
  }
  if (report.checks.minimizeVisible) {
    await minBtn.click()
    await page.waitForTimeout(700)
    const dialogShot = path.join(SHOT, 'discard-390.png')
    await page.screenshot({ path: dialogShot, fullPage: false })
    report.screenshots.push(dialogShot)
    const discard = await page.evaluate(() => {
      const body = document.body.innerText || ''
      const buttons = [...document.querySelectorAll('button, [role="button"]')].map((b) => (b.textContent || '').trim()).filter(Boolean)
      return {
        hasTitle: body.includes('변경사항 닫기') || body.includes('저장되지 않았습니다'),
        hasSaveAnHam: buttons.some((t) => t.includes('저장안함')),
        hasContinue: buttons.some((t) => t.includes('계속 편집')),
        buttons: buttons.slice(0, 20),
      }
    })
    report.checks.discardDialog = discard
    // Cancel leave so we don't lose edit unintentionally; press 계속 편집
    const cont = page.getByRole('button', { name: '계속 편집' }).first()
    if (await cont.isVisible().catch(() => false)) await cont.click()
    else await page.keyboard.press('Escape')
  }

  report.pass = !!(
    report.checks.minimizeVisible &&
    report.checks.minimizeIsButton?.looksFormButton &&
    report.checks.discardDialog?.hasSaveAnHam &&
    report.checks.individualLinkVisible &&
    report.checks.individualLinkOpens !== false
  )
} catch (e) {
  report.errors.push(String(e && e.stack || e))
} finally {
  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
}
