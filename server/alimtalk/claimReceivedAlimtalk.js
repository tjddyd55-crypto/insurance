/**
 * 고객앱 청구 접수 → 담당 CRM 사용자 카카오 알림톡 (UJ_9750).
 * COMMIT 이후 enqueue only — Aligo 호출은 outbox worker.
 */

import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  getClaimReceivedAlimtalkDiagnostics,
  isClaimReceivedRealSendAllowed,
  isInsuranceAlimtalkCredentialsComplete,
  loadInsuranceAlimtalkConfig,
  resolveAlimtalkRuntimeTier,
} from './alimtalkConfig.js'
import { maskAlimtalkReceiver, normalizeAlimtalkPhone, validateAlimtalkPhone } from './alimtalkPhone.js'
import { insertAlimtalkSendLog } from './alimtalkLogService.js'
import { sendAligoAlimtalk, isAligoAlimtalkSuccessCode } from './alimtalkProvider.js'
import {
  CLAIM_RECEIVED_SUBJECT,
  TEMPLATE_KEY_CLAIM_RECEIVED,
  buildClaimReceivedButtonPayload,
  buildClaimReceivedMessage,
  resolveClaimReceivedTplCode,
} from './alimtalkTemplates.js'

export const CLAIM_RECEIVED_EVENT = 'CUSTOMER_CLAIM_SUBMITTED'
export const CLAIM_ALIMTALK_CHANNEL = 'KAKAO_ALIMTALK'

const MAX_ATTEMPTS = 6

/**
 * Asia/Seoul `YYYY-MM-DD HH:mm` — 청구 submitted_at 기준 (별도 now() 사용 금지).
 * @param {string | Date | null | undefined} value
 */
export function formatClaimSubmittedAtLabel(value) {
  if (value == null || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}`
}

/**
 * @param {{ claimRequestId: number, recipientUserId: string }} input
 */
export function buildClaimAlimtalkDedupeKey(input) {
  return `claim-alimtalk:${Number(input.claimRequestId)}:${String(input.recipientUserId).trim()}`
}

/**
 * 영구 실패 — 재시도 금지 (미승인 템플릿 포함).
 * @param {{ providerCode?: number | null, providerMessage?: string | null, httpStatus?: number | null }} input
 */
export function isClaimAlimtalkPermanentFailure(input) {
  const code = input.providerCode
  const msg = String(input.providerMessage ?? '').toLowerCase()
  const httpStatus = input.httpStatus

  if (code === -99) return true
  if (
    /미승인|승인\s*전|승인되지|검수|템플릿.*(없|불|일치|오류)|template|tpl.?code|senderkey|sender.?key|잘못된\s*수신|수신번호|invalid.*(phone|template|sender)/i.test(
      msg,
    )
  ) {
    return true
  }
  if (code != null && Number.isFinite(code) && code !== 0 && code < 0 && code !== -1) {
    // Aligo business errors are typically negative; -1 sometimes transient
    if (/timeout|network|일시|temporary|server error|5\d\d/.test(msg)) return false
    return true
  }
  if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403 || httpStatus === 404) {
    return true
  }
  return false
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} agentId
 */
export async function loadClaimAlimtalkRecipient(db, agentId) {
  const id = String(agentId ?? '').trim()
  if (!id) return null
  const r = await safeQuery(
    db,
    `
    SELECT id, ga_id, phone_number, status, is_deleted
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  )
  const row = r.rows[0]
  if (!row) return null
  if (row.is_deleted === true) return { skipReason: 'deleted' }
  const status = String(row.status ?? 'active').trim().toLowerCase()
  if (status === 'disabled' || status === 'blocked' || status === 'deleted') {
    return { skipReason: 'inactive' }
  }
  const digits = normalizeAlimtalkPhone(row.phone_number)
  const phoneErr = validateAlimtalkPhone(digits)
  if (phoneErr || !digits) {
    return { skipReason: 'invalid_phone', userId: row.id, gaId: row.ga_id }
  }
  return {
    userId: String(row.id),
    gaId: row.ga_id != null ? Number(row.ga_id) : null,
    phoneDigits: digits,
    receiverMasked: maskAlimtalkReceiver(digits),
  }
}

/**
 * COMMIT 이후 호출. 실패해도 throw 하지 않음.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   agentId: string
 *   gaId?: number | null
 *   customerId: number
 *   claimRequestId: number
 *   customerName?: string | null
 *   submittedAt: string | Date
 *   config?: ReturnType<typeof loadInsuranceAlimtalkConfig>
 * }} input
 */
