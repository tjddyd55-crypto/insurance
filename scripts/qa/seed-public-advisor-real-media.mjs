/**
 * QA 공개 프로필에 실제 비율 JPG/WebP 샘플 업로드 (1×1 PNG 금지).
 * Usage: node --env-file=server/.env.local scripts/qa/seed-public-advisor-real-media.mjs
 */
import sharp from 'sharp'

const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const SLUG = 'qa-public-advisor-dev'

const GALLERY_SPECS = [
  { w: 1200, h: 800, format: 'jpeg', caption: '세미나 발표' },
  { w: 800, h: 1200, format: 'webp', caption: '고객 상담' },
  { w: 1080, h: 1080, format: 'jpeg', caption: '' },
  { w: 1280, h: 720, format: 'webp', caption: '팀 미팅' },
  { w: 900, h: 1350, format: 'jpeg', caption: '' },
  { w: 1000, h: 750, format: 'webp', caption: '사내 교육' },
]

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.message ?? `login ${res.status}`)
  return body.token
}

async function api(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
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

async function makeImageBuffer({ w, h, format }) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/><stop offset="100%" stop-color="#0d7a4a"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" fill="white" font-size="${Math.floor(Math.min(w, h) / 12)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">ONE FC QA</text>
  </svg>`
  const pipeline = sharp(Buffer.from(svg)).resize(w, h)
  if (format === 'webp') return pipeline.webp({ quality: 82 }).toBuffer()
  return pipeline.jpeg({ quality: 85 }).toBuffer()
}

async function uploadBuffer(token, kind, fileName, contentType, buffer) {
  const presign = await api(token, '/api/me/public-profile/media/presign', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      fileName,
      contentType,
      sizeBytes: buffer.length,
    }),
  })
  if (!presign.res.ok) throw new Error(presign.json?.message ?? 'presign failed')
  const { uploadUrl, objectKey, putHeaders } = presign.json
  let put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...(putHeaders ?? {}) },
    body: buffer,
  })
  if (!put.ok) {
    const q = new URLSearchParams({ objectKey, kind, contentType })
    put = await fetch(`${BASE}/api/me/public-profile/media/upload-proxy?${q}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: buffer,
    })
  }
  if (!put.ok && put.status !== 204) throw new Error(`upload ${put.status}`)
  return objectKey
}

async function main() {
  const token = await login()
  const me = await api(token, '/api/me/public-profile')
  if (me.res.ok && Array.isArray(me.json.gallery)) {
    for (const g of me.json.gallery) {
      await api(token, `/api/me/public-profile/gallery/${g.id}`, { method: 'DELETE' })
    }
  }

  const portrait = await makeImageBuffer({ w: 960, h: 1280, format: 'jpeg' })
  const profileKey = await uploadBuffer(token, 'profile', 'qa-portrait.jpg', 'image/jpeg', portrait)
  console.log('profile uploaded', profileKey, portrait.length)

  const galleryKeys = []
  for (let i = 0; i < GALLERY_SPECS.length; i += 1) {
    const spec = GALLERY_SPECS[i]
    const buf = await makeImageBuffer(spec)
    const ext = spec.format === 'webp' ? 'webp' : 'jpg'
    const ct = spec.format === 'webp' ? 'image/webp' : 'image/jpeg'
    const key = await uploadBuffer(token, 'gallery', `qa-activity-${i + 1}.${ext}`, ct, buf)
    galleryKeys.push({ key, caption: spec.caption, bytes: buf.length })
    console.log(`gallery ${i + 1}`, key, buf.length)
  }

  const patch = await api(token, '/api/me/public-profile', {
    method: 'PATCH',
    body: JSON.stringify({
      public_slug: SLUG,
      profile_photo_object_key: profileKey,
      is_published: true,
      headline: '가족의 보장을 먼저 생각하는 설계사입니다.',
      bio: '안녕하세요.\n\n복잡한 보험을 쉽게 설명하고, 오래 함께하는 사후 관리를 중요하게 생각합니다.\n\n편하게 연락 주세요.',
    }),
  })
  if (!patch.res.ok) throw new Error(patch.json?.message ?? 'patch failed')

  for (const item of galleryKeys) {
    const add = await api(token, '/api/me/public-profile/gallery', {
      method: 'POST',
      body: JSON.stringify({ objectKey: item.key, caption: item.caption }),
    })
    if (!add.res.ok) throw new Error(add.json?.message ?? 'gallery add')
  }

  console.log('DONE real media seed for', SLUG)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
