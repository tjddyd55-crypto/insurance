/**
 * GA 그룹 로고 presign → R2 PUT → PATCH E2E (DEV 또는 로컬).
 *
 * Usage:
 *   node --env-file=server/.env.local scripts/qa/gaGroupLogoUploadDevE2e.mjs [baseUrl]
 *
 * Requires INSURANCE_ADMIN_BOOTSTRAP_PASSWORD in env file.
 */
const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const API = `${BASE}/backend/api`

const SUPER_USER = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME ?? 'admin').trim()
const SUPER_PASS = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD ?? '').trim()

/** 1x1 PNG */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function login() {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SUPER_USER, password: SUPER_PASS }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.token) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(json)}`)
  }
  if (json.user?.role !== 'SUPER_ADMIN') {
    throw new Error(`expected SUPER_ADMIN, got ${json.user?.role}`)
  }
  return json.token
}

async function main() {
  if (!SUPER_PASS) {
    throw new Error('INSURANCE_ADMIN_BOOTSTRAP_PASSWORD required')
  }
  const token = await login()
  console.log('[1] login ok')

  const listRes = await fetch(`${API}/admin/ga-groups`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const groups = await listRes.json()
  if (!listRes.ok || !Array.isArray(groups) || groups.length === 0) {
    throw new Error(`list groups failed: ${listRes.status}`)
  }
  const groupId = groups[0].id
  console.log('[2] using group', groupId, groups[0].name)

  const presignRes = await fetch(`${API}/admin/ga-groups/${groupId}/logo/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: 'qa-logo.png',
      contentType: 'image/png',
      sizeBytes: PNG_BYTES.length,
    }),
  })
  const presign = await presignRes.json()
  if (!presignRes.ok) {
    throw new Error(`presign failed: ${presignRes.status} ${JSON.stringify(presign)}`)
  }
  if (!presign.uploadUrl || !presign.publicUrl) {
    throw new Error(`presign missing fields: ${JSON.stringify(presign)}`)
  }
  const putHeaders = presign.putHeaders && typeof presign.putHeaders === 'object' ? presign.putHeaders : {}
  console.log('[3] presign ok', {
    hasPutHeaders: Object.keys(putHeaders).length > 0,
    contentType: presign.contentType,
  })

  const proxyQ = new URLSearchParams({
    storageKey: presign.storageKey,
    contentType: presign.contentType || 'image/png',
  })
  const proxyRes = await fetch(
    `${API}/admin/ga-groups/${groupId}/logo/upload-proxy?${proxyQ.toString()}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': presign.contentType || 'image/png',
      },
      body: PNG_BYTES,
    },
  )
  if (!proxyRes.ok) {
    const text = await proxyRes.text().catch(() => '')
    throw new Error(`upload-proxy failed: ${proxyRes.status} ${text.slice(0, 200)}`)
  }
  console.log('[4] upload-proxy ok', proxyRes.status)

  const patchRes = await fetch(`${API}/admin/ga-groups/${groupId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ logoUrl: presign.publicUrl }),
  })
  const patched = await patchRes.json()
  if (!patchRes.ok) {
    throw new Error(`patch failed: ${patchRes.status} ${JSON.stringify(patched)}`)
  }
  if (patched.logoUrl !== presign.publicUrl) {
    throw new Error(`logoUrl mismatch: ${patched.logoUrl}`)
  }
  console.log('[5] PATCH ok', patched.logoUrl)

  const cdnRes = await fetch(presign.publicUrl, { method: 'HEAD' })
  console.log('[6] CDN HEAD', cdnRes.status)
  if (!cdnRes.ok) {
    throw new Error(`CDN not reachable: ${cdnRes.status}`)
  }

  console.log('PASS ga group logo upload E2E')
}

main().catch((e) => {
  console.error('FAIL', e.message)
  process.exit(1)
})
