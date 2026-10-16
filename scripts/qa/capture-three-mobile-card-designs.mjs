import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const QA_USERNAME = process.env.QA_ADVISOR_USERNAME ?? 'qa_ai_user'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'three-mobile-card-designs')
mkdirSync(OUT, { recursive: true })

async function setTheme(theme) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL required for theme switching')
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
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()

const heroSel = {
  classic: '.pap-hero--theme-classic',
  brand: '.pap-hero--theme-brand',
  premium: '.pap-hero--theme-premium',
}

for (const [file, theme] of [
  ['01-classic-hero.png', 'classic'],
  ['02-brand-hero.png', 'brand'],
  ['03-premium-hero.png', 'premium'],
]) {
  await setTheme(theme)
  await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
  await page.locator(heroSel[theme]).screenshot({ path: join(OUT, file) })
  console.log('saved', file)
}

await setTheme('classic')

const crm = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const crmPage = await crm.newPage()
await crmPage.goto(`${BASE}/profile/public-advisor`, { waitUntil: 'networkidle' })
if (await crmPage.locator('.pap-theme-picker').count()) {
  await crmPage.locator('.pap-theme-picker').screenshot({ path: join(OUT, '04-theme-picker.png') })
  console.log('saved 04-theme-picker.png')
} else {
  console.warn('theme picker not visible (login required)')
}

await browser.close()
console.log('OUT', OUT)
