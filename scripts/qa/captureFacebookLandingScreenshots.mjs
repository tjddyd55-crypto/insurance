/**
 * Facebook 랜딩용 schedule / SMS 실화면 캡처.
 * 사용: node scripts/qa/captureFacebookLandingScreenshots.mjs [baseUrl]
 * 필요: server/.env.local bootstrap 계정, 로컬 preview(SMS_MODULE_ENABLED=true 권장)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { chromium } from 'playwright'

const OUT_DIR = 'public/introduction/facebook/screenshots'
const BASE = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '')

function loadEnvLocal() {
  const path = join(process.cwd(), 'server', '.env.local')
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 1) continue
    const key = trimmed.slice(0, idx)
    let val = trimmed.slice(idx + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function seoulYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function monthRange(ymd) {
  const [y, m] = ymd.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

function scheduleMockPayload(ymd) {
  const { from, to } = monthRange(ymd)
  const [y, m, d] = ymd.split('-').map(Number)
  const day2 = Math.min(d + 2, 28)
  const ymd2 = `${y}-${String(m).padStart(2, '0')}-${String(day2).padStart(2, '0')}`
  return {
    success: true,
    data: {
      from,
      to,
      sources: ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'],
      google: {
        configured: true,
        connected: false,
        status: 'disconnected',
        calendars: [],
        tasks: { status: 'disconnected', needsReconsent: false, taskLists: [] },
      },
      sourceStatus: {
        google: 'skipped',
        google_task: 'skipped',
        onefc_todo: 'ok',
        crm: 'ok',
      },
      events: [
        {
          id: 'crm:demo-alert',
          source: 'crm',
          sourceId: 'demo-alert',
          calendarId: null,
          calendarName: 'CRM',
          type: 'customer_alert',
          title: '김OO 알림일',
          description: '',
          startAt: ymd,
          endAt: ymd2,
          allDay: true,
          timezone: 'Asia/Seoul',
          customerId: 1,
          customerName: '김OO',
          location: '',
          status: 'open',
          readOnly: true,
          phone: '010-1234-****',
          htmlLink: null,
          sourceDate: ymd,
          sourceTitle: '알림일',
        },
        {
          id: 'crm:demo-car',
          source: 'crm',
          sourceId: 'demo-car',
          calendarId: null,
          calendarName: 'CRM',
          type: 'car_expiry',
          title: '이OO 자동차 만기',
          description: '',
          startAt: ymd2,
          endAt: ymd2,
          allDay: true,
          timezone: 'Asia/Seoul',
          customerId: 2,
          customerName: '이OO',
          location: '',
          status: 'open',
          readOnly: true,
          phone: '010-5678-****',
          htmlLink: null,
          sourceDate: ymd2,
          sourceTitle: null,
        },
      ],
      tasks: [
        {
          id: 'onefc:demo-1',
          source: 'onefc_todo',
          title: '김OO 상담 전화',
          dueDate: ymd,
          dueTime: '10:00',
          status: 'open',
          customerId: 1,
          customerName: '김OO',
          notes: '예시 메모',
          phone: '010-1234-****',
        },
      ],
      fetchedAt: new Date().toISOString(),
      cacheBypassed: false,
    },
  }
}

function smsJson(data) {
  return { success: true, data }
}

const SMS_SETTINGS = {
  configured: true,
  provider: 'aligo',
  aligoUserId: 'demo',
  apiKeyMasked: '****',
  defaultSender: '010-2000-0000',
  adDisplayName: 'ONE FC',
  isActive: true,
  lastBalanceCheckedAt: null,
  outboundServerIpHint: '',
  outboundServerIps: [],
  aligoApiSettingsUrl: 'https://smartsms.aligo.in/admin/api/auth.html',
  moduleEnabled: true,
  realSendEnabled: false,
  providerMode: 'mock',
  providerIsMock: true,
  aligoTestMode: true,
}

const SMS_CUSTOMERS = [
  {
    customerId: 101,
    name: '김OO',
    gender: 'female',
    genderLabel: '여',
    birthDate: '1985-03-12',
    phone: '01012340000',
    phoneDisplay: '010-1234-****',
    insuranceAge: 41,
    sangnyeongDday: null,
    sangnyeongLabel: '-',
    canSend: true,
    blockedReason: null,
  },
  {
    customerId: 102,
    name: '이OO',
    gender: 'male',
    genderLabel: '남',
    birthDate: '1990-07-01',
    phone: '01056780000',
    phoneDisplay: '010-5678-****',
    insuranceAge: 36,
    sangnyeongDday: null,
    sangnyeongLabel: '-',
    canSend: true,
    blockedReason: null,
  },
  {
    customerId: 103,
    name: '박OO',
    gender: 'female',
    genderLabel: '여',
    birthDate: '1978-11-20',
    phone: '01099990000',
    phoneDisplay: '010-9999-****',
    insuranceAge: 48,
    sangnyeongDday: null,
    sangnyeongLabel: '-',
    canSend: true,
    blockedReason: null,
  },
]

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[autocomplete="username"], input[name="username"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 }),
    page.locator('button[type="submit"]').click(),
  ])
}

async function installApiMocks(page, ymd) {
  await page.route('**/backend/schedule/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scheduleMockPayload(ymd)),
    })
  })

  const smsFulfill = (data) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(smsJson(data)),
  })

  await page.route('**/backend/sms/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (url.includes('/sms/settings') && method === 'GET') {
      await route.fulfill(smsFulfill(SMS_SETTINGS))
      return
    }
    if (url.includes('/sms/senders')) {
      await route.fulfill(
        smsFulfill([
          {
            id: 1,
            senderNumber: '010-2000-0000',
            label: '발신번호',
            status: 'verified',
            isDefault: true,
            lastTestSentAt: null,
          },
        ]),
      )
      return
    }
    if (url.includes('/sms/templates')) {
      await route.fulfill(smsFulfill([]))
      return
    }
    if (url.includes('/sms/history')) {
      await route.fulfill(smsFulfill([]))
      return
    }
    if (url.includes('/sms/campaigns')) {
      await route.fulfill(smsFulfill([]))
      return
    }
    if (url.includes('/sms/opt-outs')) {
      await route.fulfill(smsFulfill([]))
      return
    }
    if (url.includes('/recipient-groups') && url.includes('/members')) {
      await route.fulfill(
        smsFulfill({
          customerIds: SMS_CUSTOMERS.map((c) => c.customerId),
          customers: SMS_CUSTOMERS,
        }),
      )
      return
    }
    if (url.includes('/sms/recipient-groups') && method === 'GET' && !url.includes('/members')) {
      await route.fulfill(
        smsFulfill([
          {
            id: 1,
            name: '안내 발송 그룹',
            description: '랜딩 예시 그룹',
            recipientCount: SMS_CUSTOMERS.length,
            lastSentAt: null,
            createdAt: null,
            updatedAt: null,
          },
        ]),
      )
      return
    }
    if (url.includes('/sms/recipients/customers')) {
      await route.fulfill(smsFulfill({ customers: SMS_CUSTOMERS, totalCount: SMS_CUSTOMERS.length }))
      return
    }
    await route.continue()
  })
}

