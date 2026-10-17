/**
 * Development integration QA — mobile card (switcher, contacts, hero visibility, OG).
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const SLUG = process.env.QA_PUBLIC_ADVISOR_SLUG ?? 'qa-public-advisor-dev'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const EXPECT_SHA = process.env.EXPECT_GIT_SHA ?? ''

const report = {
  ancestry: null,
  railwaySha: null,
  public: {},
  contacts: {},
  heroVisibility: {},
  og: {},
  tsc: 'skipped',
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function dismissBlockingModals(page) {
  await page.waitForTimeout(400)
  const closeBtn = page
    .locator('.customer-ui-modal-backdrop button, .notification-login-modal button')
    .filter({ hasText: /닫기|확인|나중에|다음에|건너/ })
  if (await closeBtn.count()) {
    await closeBtn.first().click({ timeout: 5000 }).catch(() => {})
  } else {
    await page.keyboard.press('Escape').catch(() => {})
  }
  await page.locator('.customer-ui-modal-backdrop').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
}

async function measureOg(theme) {
  const url = `${BASE}/api/public/advisors/${SLUG}/og-card.png`
  const t0 = Date.now()
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const ms = Date.now() - t0
  const buf = Buffer.from(await res.arrayBuffer())
  let sizeOk = false
  if (res.ok && buf.length > 1000) {
    const meta = await sharp(buf).metadata()
    sizeOk = meta.width === 1200 && meta.height === 630 && meta.format === 'png'
  }
  return {
    ok: res.ok && sizeOk,
    ms,
    bytes: buf.length,
    fallback: res.headers.get('x-advisor-og-photo-fallback'),
    totalMs: res.headers.get('x-advisor-og-total-ms'),
  }
}

const version = await fetch(`${BASE}/version.json`).then((r) => r.json())
report.railwaySha = version.gitCommitSha
if (EXPECT_SHA) {
  report.ancestry = version.gitCommitSha?.startsWith(EXPECT_SHA.slice(0, 8)) ? 'PASS' : 'FAIL'
}

const browser = await chromium.launch({ headless: true })
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
const mPage = await mobile.newPage()
await mPage.goto(`${BASE}/fc/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await mPage.locator('.pap-hero').first().waitFor({ timeout: 45000 })
report.public = await mPage.evaluate(() => {
  const devThemeBar = document.querySelector('.pap-dev-theme-review')
  const hero = document.querySelector('.pap-fc-card--hero, .pap-hero')
  return {
    devThemeBarAbsent: !devThemeBar,
    heroTopPx: hero ? Math.round(hero.getBoundingClientRect().top) : null,
    designReviewText: document.body.innerText.includes('디자인 확인'),
  }
})

const desktop = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await desktop.newPage()
await login(page)
await page.goto(`${BASE}/profile/mobile-card`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.locator('h1').first().waitFor({ timeout: 45000 })
await dismissBlockingModals(page)

const phone = '010-9999-8888'
const fax = '02-111-2222'
const email = 'test@example.com'

async function enableContactField(label) {
  const field = page.locator('.pap-hero-editor-field').filter({ hasText: label })
  const input = field.locator('input').first()
  if (await input.isDisabled()) {
    await field.getByRole('button', { name: '노출' }).click()
  }
}

for (const label of ['전화번호', '팩스번호', '이메일 주소']) {
  await enableContactField(label)
}
await page.getByPlaceholder('010-1234-5678').fill(phone)
await page.getByPlaceholder('02-1234-5678').fill(fax)
await page.getByPlaceholder('example@email.com').fill(email)

const addCustom = page.getByRole('button', { name: '+ 추가정보 추가' })
if (await addCustom.count()) {
  await addCustom.click()
  await addCustom.click()
}
const rows = page.locator('.pap-custom-contacts-editor__row')
if (await rows.count()) {
  await rows.nth(0).getByPlaceholder('인스타그램').fill('인스타그램')
  await rows.nth(0).getByPlaceholder('https://...').fill('https://instagram.com/test')
  if (await rows.count() > 1) {
    await rows.nth(1).getByPlaceholder('인스타그램').fill('블로그')
    await rows.nth(1).getByPlaceholder('https://...').fill('https://blog.naver.com/test')
  }
}

const saveBtn = page.locator('form.pap-editor-form .pap-cta-row button').filter({ hasText: '저장' })
await saveBtn.scrollIntoViewIfNeeded()
const patchRes = await Promise.all([
  page.waitForResponse(
    (r) => r.url().includes('/api/me/public-profile') && r.request().method() === 'PATCH',
    { timeout: 90000 },
  ),
  saveBtn.click(),
]).then(([res]) => res).catch(async () => {
  await page.getByText('저장되었습니다.', { exact: false }).waitFor({ timeout: 90000 })
  return { status: 200 }
})
report.contacts.patchStatus = typeof patchRes.status === 'function' ? patchRes.status() : patchRes.status
await page.waitForTimeout(1200)
await page.reload({ waitUntil: 'domcontentloaded' })
await dismissBlockingModals(page)
report.contacts.reload = {
  phone: await page.getByPlaceholder('010-1234-5678').inputValue(),
  fax: await page.getByPlaceholder('02-1234-5678').inputValue(),
  email: await page.getByPlaceholder('example@email.com').inputValue(),
}

await mPage.reload({ waitUntil: 'domcontentloaded' })
await mPage.locator('.pap-hero').first().waitFor({ timeout: 45000 })
report.contacts.public = await mPage.evaluate(() => {
  const tel = [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'))
  const mail = [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href'))
  const urls = [...document.querySelectorAll('a[href^="http"]')].map((a) => ({
    href: a.getAttribute('href'),
    text: a.textContent?.trim(),
  }))
  return { tel, mail, urls }
})

const heroField = page.locator('.pap-hero-editor-field').first()
const heroToggle = heroField.locator('.pap-hero-editor-field__toggle')
await heroToggle.click()
await page.waitForTimeout(400)
const hiddenText = await page.locator('.pap-editor-live-preview__scroll .pap-hero').innerText()
await heroToggle.click()
await page.waitForTimeout(400)
report.heroVisibility = {
  previewAfterHideEyebrow: hiddenText,
  noDevBarInPreview: await page.evaluate(() => !document.querySelector('.pap-dev-theme-review')),
}

for (const [theme, label] of [
  ['classic', '기본형'],
  ['brand', '브랜드형'],
  ['premium', '프리미엄형'],
]) {
  await page.locator('.pap-theme-picker__card', { hasText: label }).click()
  await saveBtn.click()
  await page.waitForTimeout(2000)
  report.og[theme] = await measureOg(theme)
}

const html = await fetch(`${BASE}/fc/${SLUG}`).then((r) => r.text())
report.ogMeta = {
  hasOgImage: html.includes('/og-card.png'),
  hasCanonical: html.includes('rel="canonical"'),
}

await browser.close()
console.log(JSON.stringify(report, null, 2))
