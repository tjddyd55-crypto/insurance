import pg from 'pg'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function setTheme(theme) {
  await pool.query(
    `UPDATE advisor_public_profiles p SET profile_theme = $1, updated_at = NOW()
     FROM users u WHERE p.user_id = u.id AND u.username = 'qa_ai_user'`,
    [theme],
  )
}

function rect(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
}

const viewports = [
  { label: '390', width: 390, height: 844 },
  { label: '1280', width: 1280, height: 900 },
]

const browser = await chromium.launch({ headless: true })

for (const vp of viewports) {
const page = await (await browser.newContext({ viewport: { width: vp.width, height: vp.height } })).newPage()

for (const theme of ['classic', 'brand', 'premium']) {
  await setTheme(theme)
  await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
  const data = await page.evaluate(() => {
    const hero = document.querySelector('header.pap-fc-card--hero')
    const home = document.querySelector('.pap-home-sections')
    const intro = document.querySelector('.pap-section--intro')
    const gallery = document.querySelector('.pap-section--gallery')
    const facts = document.querySelector('.pap-section--facts')
    const r = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }
    }
    const children = home
      ? [...home.children].map((c) => ({
          className: c.className,
          rect: r(c),
        }))
      : []
    return {
      hero: r(hero),
      home: r(home),
      intro: r(intro),
      gallery: r(gallery),
      facts: r(facts),
      gapIntroGallery: intro && gallery ? Math.round(gallery.getBoundingClientRect().top - intro.getBoundingClientRect().bottom) : null,
      homeChildCount: children.length,
      children,
      shellPadBottom: home?.parentElement
        ? getComputedStyle(home.parentElement).paddingBottom
        : null,
    }
  })
  console.log(vp.label, theme, JSON.stringify(data, null, 2))
}
}

await browser.close()
await pool.end()
