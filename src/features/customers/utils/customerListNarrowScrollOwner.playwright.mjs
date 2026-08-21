/**
 * Playwright: PC narrow / menu breakpoint 에서 left 가 실제 scroll owner 인지 검증.
 * - direct child
 * - intermediate outlet wrap (높이 체인 단절 회귀)
 * - 1024/1023 menu breakpoint 전후
 *
 * usage: node src/features/customers/utils/customerListNarrowScrollOwner.playwright.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const indexCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8')
const navCss = readFileSync(
  new URL('../../../components/layout/pc-top-navigation.css', import.meta.url),
  'utf8',
)

function buildHtml(withOutletWrap) {
  const workspace = `
        <div class="customer-workspace-layout user-page user-page--full-bleed">
          <aside class="customer-workspace-layout__left">
            <main class="customers-page customers-page--pc">
              <section class="list-section customer-list-panel">
                <div class="pad" id="tall"></div>
                <button type="button" class="customer-list-scroll-top-button">↑</button>
              </section>
            </main>
          </aside>
          <section class="customer-workspace-layout__right"><div style="height:100%">right</div></section>
        </div>`
  const body = withOutletWrap ? `<div class="outlet-wrap">${workspace}</div>` : workspace
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
html,body{margin:0;height:100%;}
${indexCss}
${navCss}
.app-workspace-layout-root{display:flex;flex-direction:column;height:100vh;min-height:0;}
.workspace-root.workspace-root--app-pc{flex:1 1 auto;min-height:0;display:flex;overflow:hidden;}
.workspace-main.workspace-main--app{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden;}
.app-main-content{flex:1;min-height:0;}
.pad{height:2400px;background:#ddd;}
</style>
</head>
<body class="pc-root app-workspace-layout-root">
  <header class="app-workspace-chrome-header header pc-workspace-header pc-workspace-header--navigation-only">
    <nav class="pc-top-navigation"><div class="pc-top-navigation__bar"><div class="pc-top-navigation__groups">
      <button type="button" class="pc-top-navigation__group">고객관리</button>
    </div></div></nav>
  </header>
  <div class="workspace-root workspace-root--app-pc">
    <div class="workspace-main workspace-main--app">
      <div class="app-main-content app-main-content--workspace-outlet-host">${body}</div>
    </div>
  </div>
</body>
</html>`
}

const browser = await chromium.launch({ headless: true })
const widths = [1920, 1100, 1024, 1023, 960, 820, 700, 520, 400]
const results = []

for (const withOutletWrap of [false, true]) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 720 } })
    await page.setContent(buildHtml(withOutletWrap), { waitUntil: 'load' })
    const probe = await page.evaluate(() => {
      const left = document.querySelector('.customer-workspace-layout__left')
      const appMain = document.querySelector('.app-main-content')
      const nav = document.querySelector('.pc-top-navigation')
      const snap = (el) => ({
        overflowY: el ? getComputedStyle(el).overflowY : null,
        scrollTop: el?.scrollTop ?? null,
        scrollHeight: el?.scrollHeight ?? null,
        clientHeight: el?.clientHeight ?? null,
        canScroll: el ? el.scrollHeight > el.clientHeight + 1 : false,
      })

      left.scrollTop = 0
      appMain.scrollTop = 0
      left.scrollTop = 900
      const leftSnap = snap(left)
      const appSnap = snap(appMain)
      const startTop = left.scrollTop
      left.scrollTop = 0
      return {
        navDisplay: nav ? getComputedStyle(nav).display : null,
        left: leftSnap,
        appMain: appSnap,
        startTop,
        endTop: left.scrollTop,
        leftIsOwner: leftSnap.canScroll && leftSnap.scrollTop > 0 && appSnap.scrollTop === 0,
      }
    })

    const pass =
      probe.left.overflowY === 'auto' &&
      (probe.appMain.overflowY === 'hidden' || probe.appMain.overflowY === 'clip') &&
      probe.leftIsOwner === true &&
      probe.startTop > 0 &&
      probe.endTop === 0

    results.push({ width, withOutletWrap, pass, ...probe })
    await page.close()
  }
}

await browser.close()
console.log(JSON.stringify({ results }, null, 2))
const failed = results.filter((r) => !r.pass)
assert.equal(failed.length, 0, `narrow owner failed: ${JSON.stringify(failed, null, 2)}`)
console.log('narrow-scroll-owner PASS', { total: results.length })