async function saveWebp(pngBuffer, name) {
  const out = join(OUT_DIR, name)
  await sharp(pngBuffer)
    .resize(1440, 900, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: 88 })
    .toFile(out)
  console.log('wrote', out)
}

async function main() {
  const env = loadEnvLocal()
  const username = env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME?.trim()
  const password = env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD
  if (!username || !password) {
    throw new Error('INSURANCE_ADMIN_BOOTSTRAP_USERNAME/PASSWORD가 server/.env.local에 필요합니다.')
  }

  const ymd = seoulYmd()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await installApiMocks(page, ymd)
  await login(page, username, password)

  await page.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('heading', { name: '일정 관리' }).waitFor({ timeout: 30000 })
  const dismiss = page.getByRole('button', { name: '닫기' }).first()
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click()
  }
  await page.locator('.schedule-page--pc, .schedule-page').first().waitFor({ timeout: 30000 })
  const scheduleEl = page.locator('.schedule-page--pc, .schedule-page').first()
  const schedulePng = await scheduleEl.screenshot({ type: 'png' })
  await saveWebp(schedulePng, 'schedule-management.webp')

  await page.goto(`${BASE}/sms/send`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('heading', { name: '문자 작성' }).waitFor({ timeout: 45000 })
  const smsPage = page.locator('.sms-module-page--pc').first()
  const smsPng = await smsPage.screenshot({ type: 'png' })
  await saveWebp(smsPng, 'sms-management.webp')

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
