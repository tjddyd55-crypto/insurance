import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

/**
 * 개인 바인더 2계정 IDOR 검증.
 * 자격 증명은 환경 변수로만 받고 저장소에 커밋하지 않는다.
 *
 * COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS — 소유자 A
 * COVERAGE_BINDER_QA_USER_B / COVERAGE_BINDER_QA_PASS_B — 다른 사용자 B
 */
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const USER_A = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASS_A = process.env.COVERAGE_BINDER_QA_PASS
const USER_B = process.env.COVERAGE_BINDER_QA_USER_B?.trim()
const PASS_B = process.env.COVERAGE_BINDER_QA_PASS_B
const PDF_PATH =
  process.env.COVERAGE_BINDER_QA_PDF ||
  join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'pdf', 'coverage-simulator-qa-1p.pdf')

if (!USER_A || !PASS_A || !USER_B || !PASS_B) {
  throw new Error(
    'COVERAGE_BINDER_QA_USER/PASS 와 COVERAGE_BINDER_QA_USER_B/PASS_B 가 필요합니다.',
  )
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload }
}

async function login(username, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
  if (!result.response.ok || !result.payload?.token) {
    throw new Error(`login failed for ${username}: ${result.response.status}`)
  }
  return result.payload
}

function assertBlocked(result, label) {
  const status = result.response.status
  if (status !== 403 && status !== 404) {
    throw new Error(`${label}: expected 403/404, got ${status} ${JSON.stringify(result.payload)}`)
  }
}

async function main() {
  const owner = await login(USER_A, PASS_A)
  const intruder = await login(USER_B, PASS_B)
  if (owner.user?.id && owner.user.id === intruder.user?.id) {
    throw new Error('IDOR 검증은 서로 다른 두 계정이 필요합니다.')
  }
  const ownerToken = owner.token
  const intruderToken = intruder.token
  const binder = (await request('/api/personal-binders', {
    token: ownerToken,
    method: 'POST',
    body: { title: `QA IDOR ${Date.now()}`, description: 'idor' },
  })).payload
  if (!binder?.id) throw new Error('owner binder create failed')
  const section = (await request(`/api/personal-binders/${binder.id}/sections`, {
    token: ownerToken,
    method: 'POST',
    body: { title: '격리 섹션' },
  })).payload
  if (!section?.id) throw new Error('owner section create failed')

  const pdf = await readFile(PDF_PATH)
  const fileName = basename(PDF_PATH)
  const presign = (await request('/api/storage/files/presign', {
    token: ownerToken,
    method: 'POST',
    body: { fileName, contentType: 'application/pdf', size: pdf.length, customerId: null },
  }))
  if (!presign.response.ok) throw new Error(`presign failed ${presign.response.status}`)
  const upload = await fetch(new URL(presign.payload.uploadUrl, BASE), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', ...(presign.payload.putHeaders ?? {}) },
    body: pdf,
  })
  if (!upload.ok) throw new Error(`upload failed ${upload.status}`)
  const stored = (await request('/api/storage/files', {
    token: ownerToken,
    method: 'POST',
    body: {
      fileId: presign.payload.fileId,
      fileName,
      displayName: fileName,
      objectKey: presign.payload.objectKey,
      fileUrl: presign.payload.fileUrl,
      size: pdf.length,
      mimeType: 'application/pdf',
      customerId: null,
    },
  })).payload
  const material = (await request('/api/personal-binders/materials', {
    token: ownerToken,
    method: 'POST',
    body: { fileId: stored.id, title: `QA IDOR 자료 ${Date.now()}` },
  })).payload
  if (!material?.id) throw new Error('owner material create failed')
  const item = (await request(`/api/personal-binders/sections/${section.id}/items`, {
    token: ownerToken,
    method: 'POST',
    body: { materialId: material.id, pageSelection: [1] },
  })).payload
  if (!item?.id) throw new Error('owner item create failed')

  const attacks = [
    ['GET binder', `/api/personal-binders/${binder.id}`, 'GET'],
    ['PATCH binder', `/api/personal-binders/${binder.id}`, 'PATCH', { title: '탈취' }],
    ['DELETE binder', `/api/personal-binders/${binder.id}`, 'DELETE'],
    ['duplicate binder', `/api/personal-binders/${binder.id}/duplicate`, 'POST', { title: '탈취 복제' }],
    ['export binder', `/api/personal-binders/${binder.id}/export`, 'GET'],
    ['POST section', `/api/personal-binders/${binder.id}/sections`, 'POST', { title: '탈취 섹션' }],
    ['reorder sections', `/api/personal-binders/${binder.id}/sections/reorder`, 'PUT', { sectionIds: [section.id] }],
    ['PATCH section', `/api/personal-binders/sections/${section.id}`, 'PATCH', { title: '탈취' }],
    ['DELETE section', `/api/personal-binders/sections/${section.id}`, 'DELETE'],
    ['PATCH item', `/api/personal-binders/items/${item.id}`, 'PATCH', { pageSelection: [1] }],
    ['DELETE item', `/api/personal-binders/items/${item.id}`, 'DELETE'],
    ['reorder items', `/api/personal-binders/sections/${section.id}/items/reorder`, 'PUT', { itemIds: [item.id] }],
    ['PATCH material', `/api/personal-binders/materials/${material.id}`, 'PATCH', { title: '탈취 자료' }],
    ['DELETE material', `/api/personal-binders/materials/${material.id}`, 'DELETE'],
    ['open-token', `/api/storage/files/${stored.id}/open-token`, 'POST', { disposition: 'inline' }],
    ['download list file', `/api/storage/files/${stored.id}`, 'GET'],
  ]
  for (const [label, path, method, body] of attacks) {
    assertBlocked(
      await request(path, { token: intruderToken, method, body }),
      label,
    )
  }

  const exportRaw = await fetch(`${BASE}/api/personal-binders/${binder.id}/export`, {
    headers: { Authorization: `Bearer ${intruderToken}` },
  })
  if (exportRaw.status !== 403 && exportRaw.status !== 404) {
    throw new Error(`export raw: expected 403/404, got ${exportRaw.status}`)
  }
  if (exportRaw.headers.get('content-type')?.includes('application/pdf')) {
    throw new Error('intruder received a binder PDF')
  }

  const cleanup = await request(`/api/personal-binders/${binder.id}`, {
    token: ownerToken,
    method: 'DELETE',
  })
  if (!cleanup.response.ok) throw new Error('owner cleanup failed')
  await request(`/api/personal-binders/materials/${material.id}`, {
    token: ownerToken,
    method: 'DELETE',
  })
  await request(`/api/storage/files/${stored.id}`, {
    token: ownerToken,
    method: 'DELETE',
  })
  const ownerGaId = owner.user?.ga_id ?? owner.user?.gaId ?? null
  const intruderGaId = intruder.user?.ga_id ?? intruder.user?.gaId ?? null
  console.log('[PASS] personalBinderIdorQa', {
    sameGa: ownerGaId != null && ownerGaId === intruderGaId,
    ownerGaId,
    intruderGaId,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
