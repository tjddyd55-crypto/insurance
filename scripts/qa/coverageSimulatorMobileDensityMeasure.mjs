import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const PATH = '/coverage-simulator-preview/mobile'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(`${BASE}${PATH}`, { waitUntil: 'domcontentloaded', timeout: 60000 })

const cancer = page.getByRole('button', { name: /암 치료/ }).first()
if (await cancer.count()) {
  await cancer.click()
  await page.waitForURL(/\/cancer|\/scenarios\//, { timeout: 30000 })
} else {
  await page.goto(`${BASE}${PATH}/cancer`, { waitUntil: 'domcontentloaded' })
}

await page.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })

const metrics = await page.evaluate(() => {
  const events = [...document.querySelectorAll('.cs-axis-event')]
  const inserts = [...document.querySelectorAll('.cs-axis-insert')]
  const header = document.querySelector('.cs-mobile-editor-header')
  const dock = document.querySelector('.cs-mobile-dock')
  const dockPanel = document.querySelector('.cs-mobile-dock__panel')
  const dockCols = [...document.querySelectorAll('.cs-mobile-dock__column')]
  const colHeader = document.querySelector('.cs-axis-col-header')

  let insertGap = null
  if (events.length >= 2 && inserts.length >= 1) {
    const firstBottom = events[0].getBoundingClientRect().bottom
    const secondTop = events[1].getBoundingClientRect().top
    insertGap = Math.round(secondTop - firstBottom)
  }

  const insertHeight = inserts[0] ? Math.round(inserts[0].getBoundingClientRect().height) : null
  const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : null
  const dockHeight = dock ? Math.round(dock.getBoundingClientRect().height) : null
  const dockPanelHeight = dockPanel ? Math.round(dockPanel.getBoundingClientRect().height) : null
  const dockColumnWidths = dockCols.map((el) => Math.round(el.getBoundingClientRect().width))
  const firstItemTop = events[0] ? Math.round(events[0].getBoundingClientRect().top) : null
  const compareTop = colHeader ? Math.round(colHeader.getBoundingClientRect().top) : null

  const viewportHeight = window.innerHeight
  let visibleItems = 0
  for (const el of events) {
    const r = el.getBoundingClientRect()
    if (r.top < viewportHeight - (dock?.getBoundingClientRect().height ?? 0) && r.bottom > (header?.getBoundingClientRect().bottom ?? 0)) {
      visibleItems += 1
    }
  }

  return {
    insertGapBetweenEvents: insertGap,
    insertElementHeight: insertHeight,
    headerHeight,
    dockHeight,
    dockPanelHeight,
    dockColumnWidths,
    firstCoverageItemTop: firstItemTop,
    compareColumnHeaderTop: compareTop,
    visibleCoverageItemCount: visibleItems,
    totalCoverageItems: events.length,
  }
})

const finalUrl = page.url()
await page.screenshot({ path: 'store-screenshots/coverage-simulator/mobile-header-dock-390.png', fullPage: false })

const page360 = await browser.newPage({ viewport: { width: 360, height: 800 } })
await page360.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page360.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
const metrics360 = await page360.evaluate(() => {
  const header = document.querySelector('.cs-mobile-editor-header')
  const dock = document.querySelector('.cs-mobile-dock')
  const dockPanel = document.querySelector('.cs-mobile-dock__panel')
  const dockCols = [...document.querySelectorAll('.cs-mobile-dock__column')]
  return {
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
    dockHeight: dock ? Math.round(dock.getBoundingClientRect().height) : null,
    dockPanelHeight: dockPanel ? Math.round(dockPanel.getBoundingClientRect().height) : null,
    dockColumnWidths: dockCols.map((el) => Math.round(el.getBoundingClientRect().width)),
  }
})
await page360.screenshot({ path: 'store-screenshots/coverage-simulator/mobile-header-dock-360.png', fullPage: false })
await browser.close()
console.log(JSON.stringify({ viewport: '390x844', url: finalUrl, metrics }, null, 2))
console.log(JSON.stringify({ viewport: '360x800', metrics: metrics360 }, null, 2))
