import { randomBytes } from 'node:crypto'

import { consentGetBuffer, consentPutObject } from '../lib/consentStorage.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

const MAX_PDF_BYTES = 15 * 1024 * 1024
const PDF_HEADER = Buffer.from('%PDF-')

function sanitizePdfFileName(value) {
  const raw = String(value ?? '').trim() || '보장시뮬레이션.pdf'
  const safe = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .slice(0, 180)
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`
}

export function decodeCoveragePdfFileNameHeader(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return '보장시뮬레이션.pdf'
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function assertPdfBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw Object.assign(new Error('PDF 데이터가 비어 있습니다.'), { httpStatus: 400 })
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw Object.assign(new Error('PDF 파일이 너무 큽니다.'), { httpStatus: 413 })
  }
  if (!buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) {
    throw Object.assign(new Error('PDF 파일 형식이 올바르지 않습니다.'), { httpStatus: 400 })
  }
}

export function buildCoveragePdfArtifactDownloadUrl(req, token) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim()
  const path = `/api/public/coverage-pdf-artifacts/${encodeURIComponent(token)}/download`
  return host ? `${proto}://${host}${path}` : path
}

export async function createCoveragePdfArtifact(pool, input) {
  const {
    buffer,
    fileName,
    sourceMode,
    gaId = null,
    userId = null,
  } = input
  assertPdfBuffer(buffer)

  const token = randomBytes(32).toString('base64url')
  const objectKey = `coverage-simulator/pdf-artifacts/${token}.pdf`
  const safeFileName = sanitizePdfFileName(fileName)

  await consentPutObject(objectKey, buffer, 'application/pdf')
  await safeQuery(
    pool,
    `
    INSERT INTO coverage_pdf_artifacts (
      download_token,
      object_key,
      file_name,
      ga_id,
      created_by_user_id,
      source_mode
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [token, objectKey, safeFileName, gaId, userId, sourceMode],
    { allowUnscoped: true },
  )

  return { token, fileName: safeFileName }
}

export async function loadCoveragePdfArtifact(pool, token) {
  const normalized = String(token ?? '').trim()
  if (!normalized) return { status: 'not_found' }

  const result = await safeQuery(
    pool,
    `
    SELECT object_key, file_name, expires_at
    FROM coverage_pdf_artifacts
    WHERE download_token = $1
    LIMIT 1
    `,
    [normalized],
    { allowUnscoped: true },
  )
  const row = result.rows[0]
  if (!row) return { status: 'not_found' }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { status: 'expired' }
  }

  const buffer = await consentGetBuffer(row.object_key)
  if (!buffer?.length) return { status: 'not_found' }
  return { status: 'ok', buffer, fileName: row.file_name }
}
