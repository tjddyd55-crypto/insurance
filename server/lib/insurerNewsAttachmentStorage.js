import { isConsentR2Enabled, isR2ObjectNotFoundError, r2DeleteObject, r2StorageObjectExists } from './consentStorage.js'
import { insurerNewsLog } from './logger.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

const INSURER_NEWS_KEY_MARKERS = ['/news/', '/newsletters/', 'insurer-news/']

/**
 * @param {string} objectKey
 */
export function looksLikeInsurerNewsAttachmentObjectKey(objectKey) {
  const k = String(objectKey ?? '')
    .trim()
    .replace(/^\//, '')
    .replace(/^platform-assets\//, '')
  if (!k) {
    return false
  }
  if (!k.startsWith('insurer/') && !k.startsWith('insurer-news/')) {
    return false
  }
  return INSURER_NEWS_KEY_MARKERS.some((marker) => k.includes(marker))
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} objectKey
 */
export async function isInsurerNewsAttachmentObjectKeyReferenced(pool, objectKey) {
  const k = String(objectKey ?? '').trim()
  if (!k) {
    return false
  }
  const res = await safeQuery(
    pool,
    `
    SELECT 1
    FROM insurance_company_newsletter_attachments
    WHERE object_key = $1
    LIMIT 1
    `,
    [k],
  )
  return res.rowCount > 0
}

/**
 * DB 삭제 이후 R2 object를 정리한다. 실패해도 throw 하지 않고 로그만 남긴다.
 * @param {string[]} objectKeys
 * @param {Record<string, unknown>} [context]
 */
export async function deleteInsurerNewsR2ObjectsAfterDb(objectKeys, context = {}) {
  /** @type {{ attempted: number; deleted: number; missing: number; failed: number; failures: { objectKey: string; error: string }[] }} */
  const stats = { attempted: 0, deleted: 0, missing: 0, failed: 0, failures: [] }
  if (!isConsentR2Enabled()) {
    return stats
  }
  const seen = new Set()
  for (const raw of objectKeys) {
    const objectKey = String(raw ?? '').trim()
    if (!objectKey || seen.has(objectKey)) {
      continue
    }
    seen.add(objectKey)
    stats.attempted += 1
    try {
      await r2DeleteObject(objectKey)
      stats.deleted += 1
      insurerNewsLog.info({
        event: 'insurer-news-r2-delete',
        stage: 'after-db',
        objectKey,
        ...context,
      })
    } catch (err) {
      if (isR2ObjectNotFoundError(err)) {
        stats.missing += 1
        continue
      }
      stats.failed += 1
      const message = err instanceof Error ? err.message : String(err)
      stats.failures.push({ objectKey, error: message })
      insurerNewsLog.error({
        event: 'insurer-news-r2-delete-fail',
        stage: 'after-db',
        objectKey,
        err: message,
        ...context,
      })
    }
  }
  return stats
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} objectKey
 */
export async function assertSafeToDeleteInsurerNewsR2Object(pool, objectKey) {
  if (await isInsurerNewsAttachmentObjectKeyReferenced(pool, objectKey)) {
    throw new Error('newsletter attachment still references object key')
  }
}

/**
 * audit script 공용 — attachment row의 R2 존재 여부.
 * @param {string} objectKey
 */
export async function insurerNewsAttachmentExistsInR2(objectKey) {
  const k = String(objectKey ?? '').trim()
  if (!k) {
    return false
  }
  return r2StorageObjectExists(k)
}
