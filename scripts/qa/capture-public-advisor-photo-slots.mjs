/**
 * DEV — 대표사진 슬롯 Hero 캡처 (DB theme 변경 없음, 상단 DEV switcher 사용).
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const OUT = join(process.cwd(), 'scripts', 'qa', 'screenshots', 'public-advisor-photo-slots')
mkdirSync(OUT, { recursive: true })

const SWITCH = {
  classic: '1안',
  brand: '2안',
  premium: '3안',
}

const HERO = {
  classic: '.pap-hero--theme-classic',
  brand: '.pap-hero--theme-brand',
  premium: '.pap-hero--theme-premium',
}

async function waitHeroPhoto(page, theme) {
  const sel = `${HERO[theme]} img.pap-hero-photo, ${HERO[theme]} img.pap-hero-brand__photo, ${HERO[theme]} img.pap-hero-premium__photo`
  await page.locator(sel).first().waitFor({ state: 'visible', timeout: 20000 })
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
await page.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'networkidle' })

for (const [file, theme] of [
  ['01-classic-photo-slot.png', 'classic'],
  ['02-brand-photo-slot.png', 'brand'],
  ['03-premium-photo-slot.png', 'premium'],
]) {
  const label = SWITCH[theme]
  await page.getByRole('button', { name: new RegExp(label) }).click()
  await waitHeroPhoto(page, theme)
  await page.locator(HERO[theme]).screenshot({ path: join(OUT, file) })
  console.log('saved', file)
}

const crmUser = process.env.DEV_TEST_USERNAME ?? process.env.QA_ADVISOR_USERNAME ?? 'qa_ai_user'
const crmPass =
  process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? process.env.QA_ADVISOR_PASSWORD ?? '1234'
if (crmUser && crmPass) {
  const crm = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const crmPage = await crm.newPage()
  await crmPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await crmPage.locator('input[autocomplete="username"], input[name="username"]').fill(crmUser)
  await crmPage.locator('input[type="password"]').fill(crmPass)
  await Promise.all([
    crmPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }),
    crmPage.locator('button[type="submit"]').click(),
  ])
  const dismiss = crmPage.getByRole('button', { name: '닫기' }).first()
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click()
  await crmPage.goto(`${BASE}/profile/public-advisor`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await crmPage.locator('.pap-theme-picker').first().waitFor({ timeout: 60000 })
  const picker = crmPage.locator('.pap-theme-picker')
  if (await picker.count()) {
    await picker.screenshot({ path: join(OUT, '04-theme-picker-preview.png') })
    console.log('saved 04-theme-picker-preview.png')
  }
  await crm.close()
} else {
  console.warn('skip CRM picker — set QA_ADVISOR_USERNAME / QA_ADVISOR_PASSWORD')
}

await browser.close()
console.log('OUT', OUT)
