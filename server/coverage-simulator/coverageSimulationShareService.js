import { randomBytes } from 'node:crypto'

import { consentGetBuffer, consentPutObject } from '../lib/consentStorage.js'
import { parseGaId } from '../lib/parseGaId.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

const MAX_SNAPSHOT_BYTES = 512_000

export function generateCoverageShareToken() {
  return randomBytes(32).toString('base64url')
}

export function maskShareTokenForLog(token) {
  const raw = String(token ?? '').trim()
  if (raw.length <= 8) return '****'
  return `${raw.slice(0, 4)}…`
}

/**
 * @param {import('express').Request} req
 * @param {string} token
 */
export function buildCoverageSharePageUrl(req, token) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim()
  if (!host) {
    return `/coverage/share/${encodeURIComponent(token)}`
  }
  return `${proto}://${host}/coverage/share/${encodeURIComponent(token)}`
}

function assertScenarioPayload(scenario, consultationId) {
  if (!scenario || typeof scenario !== 'object') {
    throw Object.assign(new Error('scenario가 필요합니다.'), { httpStatus: 400 })
  }
  const id = String(scenario.id ?? '').trim()
  if (!id || id !== String(consultationId ?? '').trim()) {
    throw Object.assign(new Error('consultationId와 scenario.id가 일치해야 합니다.'), { httpStatus: 400 })
  }
  if (!Array.isArray(scenario.items)) {
    throw Object.assign(new Error('scenario.items가 필요합니다.'), { httpStatus: 400 })
  }
  const json = JSON.stringify(scenario)
  if (json.length > MAX_SNAPSHOT_BYTES) {
    throw Object.assign(new Error('시나리오 데이터가 너무 큽니다.'), { httpStatus: 400 })
  }
  return scenario
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} input
 */
export async function createCoverageSimulationShare(pool, input) {
  const {
    gaId,
    userId,
    consultationId,
    scenario,
  } = input
  const normalized = assertScenarioPayload(scenario, consultationId)
  const token = generateCoverageShareToken()
  const title = String(normalized.title ?? '보장 시뮬레이션').trim() || '보장 시뮬레이션'
  const customerName =
    normalized.customerNameSnapshot != null
      ? String(normalized.customerNameSnapshot).trim() || null
      : normalized.customerName != null
        ? String(normalized.customerName).trim() || null
        : null

  const insert = await safeQuery(
    pool,
    `
    INSERT INTO coverage_simulation_shares (
      ga_id,
      consultation_id,
      share_token,
      title_snapshot,
      customer_id,
      customer_name_snapshot,
      scenario_name_snapshot,
      scenario_snapshot,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
    RETURNING id, share_token, created_at, pdf_object_key
    `,
    [
      gaId,
      consultationId,
      token,
      title,
      normalized.customerId != null ? String(normalized.customerId) : null,
      customerName,
      title,
      JSON.stringify(normalized),
      userId,
    ],
    { allowUnscoped: true },
  )
  return insert.rows[0]
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listCoverageSimulationShares(pool, gaId, userId, consultationId) {
  const result = await safeQuery(
    pool,
    `
    SELECT id, share_token, title_snapshot, created_at, revoked_at, last_viewed_at, view_count, pdf_object_key
    FROM coverage_simulation_shares
    WHERE ga_id = $1 AND created_by_user_id = $2 AND consultation_id = $3
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [gaId, userId, consultationId],
    { allowUnscoped: true },
  )
  return result.rows
}

/**
 * @param {import('pg').Pool} pool
 */
export async function revokeCoverageSimulationShare(pool, gaId, userId, shareId) {
  const result = await safeQuery(
    pool,
    `
    UPDATE coverage_simulation_shares
    SET revoked_at = NOW()
    WHERE id = $1 AND ga_id = $2 AND created_by_user_id = $3 AND revoked_at IS NULL
    RETURNING id
    `,
    [shareId, gaId, userId],
    { allowUnscoped: true },
  )
  return result.rowCount > 0
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} token
 */
async function findCoverageShareByToken(pool, token) {
  const normalized = String(token ?? '').trim()
  if (!normalized) return { status: 'not_found' }

  const result = await safeQuery(
    pool,
    `
    SELECT
      id,
      share_token,
      title_snapshot,
      customer_name_snapshot,
      scenario_snapshot,
      created_at,
      expires_at,
      revoked_at,
      pdf_object_key
    FROM coverage_simulation_shares
    WHERE share_token = $1
    LIMIT 1
    `,
    [normalized],
    { allowUnscoped: true },
  )
  const row = result.rows[0]
  if (!row) return { status: 'not_found' }
  if (row.revoked_at) return { status: 'revoked' }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { status: 'expired' }
  }
  return { status: 'ok', row }
}

export async function getPublicCoverageShareByToken(pool, token, options = {}) {
  const resolved = await findCoverageShareByToken(pool, token)
  if (resolved.status !== 'ok' || !options.recordView) {
    return resolved
  }
  await safeQuery(
    pool,
    `
    UPDATE coverage_simulation_shares
    SET view_count = view_count + 1, last_viewed_at = NOW()
    WHERE id = $1
    `,
    [resolved.row.id],
    { allowUnscoped: true },
  )
  return resolved
}

export function toPublicViewerPayload(row) {
  return {
    title: row.title_snapshot,
    customerName: row.customer_name_snapshot,
    sharedAt: row.created_at,
    scenario: row.scenario_snapshot,
    pdfReady: Boolean(row.pdf_object_key),
  }
}

export function coverageSharePdfObjectKey(shareId) {
  return `coverage-simulator/shares/${shareId}/document.pdf`
}

/**
 * @param {import('pg').Pool} pool
 */
export async function attachCoverageSharePdf(pool, gaId, userId, shareId, pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw Object.assign(new Error('PDF 데이터가 비어 있습니다.'), { httpStatus: 400 })
  }
  if (pdfBuffer.length > 15 * 1024 * 1024) {
    throw Object.assign(new Error('PDF 파일이 너무 큽니다.'), { httpStatus: 400 })
  }
  const owned = await safeQuery(
    pool,
    `
    SELECT id FROM coverage_simulation_shares
    WHERE id = $1 AND ga_id = $2 AND created_by_user_id = $3 AND revoked_at IS NULL
    LIMIT 1
    `,
    [shareId, gaId, userId],
    { allowUnscoped: true },
  )
  if (!owned.rows[0]) {
    throw Object.assign(new Error('공유 자료를 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  const key = coverageSharePdfObjectKey(shareId)
  await consentPutObject(key, pdfBuffer, 'application/pdf')
  await safeQuery(
    pool,
    `UPDATE coverage_simulation_shares SET pdf_object_key = $2 WHERE id = $1`,
    [shareId, key],
    { allowUnscoped: true },
  )
  return key
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} token
 */
export async function loadCoverageSharePdfBuffer(pool, token) {
  const resolved = await findCoverageShareByToken(pool, token)
  if (resolved.status !== 'ok') {
    return resolved
  }
  const key = resolved.row.pdf_object_key
  if (!key) {
    return { status: 'pdf_missing', row: resolved.row }
  }
  const buffer = await consentGetBuffer(key)
  return { status: 'ok', row: resolved.row, buffer }
}

/**
 * @param {import('express').Request} req
 */
export function resolveShareOwnerContext(req, res) {
  const userId = req.user?.id ? String(req.user.id) : ''
  if (!userId) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId ?? req.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}