export async function enqueueClaimReceivedAlimtalk(db, input) {
  const config = input.config ?? loadInsuranceAlimtalkConfig()
  if (!config.claimReceivedEnabled) {
    return { enqueued: false, reason: 'disabled' }
  }

  const claimRequestId = Number(input.claimRequestId)
  const customerId = Number(input.customerId)
  if (!Number.isInteger(claimRequestId) || claimRequestId < 1) {
    return { enqueued: false, reason: 'invalid_claim' }
  }
  if (!Number.isInteger(customerId) || customerId < 1) {
    return { enqueued: false, reason: 'invalid_customer' }
  }

  const recipient = await loadClaimAlimtalkRecipient(db, input.agentId)
  if (!recipient || recipient.skipReason) {
    console.info('[claim-alimtalk] skip enqueue', {
      reason: recipient?.skipReason ?? 'no_recipient',
      claimRequestId,
      agentIdPresent: Boolean(String(input.agentId ?? '').trim()),
    })
    return { enqueued: false, reason: recipient?.skipReason ?? 'no_recipient' }
  }

  const customerName = String(input.customerName ?? '').trim() || '고객'
  const submittedAtLabel = formatClaimSubmittedAtLabel(input.submittedAt)
  if (!submittedAtLabel) {
    return { enqueued: false, reason: 'invalid_submitted_at' }
  }

  const tplCode = resolveClaimReceivedTplCode() || config.claimReceivedTplCode
  const dedupeKey = buildClaimAlimtalkDedupeKey({
    claimRequestId,
    recipientUserId: recipient.userId,
  })

  const r = await safeQuery(
    db,
    `
    INSERT INTO claim_alimtalk_outbox (
      event_type, channel, recipient_user_id, ga_id, claim_request_id, customer_id,
      template_code, customer_name, submitted_at_label,
      receiver_digits, receiver_masked, dedupe_key, status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12, 'PENDING'
    )
    ON CONFLICT (dedupe_key, recipient_user_id)
    DO NOTHING
    RETURNING id
    `,
    [
      CLAIM_RECEIVED_EVENT,
      CLAIM_ALIMTALK_CHANNEL,
      recipient.userId,
      recipient.gaId ?? input.gaId ?? null,
      claimRequestId,
      customerId,
      tplCode,
      customerName,
      submittedAtLabel,
      recipient.phoneDigits,
      recipient.receiverMasked,
      dedupeKey,
    ],
  )

  return {
    enqueued: Boolean(r.rows[0]?.id),
    outboxId: r.rows[0]?.id ?? null,
    dedupeKey,
    receiverMasked: recipient.receiverMasked,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ limit?: number, sendFn?: typeof sendAligoAlimtalk, config?: ReturnType<typeof loadInsuranceAlimtalkConfig> }} [opts]
 */
