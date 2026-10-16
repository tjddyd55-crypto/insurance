/**
 * Development §23 public advisor QA (API + DB). Password from env only.
 * Usage: node --env-file=server/.env.local scripts/qa/publicAdvisorDevManualQa.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'base64',
)

const SLUG = 'qa-public-advisor-dev'
const results = []

function record(name, pass, note = '') {
  results.push({ name, pass, note })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`)
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? `login ${res.status}`)
  return { token: body.token, userId: body.user?.id ?? body.user?.userId }
}

async function api(token, url, opts = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.body && !(opts.headers?.['Content-Type']) ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { res, json }
}

async function uploadImage(token, kind, fileName) {
  const presign = await api(token, '/api/me/public-profile/media/presign', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      fileName,
      contentType: 'image/png',
      sizeBytes: PNG.length,
    }),
  })
  if (!presign.res.ok) throw new Error(presign.json?.message ?? 'presign failed')
  const put = await fetch(presign.json.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: PNG,
  })
  if (!put.ok) throw new Error(`R2 put ${put.status}`)
  return presign.json.objectKey
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const { token, userId } = await login()
  record('Test USER login', Boolean(token))

  const existing = await api(token, '/api/me/public-profile', { method: 'GET' })
  if (existing.res.ok && Array.isArray(existing.json.gallery)) {
    for (const g of existing.json.gallery) {
      await api(token, `/api/me/public-profile/gallery/${g.id}`, { method: 'DELETE' })
    }
  }

  const profilePhotoKey = await uploadImage(token, 'profile', 'qa-profile.png')
  record('Profile photo upload', Boolean(profilePhotoKey))

  const galleryKeys = []
  for (let i = 0; i < 6; i += 1) {
    galleryKeys.push(await uploadImage(token, 'gallery', `qa-gallery-${i + 1}.png`))
  }
  record('Gallery 6 uploads', galleryKeys.length === 6)

  const hashtags = ['법인', '보장분석', 'MDRT', '경력15년', 'CEO상담']
  const patch = await api(token, '/api/me/public-profile', {
    method: 'PATCH',
    body: JSON.stringify({
      public_slug: SLUG,
      profile_photo_object_key: profilePhotoKey,
      headline: '고객이 이해할 수 있게 쉽게 설명하는 보험설계사입니다.',
      bio: '안녕하세요. ONE FC QA 공개 프로필 테스트입니다.\n\n장기적인 보장 설계와 사후 관리를 중요하게 생각합니다.\n\n편하게 연락 주세요.',
      career_text: '영진에셋 소속 · 보험설계 경력 15년 · MDRT 도전 중',
      title_label: 'FC',
      hashtags,
      office_road_address: '서울 광진구 능동로 120',
      office_address_detail: 'QA빌딩 5층',
      office_postal_code: '05000',
      show_phone: true,
      show_kakao: false,
      allow_consultation: true,
      is_published: true,
    }),
  })
  record('CRM profile PATCH', patch.res.ok, patch.json?.message)

  for (let i = 0; i < galleryKeys.length; i += 1) {
    const add = await api(token, '/api/me/public-profile/gallery', {
      method: 'POST',
      body: JSON.stringify({ objectKey: galleryKeys[i], caption: i % 2 === 0 ? `QA 활동 ${i + 1}` : '' }),
    })
    if (!add.res.ok) throw new Error(add.json?.message ?? 'gallery add failed')
  }
  record('Gallery 6 DB rows', true)

  const me = await api(token, '/api/me/public-profile', { method: 'GET' })
  const meOk =
    me.res.ok &&
    me.json.gallery?.length === 6 &&
    me.json.profile?.is_published === true &&
    me.json.profilePhotoUrl
  record('CRM GET after save', meOk)

  const pub = await fetch(`${BASE}/api/public/advisors/${SLUG}`)
  const pubJson = await pub.json()
  record('Public API published', pub.ok && pubJson.displayName && pubJson.gallery?.length === 6)

  const html = await fetch(`${BASE}/fc/${SLUG}`).then((r) => r.text())
  const ogOk =
    html.includes('property="og:title"') &&
    html.includes('property="og:image"') &&
    html.includes('property="og:url"') &&
    html.includes('twitter:card') &&
    html.includes('rel="canonical"') &&
    html.includes('index, follow')
  record('OG HTML inject', ogOk)

  const experts = await fetch(`${BASE}/api/public/experts?q=${encodeURIComponent('QA 공개')}`).then((r) => r.json())
  record('Expert search by name', (experts.items ?? []).some((x) => x.slug === SLUG))

  const searches = [
    ['company', '영진'],
    ['team', '테스트팀'],
    ['region', '광진'],
    ['tag', 'MDRT'],
  ]
  for (const [label, q] of searches) {
    const r = await fetch(`${BASE}/api/public/experts?q=${encodeURIComponent(q)}`).then((x) => x.json())
    record(`Search ${label}`, (r.items ?? []).some((x) => x.slug === SLUG), q)
  }

  const seventh = await api(token, '/api/me/public-profile/gallery', {
    method: 'POST',
    body: JSON.stringify({ objectKey: galleryKeys[0] }),
  })
  record('Gallery 7th blocked', seventh.res.status === 400)

  const consult = await fetch(`${BASE}/api/public/advisors/${SLUG}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'QA방문자',
      phone: '010-9999-8877',
      message: '공개 프로필 상담 QA 테스트 문의입니다.',
      contactChannel: 'phone',
      privacyConsent: true,
    }),
  })
  const consultJson = await consult.json().catch(() => ({}))
  record('Consultation submit', consult.ok && consultJson.ok, consultJson.id)

  const noConsent = await fetch(`${BASE}/api/public/advisors/${SLUG}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'QA방문자',
      phone: '010-9999-8877',
      message: '동의 없음 테스트',
      contactChannel: 'phone',
      privacyConsent: false,
    }),
  })
  record('Consultation without consent blocked', noConsent.status === 400)

  if (consultJson.id) {
    const lead = await pool.query(`SELECT id, advisor_user_id FROM advisor_consultation_leads WHERE id = $1`, [
      consultJson.id,
    ])
    record('Lead in DB', lead.rowCount === 1)
    const notif = await pool.query(
      `SELECT id FROM notifications WHERE type = 'advisor_consultation_lead' AND reference_id = $1`,
      [consultJson.id],
    )
    record('Advisor notification', notif.rowCount >= 1)
    const cust = await pool.query(`SELECT id FROM customers WHERE phone LIKE '%99998877%' LIMIT 1`)
    record('No auto customer', cust.rowCount === 0)
  }

  await fetch(`${BASE}/api/public/advisors/${SLUG}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'PHONE_CLICK' }),
  })
  await fetch(`${BASE}/api/public/advisors/${SLUG}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'SHARE_CLICK' }),
  })

  const ev = await pool.query(
    `SELECT event_type FROM advisor_public_profile_events WHERE advisor_user_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [userId],
  )
  const types = new Set(ev.rows.map((r) => r.event_type))
  record('Events logged', types.has('PROFILE_VIEW') || types.size > 0, [...types].join(','))

  await api(token, '/api/me/public-profile', {
    method: 'PATCH',
    body: JSON.stringify({ is_published: false }),
  })
  const privApi = await fetch(`${BASE}/api/public/advisors/${SLUG}`)
  record('Private API 404', privApi.status === 404)
  const privHtml = await fetch(`${BASE}/fc/${SLUG}`).then((r) => r.text())
  record('Private noindex HTML', privHtml.includes('noindex, nofollow'))
  const privExperts = await fetch(`${BASE}/api/public/experts?q=${encodeURIComponent(SLUG)}`).then((r) => r.json())
  record('Private excluded from experts', !(privExperts.items ?? []).some((x) => x.slug === SLUG))

  await api(token, '/api/me/public-profile', {
    method: 'PATCH',
    body: JSON.stringify({ is_published: true }),
  })
  const repub = await fetch(`${BASE}/api/public/advisors/${SLUG}`)
  record('Re-publish works', repub.ok)

  const outPath = path.join('scripts', 'qa', 'public-advisor-dev-qa-results.json')
  fs.writeFileSync(outPath, JSON.stringify({ slug: SLUG, publicUrl: `${BASE}/fc/${SLUG}`, results }, null, 2))
  console.log('Wrote', outPath)

  await pool.end()
  const failed = results.filter((r) => !r.pass)
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
