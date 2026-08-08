/**
 * GA_ADMIN 렌더 메뉴 순회 QA (Playwright)
 * - 렌더된 PC top / dashboard / mobile drawer 메뉴만 클릭
 * - 권한 없음 / 403 페이지 / CRM 메뉴 잔존 = 0
 *
 * Usage: node scripts/qa/gaAdminMenuNoDeny.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import fs from 'node:fs'

const BASE = process.argv[2] || 'https://insurance-dev.up.railway.app'
const USER = 'yjadmin'
const PASS = '1111'

const DENY_MARKERS = [
  '권한이 없습니다',
  '접근 권한이 없습니다',
  '프로필은 일반 설계사(USER) 계정에서만',
  'Access Denied',
  '403 Forbidden',
]

const CRM_MENU_LABELS = [
  '고객리스트',
  '고객관리',
  '오늘의 TA',
  '할일 및 알림',
  '신청서 작성',
  '원수사소식지',
  '원수사 연락처',
  '공유 계정',
  '문자 발송',
  '팀원리스트',
  '팀 관리',
  '내정보관리',
]

async function uiLogin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

function isDeniedText(text) {
  return DENY_MARKERS.some((m) => text.includes(m))
}

async function collectDashboardLinks(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  return page.evaluate(() => {
    const shell = document.querySelector('.dashboard-menu-shell') || document.querySelector('main')
    if (!shell) return []
    return [...shell.querySelectorAll('button, a')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 40)
  })
}

async function collectPcTopMenuItems(page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  const groupBtns = page.locator('.pc-top-navigation__group')
  const n = await groupBtns.count()
  const items = []
  for (let i = 0; i < n; i++) {
    const btn = groupBtns.nth(i)
    const group = ((await btn.textContent()) || '').replace(/\s+/g, ' ').trim()
    await btn.click()
    await page.waitForTimeout(200)
    const labels = await page.locator('.pc-top-navigation__item-label').allTextContents()
    for (const label of labels) {
      const t = label.replace(/\s+/g, ' ').trim()
      if (t) items.push({ group, label: t })
    }
  }
  const hasBell = (await page.locator('.pc-top-navigation').locator('text=🔔').count()) > 0
  return { items, hasBell, groupCount: n }
}

async function clickPcMenuAndCheck(page, label) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const groupBtns = page.locator('.pc-top-navigation__group')
  const n = await groupBtns.count()
  for (let i = 0; i < n; i++) {
    await groupBtns.nth(i).click()
    await page.waitForTimeout(150)
    const item = page.locator('.pc-top-navigation__item', { hasText: label }).first()
    if ((await item.count()) > 0) {
      await item.click()
      await page.waitForTimeout(700)
      const body = await page.evaluate(() => (document.body?.innerText || '').slice(0, 4000))
      return {
        label,
        path: new URL(page.url()).pathname,
        denied: isDeniedText(body),
        snippet: body.slice(0, 220).replace(/\s+/g, ' '),
      }
    }
  }
  return { label, skipped: true, reason: 'not-found-in-top-nav' }
}

async function collectMobileDrawer(page) {
  const context = page.context()
  // force coarse pointer so useIsMobile matches real phones
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => {
        const q = String(query)
        const matches =
          q.includes('pointer: coarse') ||
          (q.includes('max-width: 768px') && q.includes('pointer: coarse'))
            ? true
            : window.matchMedia?.toString?.().includes('native')
              ? false
              : false
        // simplistic: treat max-width+coarse as mobile
        const isMobileQuery = q.includes('max-width') && q.includes('pointer: coarse')
        return {
          matches: isMobileQuery ? true : false,
          media: q,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }
      },
    })
  })
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const burger = page.locator('button[aria-label="메뉴 열기"], button.menu-btn').first()
  if (await burger.count()) {
    await burger.click()
    await page.waitForTimeout(400)
  }
  const links = await page.evaluate(() => {
    const drawer = document.querySelector('.mobile-workspace-drawer__nav')
    if (!drawer) return { drawerPresent: false, labels: [] }
    return {
      drawerPresent: true,
      labels: [...drawer.querySelectorAll('button, a')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    }
  })
  return links
}

const version = await (await fetch(BASE + '/version.json?t=' + Date.now(), { cache: 'no-store' })).json()
const health = await (await fetch(BASE + '/backend/health?t=' + Date.now(), { cache: 'no-store' })).json()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await uiLogin(page)
const landing = new URL(page.url()).pathname

const pc = await collectPcTopMenuItems(page)
const dashboardLabels = await collectDashboardLinks(page)

const clickResults = []
for (const item of pc.items) {
  clickResults.push(await clickPcMenuAndCheck(page, item.label))
}

const mobileCtx = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 844 },
})
const mobilePage = await mobileCtx.newPage()
await uiLogin(mobilePage)
const mobile = await collectMobileDrawer(mobilePage)
await mobileCtx.close()
await browser.close()

const deniedClicks = clickResults.filter((r) => r.denied)
const crmOnPc = pc.items.filter((i) => CRM_MENU_LABELS.some((c) => i.label.includes(c)))
const crmOnDash = dashboardLabels.filter((l) => CRM_MENU_LABELS.some((c) => l.includes(c)))
const crmOnMobile = (mobile.labels || []).filter((l) => CRM_MENU_LABELS.some((c) => l.includes(c)))

const report = {
  base: BASE,
  buildId: version.buildId,
  health,
  landing,
  pc,
  dashboardLabels,
  mobile,
  clickResults,
  assert: {
    landingOk: landing === '/admin/claim/insurance-companies',
    noCrmPc: crmOnPc.length === 0,
    noCrmDash: crmOnDash.length === 0,
    noCrmMobile: crmOnMobile.length === 0,
    noDeniedMenuClicks: deniedClicks.length === 0,
    noNotificationBell: pc.hasBell === false,
    hasClaimSettings: pc.items.some((i) => i.label.includes('보험청구')),
    hasNewsletter: pc.items.some((i) => i.label.includes('소식지')),
    hasAccount: pc.items.some((i) => i.label.includes('계정')),
  },
}

fs.mkdirSync('tmp-qa-screenshots', { recursive: true })
fs.writeFileSync('tmp-qa-screenshots/ga-admin-menu-no-deny.json', JSON.stringify(report, null, 2))

const failed = Object.entries(report.assert).filter(([, v]) => !v)
console.log(JSON.stringify({ assert: report.assert, deniedClicks, crmOnPc, crmOnDash, crmOnMobile, buildId: report.buildId, landing }, null, 2))
if (failed.length) {
  console.error('QA FAILED', failed.map(([k]) => k))
  process.exit(1)
}
console.log('QA PASS')