export async function processPendingClaimAlimtalkOutbox(pool, opts = {}) {
  const config = opts.config ?? loadInsuranceAlimtalkConfig()
  const sendFn = opts.sendFn ?? sendAligoAlimtalk
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 100)

  if (!config.claimReceivedEnabled) {
    return { processed: 0, skipped: true, reason: 'disabled' }
  }

  const due = await safeQuery(
    pool,
    `
    SELECT *
    FROM claim_alimtalk_outbox
    WHERE status IN ('PENDING', 'FAILED')
      AND permanent_failure = false
      AND next_attempt_at <= NOW()
      AND attempt_count < $1
    ORDER BY id ASC
    LIMIT $2
    `,
    [MAX_ATTEMPTS, limit],
  )

  let processed = 0
  for (const row of due.rows) {
    const claimed = await safeQuery(
      pool,
      `
      UPDATE claim_alimtalk_outbox
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id = $1 AND status IN ('PENDING', 'FAILED') AND permanent_failure = false
      RETURNING id
      `,
      [row.id],
    )
    if (!claimed.rows[0]) continue

    try {
      await deliverClaimAlimtalkRow(pool, row, { config, sendFn })
      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const attempt = Number(row.attempt_count ?? 0) + 1
      const permanent = /permanent:/i.test(message) || attempt >= MAX_ATTEMPTS
      const delaySec = Math.min(60 * 2 ** Math.min(attempt, 5), 1800)
      await safeQuery(
        pool,
        `
        UPDATE claim_alimtalk_outbox
        SET status = 'FAILED',
            attempt_count = $2,
            next_attempt_at = NOW() + ($3 || ' seconds')::interval,
            last_error = $4,
            permanent_failure = $5,
            updated_at = NOW()
        WHERE id = $1
        `,
        [row.id, attempt, String(delaySec), message.slice(0, 1000), permanent],
      )
    }
  }

  return {
    processed,
    skipped: false,
    diagnostics: getClaimReceivedAlimtalkDiagnostics(config),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {any} row
 * @param {{ config: ReturnType<typeof loadInsuranceAlimtalkConfig>, sendFn: typeof sendAligoAlimtalk }} deps
 */
async function deliverClaimAlimtalkRow(pool, row, deps) {
  const { config, sendFn } = deps
  const receiverDigits = String(row.receiver_digits ?? '').replace(/\D/g, '')
  const receiverMasked = String(row.receiver_masked ?? maskAlimtalkReceiver(receiverDigits))

  if (!isInsuranceAlimtalkCredentialsComplete(config)) {
    await markPermanentFailed(pool, row, {
      lastError: 'credentials_missing',
      providerCode: null,
    })
    return
  }

  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  const realSendAllowed = isClaimReceivedRealSendAllowed(config, {
    receiverDigits,
    nodeEnv,
  })

  if (!realSendAllowed) {
    const tier = resolveAlimtalkRuntimeTier({ nodeEnv })
    const reason =
      tier === 'production'
        ? 'real_send_not_allowed'
        : config.claimDevRealSendEnabled
          ? 'dev_allowlist_blocked'
          : 'dev_real_send_disabled'
    await markPermanentFailed(pool, row, {
      lastError: reason,
      providerCode: null,
    })
    await insertAlimtalkSendLog(pool, {
      gaId: row.ga_id,
      userId: row.recipient_user_id,
      customerId: row.customer_id,
      templateKey: TEMPLATE_KEY_CLAIM_RECEIVED,
      tplCode: row.template_code,
      receiverMasked,
      status: 'blocked',
      provider: config.provider,
      providerMessageId: null,
      providerCode: null,
      providerMessage: reason,
      dryRun: true,
      requestContext: {
        eventType: CLAIM_RECEIVED_EVENT,
        claimRequestId: row.claim_request_id,
        dedupeKey: row.dedupe_key,
        reason,
      },
    }).catch(() => {})
    return
  }

  const message = buildClaimReceivedMessage({
    customerName: row.customer_name,
    submittedAtLabel: row.submitted_at_label,
  })
  const buttonPayload = buildClaimReceivedButtonPayload()

  // 청구 전용 실발송 — 전역 DRY_RUN 을 무시하고 dryRun:false 로 호출
  const result = await sendFn({
    config,
    dryRun: false,
    tplCode: String(row.template_code),
    templateKey: TEMPLATE_KEY_CLAIM_RECEIVED,
    receiver: receiverDigits,
    subject: CLAIM_RECEIVED_SUBJECT,
    message,
    buttonPayload,
    recvName: String(row.customer_name ?? '고객').trim() || '고객',
  })

  await insertAlimtalkSendLog(pool, {
    gaId: row.ga_id,
    userId: row.recipient_user_id,
    customerId: row.customer_id,
    templateKey: TEMPLATE_KEY_CLAIM_RECEIVED,
    tplCode: row.template_code,
    receiverMasked,
    status: result.status,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    providerCode: result.providerCode,
    providerMessage: result.providerMessage,
    dryRun: Boolean(result.dryRun),
    requestContext: {
      eventType: CLAIM_RECEIVED_EVENT,
      claimRequestId: row.claim_request_id,
      dedupeKey: row.dedupe_key,
      buttonCount: 0,
      hasLink: false,
    },
  }).catch((err) => {
    console.error('[claim-alimtalk] send log failed', err instanceof Error ? err.message : err)
  })

  if (isAligoAlimtalkSuccessCode(result.providerCode) && result.status === 'accepted') {
    await safeQuery(
      pool,
      `
      UPDATE claim_alimtalk_outbox
      SET status = 'SENT',
          sent_at = NOW(),
          attempt_count = attempt_count + 1,
          provider_code = $2,
          provider_message_id = $3,
          last_error = NULL,
          permanent_failure = false,
          updated_at = NOW()
      WHERE id = $1
      `,
      [row.id, result.providerCode, result.providerMessageId],
    )
    return
  }

  const permanent = isClaimAlimtalkPermanentFailure({
    providerCode: result.providerCode,
    providerMessage: result.providerMessage,
    httpStatus: result.httpStatus,
  })
  const attempt = Number(row.attempt_count ?? 0) + 1
  const terminal = permanent || attempt >= MAX_ATTEMPTS
  const delaySec = Math.min(60 * 2 ** Math.min(attempt, 5), 1800)
  const errText = String(result.providerMessage ?? 'provider_failed').slice(0, 1000)

  await safeQuery(
    pool,
    `
    UPDATE claim_alimtalk_outbox
    SET status = 'FAILED',
        attempt_count = $2,
        next_attempt_at = NOW() + ($3 || ' seconds')::interval,
        last_error = $4,
        provider_code = $5,
        provider_message_id = $6,
        permanent_failure = $7,
        updated_at = NOW()
    WHERE id = $1
    `,
    [
      row.id,
      attempt,
      String(delaySec),
      errText,
      result.providerCode,
      result.providerMessageId,
      terminal,
    ],
  )

  if (!terminal) {
    // transient — leave FAILED with next_attempt for worker
    return
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {any} row
 * @param {{ lastError: string, providerCode: number | null }} info
 */
async function markPermanentFailed(pool, row, info) {
  await safeQuery(
    pool,
    `
    UPDATE claim_alimtalk_outbox
    SET status = 'FAILED',
        attempt_count = attempt_count + 1,
        last_error = $2,
        provider_code = $3,
        permanent_failure = true,
        updated_at = NOW()
    WHERE id = $1
    `,
    [row.id, String(info.lastError).slice(0, 1000), info.providerCode],
  )
}

export { getClaimReceivedAlimtalkDiagnostics }
