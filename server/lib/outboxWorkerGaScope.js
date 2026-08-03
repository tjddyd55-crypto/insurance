/**
 * Outbox workers: list tenant ids via systemQuery, then process each with safeQuery + ga_id = $n.
 * (storage orphan cron 과 동일 패턴 — GA guard 비활성화/전역 SELECT 금지)
 */

import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   table: 'claim_alimtalk_outbox' | 'notification_push_outbox'
 *   maxAttempts: number
 * }} input
 * @returns {Promise<number[]>}
 */
export async function listOutboxGaIdsWithDueRows(db, input) {
  const table = input.table
  const maxAttempts = Math.max(1, Number(input.maxAttempts) || 1)
  if (table !== 'claim_alimtalk_outbox' && table !== 'notification_push_outbox') {
    return []
  }

  const permanentClause =
    table === 'claim_alimtalk_outbox' ? 'AND permanent_failure = false' : ''

  const r = await systemQuery(
    db,
    `
    SELECT DISTINCT ga_id
    FROM ${table}
    WHERE ga_id IS NOT NULL
      AND status IN ('PENDING', 'FAILED')
      ${permanentClause}
      AND next_attempt_at <= NOW()
      AND attempt_count < $1
    ORDER BY ga_id ASC
    `,
    [maxAttempts],
  )

  return r.rows
    .map((row) => Number(row.ga_id))
    .filter((id) => Number.isInteger(id) && id >= 1)
}

/**
 * ga_id NULL 인 due row 는 발송하지 않고 quarantine.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {'claim_alimtalk_outbox' | 'notification_push_outbox'} table
 */
export async function quarantineOutboxRowsMissingGaId(db, table) {
  if (table !== 'claim_alimtalk_outbox' && table !== 'notification_push_outbox') {
    return 0
  }
  if (table === 'claim_alimtalk_outbox') {
    const r = await systemQuery(
      db,
      `
      UPDATE claim_alimtalk_outbox
      SET status = 'FAILED',
          permanent_failure = true,
          last_error = 'missing_ga_id',
          updated_at = NOW()
      WHERE ga_id IS NULL
        AND status IN ('PENDING', 'FAILED', 'PROCESSING')
        AND permanent_failure = false
      `,
    )
    return Number(r.rowCount ?? 0)
  }

  const r = await systemQuery(
    db,
    `
    UPDATE notification_push_outbox
    SET status = 'FAILED',
        last_error = 'missing_ga_id',
        attempt_count = GREATEST(attempt_count, 99),
        updated_at = NOW()
    WHERE ga_id IS NULL
      AND status IN ('PENDING', 'FAILED', 'PROCESSING')
    `,
  )
  return Number(r.rowCount ?? 0)
}

/**
 * Worker tick overlap 방지 래퍼.
 * @param {() => Promise<unknown>} tickFn
 * @param {{ runningRef: { current: boolean }, label: string, onError?: (err: unknown) => void }} opts
 */
export function runExclusiveWorkerTick(tickFn, opts) {
  if (opts.runningRef.current) {
    return
  }
  opts.runningRef.current = true
  void tickFn()
    .catch((err) => {
      if (typeof opts.onError === 'function') {
        opts.onError(err)
        return
      }
      console.error(`[${opts.label}] tick failed`, err instanceof Error ? err.message : err)
    })
    .finally(() => {
      opts.runningRef.current = false
    })
}
