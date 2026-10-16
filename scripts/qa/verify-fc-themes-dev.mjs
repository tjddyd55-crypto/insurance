import pg from 'pg'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const QA_USERNAME = process.env.QA_ADVISOR_USERNAME ?? 'qa_ai_user'

const HERO = {
  classic: '.pap-hero--theme-classic',
  brand: '.pap-hero--theme-brand',
  premium: '.pap-hero--theme-premium',
}

async function setTheme(theme) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL required')
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

async function fetchApiTheme() {
  const res = await fetch(`${BASE}/api/public/advisors/${SLUG}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  return data.profileTheme
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const page = await ctx.newPage()

const results = []
for (const theme of ['classic', 'brand', 'premium']) {
  await setTheme(theme)
  await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })
  const apiTheme = await fetchApiTheme()
  const heroVisible = await page.locator(HERO[theme]).count()
  results.push({ theme, apiTheme, heroVisible, ok: apiTheme === theme && heroVisible === 1 })
}

await browser.close()
console.log(JSON.stringify({ base: BASE, slug: SLUG, results }, null, 2))
if (!results.every((r) => r.ok)) process.exit(1)
