import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const QA_USERNAME = process.env.QA_ADVISOR_USERNAME ?? 'qa_ai_user'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'mobile-fc-themes')
mkdirSync(OUT, { recursive: true })

async function setTheme(theme) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn(`skip DB theme=${theme} (no DATABASE_URL)`)
    return
  }
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await pool.query(
    `
    UPDATE advisor_public_profiles p
    SET profile_theme = $1, updated_at = NOW()
    FROM users u
    WHERE p.user_id = u.id AND u.username = $2
    `,
    [theme, QA_USERNAME],
  )
  await pool.end()
  console.log('theme set', theme)
}

const browser = await chromium.launch({ headless: true })

async function captureTheme(theme) {
  await setTheme(theme)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
  const heroSel =
    theme === 'classic'
      ? '.pap-hero--theme-classic'
      : theme === 'brand'
        ? '.pap-hero--theme-brand'
        : '.pap-hero--theme-premium'
  await page.locator(heroSel).screenshot({ path: join(OUT, `${theme}-hero.png`) })
  await page.screenshot({ path: join(OUT, `${theme}-full.png`), fullPage: true })
  console.log('saved', `${theme}-hero.png`, `${theme}-full.png`)
  await ctx.close()
}

for (const theme of ['classic', 'brand', 'premium']) {
  await captureTheme(theme)
}

const crmCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const crmPage = await crmCtx.newPage()
await crmPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
console.warn('CRM theme-selector screenshot: log in manually or set storage — skipping automated CRM capture without credentials')
await crmPage.goto(`${BASE}/profile/public-advisor`, { waitUntil: 'networkidle' })
if (await crmPage.locator('.pap-theme-picker').count()) {
  await crmPage.locator('.pap-theme-picker').screenshot({ path: join(OUT, 'theme-selector-crm.png') })
  console.log('saved theme-selector-crm.png')
}
await crmCtx.close()

await browser.close()
console.log('OUT', OUT)
