import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const PATH = '/coverage-simulator-preview/mobile'

async function collectMetrics(page) {
  return page.evaluate(() => {
    const events = [...document.querySelectorAll('.cs-axis-event')]
    const inserts = [...document.querySelectorAll('.cs-axis-insert')]
    const markers = [...document.querySelectorAll('.cs-axis-marker')]
    const header = document.querySelector('.cs-mobile-editor-header')
    const dock = document.querySelector('.cs-mobile-dock')

    const insertHeight = inserts[0] ? Math.round(inserts[0].getBoundingClientRect().height) : null
    const plus = document.querySelector('.cs-axis-insert__plus')
    const plusSize = plus ? Math.round(plus.getBoundingClientRect().width) : null

    let itemToItemGap = null
    let amountToInsertGap = null
    let insertToNextTitleGap = null
    if (events.length >= 1 && inserts.length >= 1) {
      const ev = events[0]
      const ins = inserts[0]
      const compare = ev.querySelector('.cs-axis-event__compare')
      const next = events[1]
      if (compare) {
        amountToInsertGap = Math.round(ins.getBoundingClientRect().top - compare.getBoundingClientRect().bottom)
      }
      if (next) {
        const nextTitle = next.querySelector('.cs-axis-event__head')
        itemToItemGap = Math.round(next.getBoundingClientRect().top - ev.getBoundingClientRect().bottom)
        if (nextTitle) {
          insertToNextTitleGap = Math.round(nextTitle.getBoundingClientRect().top - ins.getBoundingClientRect().bottom)
        }
      }
    }

    let markerHeight = null
    let markerGapAbove = null
    let markerGapBelow = null
    if (markers[0]) {
      const m = markers[0]
      markerHeight = Math.round(m.getBoundingClientRect().height)
      const idx = inserts.findIndex((ins) => {
        const r = ins.getBoundingClientRect()
        return r.top > m.getBoundingClientRect().top
      })
      const insBefore = [...inserts].filter((ins) => ins.getBoundingClientRect().bottom <= m.getBoundingClientRect().top).pop()
      const insAfter = inserts.find((ins) => ins.getBoundingClientRect().top >= m.getBoundingClientRect().bottom)
      if (insBefore) {
        markerGapAbove = Math.round(m.getBoundingClientRect().top - insBefore.getBoundingClientRect().bottom)
      }
      if (insAfter) {
        markerGapBelow = Math.round(insAfter.getBoundingClientRect().top - m.getBoundingClientRect().bottom)
      }
    }

    const viewportHeight = window.innerHeight
    let visibleItems = 0
    for (const el of events) {
      const r = el.getBoundingClientRect()
      if (
        r.top < viewportHeight - (dock?.getBoundingClientRect().height ?? 0) &&
        r.bottom > (header?.getBoundingClientRect().bottom ?? 0)
      ) {
        visibleItems += 1
      }
    }

    return {
      insertVisualHeight: insertHeight,
      insertPlusSize: plusSize,
      itemToItemTotalGap: itemToItemGap,
      amountRowToInsertGap: amountToInsertGap,
      insertToNextTitleGap,
      timeMarkerBlockHeight: markerHeight,
      timeMarkerGapAbove: markerGapAbove,
      timeMarkerGapBelow: markerGapBelow,
      visibleCoverageItemCount: visibleItems,
      totalCoverageItems: events.length,
    }
  })
}

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

const metrics390 = await collectMetrics(page)
const finalUrl = page.url()
await page.screenshot({ path: 'store-screenshots/coverage-simulator/mobile-timeline-spacing-390.png', fullPage: false })

const page360 = await browser.newPage({ viewport: { width: 360, height: 800 } })
await page360.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page360.waitForSelector('[data-testid="coverage-scenario-editor"]', { timeout: 30000 })
const metrics360 = await collectMetrics(page360)
await page360.screenshot({ path: 'store-screenshots/coverage-simulator/mobile-timeline-spacing-360.png', fullPage: false })

await browser.close()

console.log(
  JSON.stringify(
    {
      url: finalUrl,
      beforeReference: {
        insertVisualHeight: 16,
        note: 'pre-refine deploy (1e376bc9) insert layout height',
      },
      after: { viewport390: metrics390, viewport360: metrics360 },
    },
    null,
    2,
  ),
)
