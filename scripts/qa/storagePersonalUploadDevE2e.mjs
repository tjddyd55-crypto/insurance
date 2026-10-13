/**
 * 개인 내 저장 공간 presign → upload-proxy → save E2E (DEV 또는 로컬).
 *
 * Usage:
 *   node --env-file=server/.env.local scripts/qa/storagePersonalUploadDevE2e.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const API = `${BASE}/backend/api`

const SUPER_USER = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME ?? 'admin').trim()
const SUPER_PASS = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD ?? '').trim()

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
  'utf8',
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
  return json.token
}

async function uploadViaProxyAndSave(token, { fileName, contentType, bytes }) {
  const presignRes = await fetch(`${API}/storage/files/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      contentType,
      size: bytes.length,
      customerId: null,
    }),
  })
  const presign = await presignRes.json()
  if (!presignRes.ok) {
    throw new Error(`presign ${fileName}: ${presignRes.status} ${JSON.stringify(presign)}`)
  }

  const q = new URLSearchParams({
    uploadFileId: String(presign.fileId),
    objectKey: presign.objectKey,
    contentType,
  })
  const proxyRes = await fetch(`${API}/storage/files/upload-proxy?${q.toString()}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: bytes,
  })
  if (!proxyRes.ok) {
    const text = await proxyRes.text().catch(() => '')
    throw new Error(`proxy ${fileName}: ${proxyRes.status} ${text.slice(0, 300)}`)
  }

  const saveRes = await fetch(`${API}/storage/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId: presign.fileId,
      fileName,
      displayName: fileName,
      objectKey: presign.objectKey,
      fileUrl: presign.fileUrl,
      size: bytes.length,
      mimeType: contentType,
      folderId: null,
      customerId: null,
    }),
  })
  const saved = await saveRes.json()
  if (!saveRes.ok) {
    throw new Error(`save ${fileName}: ${saveRes.status} ${JSON.stringify(saved)}`)
  }
  return saved
}

async function main() {
  if (!SUPER_PASS) {
    throw new Error('INSURANCE_ADMIN_BOOTSTRAP_PASSWORD required')
  }
  const token = await login()
  console.log('[1] login ok')

  const pngName = `qa-storage-${Date.now()}.png`
  const png = await uploadViaProxyAndSave(token, {
    fileName: pngName,
    contentType: 'image/png',
    bytes: PNG_BYTES,
  })
  console.log('[2] PNG ok', png.id, png.displayName)

  const pdfName = `qa-storage-${Date.now()}.pdf`
  const pdf = await uploadViaProxyAndSave(token, {
    fileName: pdfName,
    contentType: 'application/pdf',
    bytes: PDF_BYTES,
  })
  console.log('[3] PDF ok', pdf.id, pdf.displayName)

  const listRes = await fetch(`${API}/storage/files`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const files = await listRes.json()
  if (!listRes.ok || !Array.isArray(files)) {
    throw new Error(`list failed: ${listRes.status}`)
  }
  const ids = new Set([png.id, pdf.id])
  const found = files.filter((row) => ids.has(row.id))
  if (found.length !== 2) {
    throw new Error(`list missing uploads: expected 2, found ${found.length}`)
  }
  console.log('[4] list contains both uploads')
  console.log('OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
