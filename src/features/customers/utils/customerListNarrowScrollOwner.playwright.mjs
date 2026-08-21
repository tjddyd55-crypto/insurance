/**
 * Playwright: PC narrow window 에서 left 가 실제 scroll owner 인지 검증.
 * usage: node src/features/customers/utils/customerListNarrowScrollOwner.playwright.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const indexCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8')

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
html,body{margin:0;height:100%;}
${indexCss}
.app-workspace-layout-root{display:flex;flex-direction:column;height:100vh;min-height:0;}
.workspace-root.workspace-root--app-pc{flex:1 1 auto;min-height:0;display:flex;overflow:hidden;}
.workspace-main.workspace-main--app{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden;}
.app-main-content{flex:1;min-height:0;}
.pad{height:2400px;background:#ddd;}
</style>
</head>
<body class="pc-root app-workspace-layout-root">
  <div class="workspace-root workspace-root--app-pc">
    <div class="workspace-main workspace-main--app">
      <div class="app-main-content app-main-content--workspace-outlet-host">
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
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({ headless: true })
const widths = [1920, 1100, 960, 820, 700, 520, 400]
const results = []

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 720 } })
  await page.setContent(html, { waitUntil: 'load' })
  const probe = await page.evaluate(async () => {
    const left = document.querySelector('.customer-workspace-layout__left')
    const appMain = document.querySelector('.app-main-content')
    const snap = (el) => ({
      className: el?.className || null,
      overflowY: el ? getComputedStyle(el).overflowY : null,
      scrollTop: el?.scrollTop ?? null,
      scrollHeight: el?.scrollHeight ?? null,
      clientHeight: el?.clientHeight ?? null,
      canScroll: el ? el.scrollHeight > el.clientHeight + 1 : false,
    })

    left.scrollTop = 0
    appMain.scrollTop = 0
    left.scrollTop = 900
    const afterLeft = {
      left: snap(left),
      appMain: snap(appMain),
    }

    // FAB action: scroll left to 0
    const startTop = left.scrollTop
    left.scrollTop = 0
    return {
      afterLeftScroll: afterLeft,
      startTop,
      endTop: left.scrollTop,
      leftIsOwner: afterLeft.left.canScroll && afterLeft.left.scrollTop > 0 && afterLeft.appMain.scrollTop === 0,
      appMainOverflowY: afterLeft.appMain.overflowY,
      leftOverflowY: afterLeft.left.overflowY,
    }
  })

  const pass =
    probe.leftOverflowY === 'auto' &&
    (probe.appMainOverflowY === 'hidden' || probe.appMainOverflowY === 'clip') &&
    probe.leftIsOwner === true &&
    probe.startTop > 0 &&
    probe.endTop === 0

  results.push({ width, pass, ...probe })
  await page.close()
}

await browser.close()
console.log(JSON.stringify({ results }, null, 2))
const failed = results.filter((r) => !r.pass)
assert.equal(failed.length, 0, `narrow owner failed: ${JSON.stringify(failed)}`)
console.log('narrow-scroll-owner PASS')
