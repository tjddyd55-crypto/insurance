import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USER = process.env.COVERAGE_BINDER_QA_USER
const PASS = process.env.COVERAGE_BINDER_QA_PASS

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${BASE}/login`)
await page.locator('input[autocomplete="username"], input[name="username"]').first().fill(USER)
await page.locator('input[type="password"]').first().fill(PASS)
await page.getByRole('button', { name: /로그인|login/i }).click()
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 120000 })
await page.goto(`${BASE}/coverage-simulator/cerebrovascular/new`, { waitUntil: 'domcontentloaded' })
await page.getByTestId('coverage-view-mode-option3').click()
await page.waitForTimeout(500)

const info = await page.evaluate(() => {
  const row = document.querySelector('.cs-alt-row--option3')
  const head = document.querySelector('.cs-alt-view--option3 .cs-alt-grid__head')
  if (!row || !head) return { err: 'no row' }
  const rowKids = [...row.children].map((el) => ({
    tag: el.tagName,
    cls: el.className,
    gc: getComputedStyle(el).gridColumn,
    pos: getComputedStyle(el).position,
    x: el.getBoundingClientRect().x,
  }))
  const headKids = [...head.children].map((el) => ({
    cls: el.className,
    x: el.getBoundingClientRect().x,
  }))
  const view = document.querySelector('.cs-alt-view--option3')
  let hasOption3Css = false
  try {
    for (const sheet of document.styleSheets) {
      let rules
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of rules) {
        if (rule.cssText?.includes('--coverage-option3-columns')) hasOption3Css = true
      }
    }
  } catch {
    /* ignore */
  }
  return {
    hasView: Boolean(view),
    rowDisplay: getComputedStyle(row).display,
    headDisplay: getComputedStyle(head).display,
    rowTemplate: getComputedStyle(row).gridTemplateColumns,
    headTemplate: getComputedStyle(head).gridTemplateColumns,
    hasOption3Css,
    rowKids,
    headKids,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
