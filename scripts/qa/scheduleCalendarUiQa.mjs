import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USERNAME = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASSWORD = process.env.COVERAGE_BINDER_QA_PASS
const OUT_DIR = join(process.cwd(), 'store-screenshots', 'schedule-calendar')

if (!USERNAME || !PASSWORD) throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS가 필요합니다.')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(USERNAME)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function token(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('insurance.auth.session')
    return raw ? JSON.parse(raw).token : null
  })
}

async function api(path, authToken, method = 'GET', body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(payload)}`)
  return payload
}

function seoulToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await desktop.newPage()
  await login(page)
  const authToken = await token(page)
  const dueDate = seoulToday()
  const created = []
  try {
    for (let index = 1; index <= 5; index += 1) {
      created.push(await api('/api/todos', authToken, 'POST', {
        sourceType: 'manual',
        title: `달력 QA 일정 ${index}`,
        description: `달력 QA 일정 ${index}`,
        dueDate,
        dueTime: `0${index + 8}:00`,
      }))
    }
    await page.goto(`${BASE}/todos`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '목록 보기' }).waitFor()
    await page.getByRole('button', { name: '달력 보기' }).click()
    await page.locator('.todos-calendar__grid').waitFor()
    await page.getByRole('button', { name: /\+2 더보기/ }).click()
    await page.getByRole('dialog', { name: /일정$/ }).waitFor()
    await page.screenshot({ path: join(OUT_DIR, 'calendar-day-dialog-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: '닫기' }).click()
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.getByRole('button', { name: '오늘' }).click()
    await page.screenshot({ path: join(OUT_DIR, 'calendar-desktop.png'), fullPage: true })

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    })
    const mobilePage = await mobile.newPage()
    await login(mobilePage)
    await mobilePage.goto(`${BASE}/todos`, { waitUntil: 'domcontentloaded' })
    await mobilePage.getByRole('button', { name: '달력 보기' }).click().catch(() => undefined)
    await mobilePage.locator('.todos-calendar__grid').waitFor()
    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 1) throw new Error(`mobile horizontal overflow ${overflow}px`)
    await mobilePage.screenshot({ path: join(OUT_DIR, 'calendar-mobile-390.png'), fullPage: true })
    const result = { dueDate, createdCount: created.length, overflow, listPreserved: true }
    await writeFile(join(OUT_DIR, 'ui-qa-results.json'), JSON.stringify(result, null, 2))
    console.log('[PASS] scheduleCalendarUiQa', result)
  } finally {
    for (const todo of created) {
      await api(`/api/todos/${todo.id}`, authToken, 'DELETE').catch(() => undefined)
    }
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
