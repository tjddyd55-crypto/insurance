import { chromium } from 'playwright'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'

const EYEBROW = 'ONE FC TEST'
const TITLE = '박성용 FC TEST'
const SUBTITLE = '영진에셋 · 테스트팀장'

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function dismissBlockingModals(page) {
  await page.waitForTimeout(400)
  const closeBtn = page.locator('.customer-ui-modal-backdrop button').filter({ hasText: /닫기|확인|나중/ })
  if (await closeBtn.count()) await closeBtn.first().click().catch(() => {})
  await page.locator('.customer-ui-modal-backdrop').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
}

const report = { checks: {}, patchStatus: null }

const browser = await chromium.launch({ headless: true })
const desktop = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await desktop.newPage()

page.on('response', (res) => {
  if (res.url().includes('public-profile') && res.request().method() === 'PATCH') {
    report.patchStatus = res.status()
  }
})

await login(page)
await dismissBlockingModals(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await dismissBlockingModals(page)
await page.locator('h1').first().waitFor({ timeout: 45000 })

const heroSection = page.locator('h2.pap-editor-section-title', { hasText: 'Hero 표시 문구' })
await heroSection.locator('xpath=following::label[1]/input').fill(EYEBROW)
await heroSection.locator('xpath=following::label[2]/input').fill(TITLE)
await heroSection.locator('xpath=following::label[3]/input').fill(SUBTITLE)
await page.waitForTimeout(400)

const liveText = await page.locator('.pap-editor-live-preview__scroll').innerText()
report.checks.livePreviewRealtime =
  liveText.includes(EYEBROW) && liveText.includes(TITLE) && liveText.includes(SUBTITLE)

const radiusCheck = async (themeLabel) => {
  await page.locator('.pap-theme-picker__card', { hasText: themeLabel }).click()
  await page.waitForTimeout(350)
  return page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        '.pap-editor-live-preview__scroll .pap-hero-photo-wrap, .pap-editor-live-preview__scroll .pap-hero-brand__photo-ring, .pap-editor-live-preview__scroll .pap-hero-premium__media, .pap-editor-live-preview__scroll .pap-hero-portrait-slot',
      ),
    ]
    const radii = nodes.map((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0)
    return { maxRadius: radii.length ? Math.max(...radii) : -1, count: nodes.length }
  })
}

report.checks.radiusClassic = (await radiusCheck('기본형')).maxRadius === 0
report.checks.radiusBrand = (await radiusCheck('브랜드형')).maxRadius === 0
report.checks.radiusPremium = (await radiusCheck('프리미엄형')).maxRadius === 0

const premiumMetrics = await page.evaluate(() => {
  const media = document.querySelector('.pap-editor-live-preview__scroll .pap-hero-premium__media')
  if (!media) return null
  const rect = media.getBoundingClientRect()
  const style = getComputedStyle(media)
  return {
    aspectRatio: style.aspectRatio,
    height: Math.round(rect.height),
  }
})
report.checks.premiumTaller = premiumMetrics?.aspectRatio === '3 / 4' && (premiumMetrics?.height ?? 0) > 200

const cardMetrics = await page.evaluate(() => {
  const tile = document.querySelector('.pap-editor-live-preview__scroll .pap-business-card-tile')
  const section = document.querySelector('.pap-editor-live-preview__scroll .pap-section--business-card')
  if (!tile || !section) return { hasCard: false }
  const t = tile.getBoundingClientRect()
  const s = section.getBoundingClientRect()
  const img = tile.querySelector('img, .pap-business-card-img')
  const fit = img ? getComputedStyle(img).objectFit : null
  return {
    hasCard: true,
    widthRatio: s.width > 0 ? Math.round((t.width / s.width) * 100) / 100 : 0,
    aspect: t.height > 0 ? Math.round((t.width / t.height) * 100) / 100 : 0,
    objectFit: fit,
  }
})
report.checks.cardFullWidth = cardMetrics.hasCard && cardMetrics.widthRatio >= 0.92 && cardMetrics.aspect === 1.8

