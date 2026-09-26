import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USERNAME = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASSWORD = process.env.COVERAGE_BINDER_QA_PASS
const OUT_DIR = join(process.cwd(), 'store-screenshots', 'personal-binder')
const fixture = JSON.parse(
  await readFile(join(OUT_DIR, 'api-e2e-fixture.json'), 'utf8'),
)

if (!USERNAME || !PASSWORD) {
  throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS가 필요합니다.')
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USERNAME)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function authToken(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('insurance.auth.session')
    return raw ? JSON.parse(raw).token : null
  })
}

async function cleanup(token) {
  const call = (path, method = 'DELETE') =>
    fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    })
  await call(`/api/personal-binders/${fixture.duplicatedBinderId}`)
  await call(`/api/personal-binders/${fixture.binderId}`)
  const material = await call(`/api/personal-binders/materials/${fixture.materialId}`)
  if (material.ok) await call(`/api/storage/files/${fixture.fileId}`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await desktop.newPage()
  await login(page)

  await page.goto(`${BASE}/personal-binders`, { waitUntil: 'domcontentloaded' })
  await page.getByText(fixture.binderTitle).first().waitFor()
  await page.screenshot({ path: join(OUT_DIR, 'desktop-binder-list-1440.png'), fullPage: true })

  await page.goto(`${BASE}/personal-binders/${fixture.binderId}/edit`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByText('암 치료의 변화').first().waitFor()
  await page.getByRole('button', { name: '페이지' }).first().click()
  await page.locator('.personal-binder-page-dialog__desktop').waitFor()
  await page.locator('.personal-binder-page-preview canvas').waitFor()
  await page.locator('.personal-binder-thumbnail').first().waitFor()
  await page.screenshot({ path: join(OUT_DIR, 'desktop-page-editor-1440.png'), fullPage: true })
  await page.getByRole('button', { name: '닫기' }).first().click()

  await page.goto(`${BASE}/personal-binders/${fixture.binderId}/view`, {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('.personal-binder-viewer__page canvas').waitFor({ timeout: 60000 })
  const consultingPages = fixture.consultingPageCount ?? (fixture.pageCount > 1 ? 2 : 1)
  await page.getByText(`1 / ${consultingPages}`).waitFor()
  await page.getByRole('button', { name: '목차' }).click()
  await page.getByRole('dialog', { name: '바인더 목차' }).waitFor()
  await page.getByRole('button', { name: '암 치료의 변화' }).click()
  if (consultingPages > 1) {
    await page.keyboard.press('ArrowRight')
    await page.getByText(`2 / ${consultingPages}`).waitFor()
    await page.locator('.personal-binder-viewer__page canvas').waitFor()
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: join(OUT_DIR, 'desktop-consulting-viewer-1440.png'), fullPage: true })

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const mobilePage = await mobile.newPage()
  await login(mobilePage)
  await mobilePage.goto(`${BASE}/personal-binders/${fixture.binderId}/edit`, {
    waitUntil: 'domcontentloaded',
  })
  await mobilePage.getByRole('button', { name: '페이지' }).first().click()
  await mobilePage.locator('.personal-binder-page-dialog__mobile').waitFor()
  await mobilePage.locator('.personal-binder-thumbnail').first().click()
  await mobilePage.screenshot({ path: join(OUT_DIR, 'mobile-page-picker-390.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: '닫기' }).first().click()

  await mobilePage.goto(`${BASE}/personal-binders/${fixture.binderId}/view`, {
    waitUntil: 'domcontentloaded',
  })
  const viewer = mobilePage.locator('.personal-binder-viewer__viewport')
  await viewer.locator('canvas').waitFor({ timeout: 60000 })
  const box = await viewer.boundingBox()
  if (!box) throw new Error('viewer bounds missing')
  if (consultingPages > 1) {
    await mobilePage.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2)
    await mobilePage.mouse.down()
    await mobilePage.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2)
    await mobilePage.mouse.up()
    await mobilePage.getByText(`2 / ${consultingPages}`).waitFor()
    await viewer.locator('canvas').waitFor()
    await mobilePage.waitForTimeout(500)
  }
  await viewer.click({ position: { x: 12, y: 12 } })
  await mobilePage.locator('.personal-binder-viewer--immersive').waitFor()
  await viewer.click({ position: { x: 12, y: 12 } })
  await mobilePage.getByRole('button', { name: '확대' }).click()
  await mobilePage.waitForTimeout(200)
  await mobilePage.screenshot({ path: join(OUT_DIR, 'mobile-consulting-viewer-390.png'), fullPage: true })

  const responsive = []
  for (const width of [360, 390, 412, 768]) {
    await mobilePage.setViewportSize({ width, height: width === 768 ? 1024 : 844 })
    await mobilePage.goto(`${BASE}/personal-binders`, { waitUntil: 'domcontentloaded' })
    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    responsive.push({ width, overflow })
    await mobilePage.screenshot({
      path: join(OUT_DIR, `binder-list-${width}.png`),
      fullPage: true,
    })
  }
  if (responsive.some((entry) => entry.overflow > 1)) {
    throw new Error(`horizontal overflow: ${JSON.stringify(responsive)}`)
  }

  const token = await authToken(page)
  if (!token) throw new Error('auth token missing for cleanup')
  await cleanup(token)
  await writeFile(
    join(OUT_DIR, 'ui-qa-results.json'),
    JSON.stringify({ fixture, responsive, passed: true }, null, 2),
  )
  await browser.close()
  console.log('[PASS] personalBinderUiQa', { fixture, responsive })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
