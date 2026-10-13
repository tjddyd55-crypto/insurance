import { isR2ObjectNotFoundError, r2DeleteObject, r2StorageObjectExists } from '../lib/consentStorage.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeObjectKeyList(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const keys = []
  for (const entry of value) {
    const key = String(entry ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

/**
 * @param {string[]} objectKeys
 */
export async function assertR2ObjectsExist(objectKeys) {
  const keys = normalizeObjectKeyList(objectKeys)
  for (const key of keys) {
    const exists = await r2StorageObjectExists(key)
    if (!exists) {
      throw Object.assign(new Error('스토리지 객체가 준비되지 않았습니다.'), { httpStatus: 500 })
    }
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient | null | undefined} executor
 * @param {object} input
 * @param {string[]} input.objectKeys
 * @param {string} input.reason
 * @param {number | null} [input.shareId]
 * @param {number | null} [input.importJobId]
 * @param {string | null} [input.userId]
 * @param {number | null} [input.gaId]
 */
export async function recordR2OrphanCleanupQueue(executor, input) {
  if (!executor) return
  const keys = normalizeObjectKeyList(input.objectKeys)
  if (keys.length === 0) return
  for (const key of keys) {
    await safeQuery(
      executor,
      `
      INSERT INTO personal_binder_ga_r2_cleanup_queue (
        object_key, reason, share_id, import_job_id, user_id, ga_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (object_key) DO UPDATE SET
        reason = EXCLUDED.reason,
        share_id = COALESCE(EXCLUDED.share_id, personal_binder_ga_r2_cleanup_queue.share_id),
        import_job_id = COALESCE(EXCLUDED.import_job_id, personal_binder_ga_r2_cleanup_queue.import_job_id),
        retry_count = personal_binder_ga_r2_cleanup_queue.retry_count + 1,
        last_error = NULL,
        updated_at = NOW()
      `,
      [
        key,
        String(input.reason ?? 'unknown').slice(0, 120),
        input.shareId ?? null,
        input.importJobId ?? null,
        input.userId ?? null,
        input.gaId ?? null,
      ],
    )
  }
}

/**
 * DB 확정 전 복사된 R2 객체를 보상 삭제한다. 실패 키는 정리 큐에 남긴다.
 * @param {string[]} objectKeys
 * @param {object} [context]
 * @param {import('pg').Pool | import('pg').PoolClient} [context.executor]
 * @param {string} [context.reason]
 * @param {number} [context.shareId]
 * @param {number} [context.importJobId]
 * @param {string} [context.userId]
 * @param {number} [context.gaId]
 */
export async function compensateR2ObjectKeys(objectKeys, context = {}) {
  const keys = normalizeObjectKeyList(objectKeys)
  const failed = []
  for (const key of keys) {
    try {
      await r2DeleteObject(key)
    } catch (error) {
      if (!isR2ObjectNotFoundError(error)) {
        failed.push(key)
      }
    }
  }
  if (failed.length > 0 && context.executor) {
    for (const key of failed) {
      await recordR2OrphanCleanupQueue(context.executor, {
        objectKeys: [key],
        reason: context.reason ?? 'compensate_delete_failed',
        shareId: context.shareId ?? null,
        importJobId: context.importJobId ?? null,
        userId: context.userId ?? null,
        gaId: context.gaId ?? null,
      }).catch(() => {})
    }
  }
  return { deleted: keys.length - failed.length, failed }
}