const sticky = await page.evaluate(() => {
  const cta = document.querySelector('.pap-editor-live-preview__scroll .pap-sticky-cta')
  const frame = document.querySelector('.pap-editor-live-preview__scroll')
  if (!cta || !frame) return { ok: false }
  const c = cta.getBoundingClientRect()
  const f = frame.getBoundingClientRect()
  return {
    ok: c.bottom <= f.bottom + 4 && c.left >= f.left - 2 && c.right <= f.right + 2,
    position: getComputedStyle(cta).position,
  }
})
report.checks.stickyInside = sticky.ok && sticky.position === 'sticky'

const publishOn = page.locator('.pap-editor-toolbar input[type="checkbox"]').first()
if (!(await publishOn.isChecked())) await publishOn.click({ force: true })
await dismissBlockingModals(page)
await page.locator('form.pap-editor-form .pap-cta-row button').filter({ hasText: '저장' }).click()
await page.waitForTimeout(3000)
report.checks.patchSave = report.patchStatus === 200

await page.reload({ waitUntil: 'domcontentloaded' })
await dismissBlockingModals(page)
await page.locator('h1').first().waitFor({ timeout: 45000 })

const afterReload = await page.evaluate(
  ({ EYEBROW, TITLE, SUBTITLE }) => {
    const section = document.querySelector('h2.pap-editor-section-title')
    const inputs = [...document.querySelectorAll('h2.pap-editor-section-title')]
      .find((h) => h.textContent?.includes('Hero 표시 문구'))
      ?.parentElement?.querySelectorAll('label input') ?? []
    const vals = [...inputs].map((i) => i.value)
    return {
      eyebrow: vals[0] ?? '',
      title: vals[1] ?? '',
      subtitle: vals[2] ?? '',
      match: vals[0] === EYEBROW && vals[1] === TITLE && vals[2] === SUBTITLE,
    }
  },
  { EYEBROW, TITLE, SUBTITLE },
)
report.checks.reloadHeroFields = afterReload.match

const apiRes = await fetch(`${BASE}/api/public/advisors/${encodeURIComponent(SLUG)}`)
const api = apiRes.ok ? await apiRes.json() : {}
report.checks.publicApiHero =
  apiRes.ok && api.heroDisplayTitle === TITLE && api.heroDisplaySubtitle === SUBTITLE

const ownerRes = await page.request.get(`${BASE}/api/me/public-profile`)
const ownerJson = ownerRes.ok() ? await ownerRes.json() : {}
const p = ownerJson.profile ?? {}
report.checks.dbColumns =
  ownerRes.ok() &&
  typeof p.hero_display_eyebrow === 'string' &&
  typeof p.hero_display_title === 'string' &&
  typeof p.hero_display_subtitle === 'string'

const pub = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const pubPage = await pub.newPage()

await pubPage.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await pubPage.locator('.pap-hero').first().waitFor({ timeout: 45000 })
const pubText = await pubPage.locator('.pap-hero').innerText()
report.checks.publicPageMatch = pubText.includes(TITLE) && pubText.includes(SUBTITLE)

await heroSection.locator('xpath=following::label[1]/input').fill('')
await heroSection.locator('xpath=following::label[2]/input').fill('')
await heroSection.locator('xpath=following::label[3]/input').fill('')
await page.waitForTimeout(300)
const fallbackText = await page.locator('.pap-editor-live-preview__scroll .pap-hero').innerText()
report.checks.fallbackNoEmpty =
  !fallbackText.includes('undefined') &&
  !fallbackText.includes('null') &&
  fallbackText.trim().length > 0

const narrow = await browser.newContext({ viewport: { width: 1000, height: 800 } })
const narrowPage = await narrow.newPage()
await login(narrowPage)
await dismissBlockingModals(narrowPage)
await narrowPage.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded' })
const narrowLayout = await narrowPage.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  preview: document.querySelector('.pap-editor-layout__preview')
    ? getComputedStyle(document.querySelector('.pap-editor-layout__preview')).display
    : 'none',
}))
report.checks.responsive = !narrowLayout.overflow && narrowLayout.preview === 'none'

await browser.close()
console.log(JSON.stringify(report, null, 2))
