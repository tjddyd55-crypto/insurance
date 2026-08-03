import { safeQuery, systemQuery } from '../../utils/dbSafeQuery.js'
import {
  listOutboxGaIdsWithDueRows,
  quarantineOutboxRowsMissingGaId,
} from '../outboxWorkerGaScope.js'
import { getFirebaseMessaging, isFirebasePushConfigured } from './fcmClient.js'
import { listActivePushDevicesForUser, revokePushDeviceByToken } from './pushDeviceService.js'

const MAX_ATTEMPTS = 8

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   gaId: number
 *   notificationId: number | null
 *   recipientUserId: string
 *   eventType: string
 *   dedupeKey: string
 *   payload: Record<string, unknown>
 * }} input
 */
export async function enqueuePushOutbox(db, input) {
  const recipientUserId = String(input.recipientUserId ?? '').trim()
  const eventType = String(input.eventType ?? '').trim()
  const dedupeKey = String(input.dedupeKey ?? '').trim()
  const gaId = Number(input.gaId)
  if (!recipientUserId || !eventType || !dedupeKey) {
    return null
  }
  if (!Number.isInteger(gaId) || gaId < 1) {
    return null
  }

  const r = await safeQuery(
    db,
    `
    INSERT INTO notification_push_outbox (
      ga_id, notification_id, recipient_user_id, event_type, dedupe_key, payload_json, status
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'PENDING')
    ON CONFLICT (dedupe_key, recipient_user_id)
    DO NOTHING
    RETURNING id
    `,
    [
      gaId,
      input.notificationId != null && Number.isInteger(Number(input.notificationId))
        ? Number(input.notificationId)
        : null,
      recipientUserId,
      eventType,
      dedupeKey,
      JSON.stringify(input.payload ?? {}),
    ],
  )
  return r.rows[0]?.id ?? null
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ limit?: number }} [opts]
 */
export async function processPendingPushOutbox(pool, opts = {}) {
  if (!isFirebasePushConfigured()) {
    return { processed: 0, skipped: true, reason: 'firebase_not_configured' }
  }
  const limitPerGa = Math.min(Math.max(Number(opts.limit) || 20, 1), 100)

  await quarantineOutboxRowsMissingGaId(pool, 'notification_push_outbox').catch(() => 0)
  const gaIds = await listOutboxGaIdsWithDueRows(pool, {
    table: 'notification_push_outbox',
    maxAttempts: MAX_ATTEMPTS,
  })

  let processed = 0
  for (const gaId of gaIds) {
    const due = await safeQuery(
      pool,
      `
      SELECT id, ga_id, notification_id, recipient_user_id, event_type, dedupe_key, payload_json, attempt_count
      FROM notification_push_outbox
      WHERE ga_id = $1
        AND status IN ('PENDING', 'FAILED')
        AND next_attempt_at <= NOW()
        AND attempt_count < $2
      ORDER BY id ASC
      LIMIT $3
      `,
      [gaId, MAX_ATTEMPTS, limitPerGa],
    )

    for (const row of due.rows) {
      const claimed = await safeQuery(
        pool,
        `
        UPDATE notification_push_outbox
        SET status = 'PROCESSING', updated_at = NOW()
        WHERE id = $1
          AND ga_id = $2
          AND status IN ('PENDING', 'FAILED')
        RETURNING id
        `,
        [row.id, gaId],
      )
      if (!claimed.rows[0]) continue

      try {
        await deliverOutboxRow(pool, { ...row, ga_id: gaId })
        await safeQuery(
          pool,
          `
          UPDATE notification_push_outbox
          SET status = 'SENT', sent_at = NOW(), last_error = NULL, updated_at = NOW()
          WHERE id = $1 AND ga_id = $2
          `,
          [row.id, gaId],
        )
        processed += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const attempt = Number(row.attempt_count ?? 0) + 1
        const delaySec = Math.min(60 * 2 ** Math.min(attempt, 6), 3600)
        await safeQuery(
          pool,
          `
          UPDATE notification_push_outbox
          SET status = 'FAILED',
              attempt_count = $3,
              next_attempt_at = NOW() + ($4 || ' seconds')::interval,
              last_error = $5,
              updated_at = NOW()
          WHERE id = $1 AND ga_id = $2
          `,
          [row.id, gaId, attempt, String(delaySec), message.slice(0, 1000)],
        )
      }
    }
  }
  return { processed, skipped: false, gaCount: gaIds.length }
}

/**
 * @param {import('pg').Pool} pool
 * @param {any} row
 */
async function deliverOutboxRow(pool, row) {
  const messaging = getFirebaseMessaging()
  if (!messaging) {
    throw new Error('Firebase messaging unavailable')
  }

  const recipientUserId = String(row.recipient_user_id)
  const gaId = Number(row.ga_id)
  const active = await safeQuery(
    pool,
    `
    SELECT id, ga_id
    FROM users
    WHERE id = $1
      AND ga_id = $2
      AND is_deleted = false
      AND COALESCE(LOWER(status), 'active') NOT IN ('disabled', 'blocked', 'deleted')
    LIMIT 1
    `,
    [recipientUserId, gaId],
  )
  if (!active.rows[0]) {
    throw new Error('recipient_inactive')
  }

  const devices = await listActivePushDevicesForUser(pool, recipientUserId, gaId)
  if (devices.length === 0) {
    return
  }

  const payload = row.payload_json && typeof row.payload_json === 'object' ? row.payload_json : {}
  const title = String(payload.title ?? '새로운 보험 청구가 접수되었습니다.')
  const body = String(payload.body ?? '고객앱에서 새로운 청구가 접수되었습니다.')
  const data = {}
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    if (value == null) continue
    data[String(key)] = String(value)
  }

  for (const device of devices) {
    try {
      await messaging.send({
        token: device.device_token,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'claim_notifications',
            sound: 'default',
          },
        },
      })
    } catch (error) {
      const code = error?.code || error?.errorInfo?.code || ''
      if (
        String(code).includes('registration-token-not-registered') ||
        String(code).includes('invalid-registration-token') ||
        /not.?registered|invalid.?token/i.test(String(error?.message ?? ''))
      ) {
        await revokePushDeviceByToken(pool, device.device_token, gaId)
        continue
      }
      throw error
    }
  }
}

/** Backfill helper for existing rows (additive migration). */
export async function backfillNotificationPushOutboxGaId(pool) {
  await systemQuery(
    pool,
    `
    UPDATE notification_push_outbox o
    SET ga_id = u.ga_id,
        updated_at = NOW()
    FROM users u
    WHERE o.ga_id IS NULL
      AND o.recipient_user_id = u.id
      AND u.ga_id IS NOT NULL
    `,
  )
}
