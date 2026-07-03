import { isConsentR2Enabled, r2DeleteObject, isR2ObjectNotFoundError } from '../lib/consentStorage.js'
import { canDeleteNewsletter } from '../lib/newsletterDeletePermission.js'

/**
 * @param {unknown} payload
 * @returns {Set<string>}
 */
function collectObjectKeysFromCustomerNewsPayload(payload) {
  const keys = new Set()
  if (!payload || typeof payload !== 'object') {
    return keys
  }
  const raw = /** @type {{ attachments?: unknown, heroImageUrl?: unknown }} */ (payload).attachments
  if (!Array.isArray(raw)) {
    return keys
  }
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const key = String(/** @type {{ objectKey?: unknown }} */ (entry).objectKey ?? '').trim()
    if (key) {
      keys.add(key)
    }
  }
  return keys
}

function isCustomerNewsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const row = /** @type {{ insurerSlug?: unknown }} */ (payload)
  return String(row.insurerSlug ?? '').trim() === 'customer-news'
}

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   actorUserId: string
 *   actorRole: string | undefined
 *   gaId: number
 *   newsId: string
 *   targetCustomerId: number | null
 * }} args
 * @returns {Promise<{ ok: true, deletedId: string } | { ok: false, status: number, message: string }>}
 */
export async function deleteCustomerNewsletter(pool, args) {
  const { actorUserId, actorRole, gaId, newsId, targetCustomerId } = args
  const actorId = String(actorUserId ?? '').trim()
  if (!actorId) {
    return { ok: false, status: 401, message: '로그인이 필요합니다.' }
  }

  const rowRes = await pool.query(
    `
    SELECT id, ga_id, payload
    FROM insurance_company_newsletters
    WHERE id = $1
      AND ga_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [newsId, gaId],
  )

  if (rowRes.rowCount === 0) {
    return { ok: false, status: 404, message: '삭제할 소식지를 찾을 수 없습니다.' }
  }

  const row = rowRes.rows[0]
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  if (!isCustomerNewsPayload(payload)) {
    return { ok: false, status: 404, message: '삭제할 소식지를 찾을 수 없습니다.' }
  }

  const publisherId = String(/** @type {{ publisherId?: unknown }} */ (payload).publisherId ?? '').trim()
  const scopeRaw = String(/** @type {{ customerNewsScope?: unknown }} */ (payload).customerNewsScope ?? 'all')
    .trim()
    .toLowerCase()
  const scope = scopeRaw === 'personal' ? 'personal' : 'all'

  if (!canDeleteNewsletter({ userId: actorId, role: actorRole }, { publisherId })) {
    return { ok: false, status: 403, message: '이 소식지를 삭제할 권한이 없습니다.' }
  }

  const payloadTargetIdRaw = /** @type {{ targetCustomerId?: unknown }} */ (payload).targetCustomerId
  const payloadTargetId =
    payloadTargetIdRaw != null && Number.isFinite(Number(payloadTargetIdRaw)) ? Number(payloadTargetIdRaw) : null

  if (scope === 'personal' && targetCustomerId != null && payloadTargetId != null && targetCustomerId !== payloadTargetId) {
    return { ok: false, status: 403, message: '이 소식지를 삭제할 권한이 없습니다.' }
  }

  const attRes = await pool.query(
    `SELECT object_key FROM insurance_company_newsletter_attachments WHERE newsletter_id = $1`,
    [newsId],
  )

  const objectKeys = collectObjectKeysFromCustomerNewsPayload(payload)
  for (const r of attRes.rows) {
    const k = String(r.object_key ?? '').trim()
    if (k) {
      objectKeys.add(k)
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM customer_news_reads WHERE news_id = hashtextextended($1::text, 0)`, [newsId])
    // soft-delete: row 보존(복구·이력) + deleted_at 기록. 첨부(R2)는 아래에서 즉시 제거.
    const del = await client.query(
      `UPDATE insurance_company_newsletters SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND ga_id = $2 AND deleted_at IS NULL`,
      [newsId, gaId],
    )
    if (del.rowCount === 0) {
      await client.query('ROLLBACK')
      return { ok: false, status: 404, message: '삭제할 소식지를 찾을 수 없습니다.' }
    }
    await client.query('COMMIT')
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw err
  } finally {
    client.release()
  }

  /** TODO(multi-tenant R2): 고객 소식 삭제 전 objectKey 허용 prefix 검증(insurer/, CRM_R2_OBJECT_ROOT 접두 등)으로 테넌트 밖 삭제 방지 — 후속 PR */
  if (isConsentR2Enabled() && objectKeys.size > 0) {
    for (const objectKey of objectKeys) {
      try {
        await r2DeleteObject(objectKey)
      } catch (errDel) {
        if (isR2ObjectNotFoundError(errDel)) {
          continue
        }
        return {
          ok: false,
          status: 502,
          message: '스토리지에서 첨부 파일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        }
      }
    }
  }

  return { ok: true, deletedId: newsId }
}
