/**
 * Development QA 전용: Unsplash 기반 실사형 프로필·활동 샘플 (그라데이션 QA 이미지 교체).
 * Production / 다른 계정에는 실행하지 않는다.
 *
 * Usage: node --env-file=server/.env.local scripts/qa/seed-public-advisor-realistic-stock-media.mjs
 */
const BASE = process.env.DEV_BASE_URL ?? 'https://insurance-dev.up.railway.app'
const USER = process.env.DEV_TEST_USERNAME ?? 'qa_ai_user'
const PASS = process.env.DEV_TEST_PASSWORD ?? process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '1234'
const SLUG = 'qa-public-advisor-dev'

/** @type {Array<{ url: string; fileName: string; caption: string }>} */
const GALLERY_SOURCES = [
  {
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=1200&fit=crop&q=85',
    fileName: 'qa-seminar.jpg',
    caption: '세미나 발표',
  },
  {
    url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&h=1200&fit=crop&q=85',
    fileName: 'qa-consultation.jpg',
    caption: '고객 상담',
  },
  {
    url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=1200&fit=crop&q=85',
    fileName: 'qa-award.jpg',
    caption: '시상식',
  },
  {
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=1200&fit=crop&q=85',
    fileName: 'qa-team.jpg',
    caption: '팀 미팅',
  },
  {
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=1200&fit=crop&q=85',
    fileName: 'qa-training.jpg',
    caption: '교육 강의',
  },
  {
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=1200&fit=crop&q=85',
    fileName: 'qa-office.webp',
    caption: '사무실 활동',
  },
]

const PROFILE_SOURCE = {
  url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=960&h=1200&fit=crop&q=85',
  fileName: 'qa-portrait-business.jpg',
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.message ?? `login ${res.status}`)
  if (USER !== 'qa_ai_user') {
    console.warn('WARN: expected DEV qa_ai_user only; aborting to avoid wrong account.')
    process.exit(1)
  }
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

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`download ${res.status} ${url}`)
  const ct = String(res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5000) throw new Error(`download too small ${buf.length} for ${url}`)
  return { buf, contentType: ct }
}

function contentTypeForFile(fileName, fallback) {
  const n = fileName.toLowerCase()
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  return fallback || 'image/jpeg'
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

  console.log('Downloading profile portrait…')
  const profileDl = await download(PROFILE_SOURCE.url)
  const profileCt = contentTypeForFile(PROFILE_SOURCE.fileName, profileDl.contentType)
  const profileKey = await uploadBuffer(
    token,
    'profile',
    PROFILE_SOURCE.fileName,
    profileCt,
    profileDl.buf,
  )
  console.log('Profile', profileKey, profileDl.buf.length)

  const galleryKeys = []
  for (const item of GALLERY_SOURCES) {
    console.log('Downloading', item.fileName)
    const dl = await download(item.url)
    const ct = contentTypeForFile(item.fileName, dl.contentType)
    const key = await uploadBuffer(token, 'gallery', item.fileName, ct, dl.buf)
    galleryKeys.push({ key, caption: item.caption, bytes: dl.buf.length })
    console.log(' Gallery', key, dl.buf.length)
  }

  const patch = await api(token, '/api/me/public-profile', {
    method: 'PATCH',
    body: JSON.stringify({
      public_slug: SLUG,
      profile_photo_object_key: profileKey,
      is_published: true,
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

  console.log('DONE realistic stock media for', SLUG)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
