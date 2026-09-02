/**
 * public 고객등록 링크 완료 → 담당 CRM 사용자 카카오 알림톡.
 * COMMIT 이후 enqueue only — Aligo 호출은 outbox worker.
 * POST /api/customers · Excel · admin 직접 생성 경로에서는 호출하지 않는다.
 */

import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  listOutboxGaIdsWithDueRows,
  quarantineOutboxRowsMissingGaId,
} from '../lib/outboxWorkerGaScope.js'
import { isQaSafeMode } from '../lib/qaSafeMode.js'
import { isKakaoDeliveryAllowedForEvent } from '../lib/notifications/eventChannelPolicy.js'
import {
  getCustomerRegistrationCompletedAlimtalkDiagnostics as getCustomerRegistrationCompletedAlimtalkDiagnosticsBase,
  isCustomerRegistrationCompletedRealSendAllowed,
  isInsuranceAlimtalkCredentialsComplete,
  loadInsuranceAlimtalkConfig,
  resolveAlimtalkRuntimeTier,
} from './alimtalkConfig.js'
import { maskAlimtalkReceiver } from './alimtalkPhone.js'
import { insertAlimtalkSendLog } from './alimtalkLogService.js'
import { sendAligoAlimtalk, isAligoAlimtalkSuccessCode } from './alimtalkProvider.js'
import {
  CUSTOMER_REGISTRATION_COMPLETED_SUBJECT,
  TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED,
  buildCustomerRegistrationCompletedButtonPayload,
  buildCustomerRegistrationCompletedMessage,
  isPlaceholderTplCode,
  resolveCustomerRegistrationCompletedTplCode,
} from './alimtalkTemplates.js'
import {
  formatClaimSubmittedAtLabel,
  isClaimAlimtalkPermanentFailure,
  loadClaimAlimtalkRecipient,
} from './claimReceivedAlimtalk.js'
import { buildCustomerCrmCheckUrl } from './customerCrmCheckUrl.js'
import {
  resolveCustomerRegistrationTemplateSendGate,
  peekCachedAligoTemplateStatus,
  TEMPLATE_STATUS_CACHE_TTL_MS,
} from './alimtalkTemplateStatus.js'

export const CUSTOMER_REGISTRATION_COMPLETED_EVENT = 'PUBLIC_CUSTOMER_REGISTRATION_COMPLETED'
export const CUSTOMER_REGISTRATION_ALIMTALK_CHANNEL = 'KAKAO_ALIMTALK'
export const OUTBOX_TABLE = 'customer_registration_alimtalk_outbox'

const MAX_ATTEMPTS = 6
const TEMPLATE_STATUS_RETRY_SEC = Math.max(Math.floor(TEMPLATE_STATUS_CACHE_TTL_MS / 1000), 60)

/** @type {typeof formatClaimSubmittedAtLabel} */
export const formatRegistrationCompletedAtLabel = formatClaimSubmittedAtLabel

/**
 * @param {{ customerId: number, recipientUserId: string }} input
 */
export function buildCustomerRegistrationCompletedDedupeKey(input) {
  return `reg-complete-alimtalk:${Number(input.customerId)}:${String(input.recipientUserId).trim()}`
}

/**
 * COMMIT 이후 호출. 실패해도 throw 하지 않음.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   agentId: string
 *   gaId?: number | null
 *   customerId: number
 *   customerName?: string | null
 *   registeredAt: string | Date
 *   customerCheckUrl?: string | null
 *   reqLike?: { protocol?: string, host?: string } | null
 *   config?: ReturnType<typeof loadInsuranceAlimtalkConfig>
 * }} input
 */
export async function enqueueCustomerRegistrationCompletedAlimtalk(db, input) {
  if (isQaSafeMode()) {
    return { enqueued: false, reason: 'qa_safe_mode' }
  }
  if (!isKakaoDeliveryAllowedForEvent('customer_created', input.channelPolicyOpts ?? {})) {
    return { enqueued: false, reason: 'dev_native_push_replaces_kakao' }
  }
  const config = input.config ?? loadInsuranceAlimtalkConfig()
  if (!config.customerRegistrationCompletedEnabled) {
    return { enqueued: false, reason: 'disabled' }
  }

  const tplCode =
    resolveCustomerRegistrationCompletedTplCode() || config.customerRegistrationCompletedTplCode
  if (!tplCode || isPlaceholderTplCode(tplCode)) {
    console.info('[customer-registration-alimtalk] skip enqueue', {
      reason: 'TEMPLATE_NOT_CONFIGURED',
      customerId: Number(input.customerId) || null,
    })
    return { enqueued: false, reason: 'TEMPLATE_NOT_CONFIGURED' }
  }

  const customerId = Number(input.customerId)
  const contextGaId = Number(input.gaId)
  if (!Number.isInteger(customerId) || customerId < 1) {
    return { enqueued: false, reason: 'invalid_customer' }
  }
  if (!Number.isInteger(contextGaId) || contextGaId < 1) {
    console.info('[customer-registration-alimtalk] skip enqueue', {
      reason: 'missing_ga',
      customerId,
      agentIdPresent: Boolean(String(input.agentId ?? '').trim()),
    })
    return { enqueued: false, reason: 'missing_ga' }
  }

  const recipient = await loadClaimAlimtalkRecipient(db, input.agentId, contextGaId)
  if (!recipient || recipient.skipReason) {
    const reason =
      recipient?.skipReason === 'invalid_phone'
        ? 'OWNER_PHONE_MISSING'
        : (recipient?.skipReason ?? 'no_recipient')
    console.info('[customer-registration-alimtalk] skip enqueue', {
      reason,
      customerId,
      gaId: contextGaId,
      userId: recipient?.userId ?? null,
    })
    return { enqueued: false, reason }
  }
  if (!Number.isInteger(recipient.gaId) || recipient.gaId < 1 || recipient.gaId !== contextGaId) {
    console.info('[customer-registration-alimtalk] skip enqueue', {
      reason: 'ga_mismatch',
      customerId,
      gaId: contextGaId,
      recipientUserId: recipient.userId,
    })
    return { enqueued: false, reason: 'ga_mismatch' }
  }

  const customerName = String(input.customerName ?? '').trim() || '신규 고객'
  const registeredAtLabel = formatRegistrationCompletedAtLabel(input.registeredAt)
  if (!registeredAtLabel) {
    return { enqueued: false, reason: 'invalid_registered_at' }
  }

  const customerCheckUrl =
    String(input.customerCheckUrl ?? '').trim() ||
    buildCustomerCrmCheckUrl({
      customerId,
      reqLike: input.reqLike ?? null,
    })
  if (!customerCheckUrl) {
    console.info('[customer-registration-alimtalk] skip enqueue', {
      reason: 'missing_check_url',
      customerId,
      userId: recipient.userId,
    })
    return { enqueued: false, reason: 'missing_check_url' }
  }

  const dedupeKey = buildCustomerRegistrationCompletedDedupeKey({
    customerId,
    recipientUserId: recipient.userId,
  })

  const r = await safeQuery(
    db,
    `
    INSERT INTO ${OUTBOX_TABLE} (
      event_type, channel, recipient_user_id, ga_id, customer_id,
      template_code, customer_name, registered_at_label, customer_check_url,
      receiver_digits, receiver_masked, dedupe_key, status
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, 'PENDING'
    )
    ON CONFLICT (dedupe_key, recipient_user_id)
    DO NOTHING
    RETURNING id
    `,
    [
      CUSTOMER_REGISTRATION_COMPLETED_EVENT,
      CUSTOMER_REGISTRATION_ALIMTALK_CHANNEL,
      recipient.userId,
      contextGaId,
      customerId,
      tplCode,
      customerName,
      registeredAtLabel,
      customerCheckUrl,
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
export async function processPendingCustomerRegistrationAlimtalkOutbox(pool, opts = {}) {
  if (isQaSafeMode()) {
    return { processed: 0, skipped: true, reason: 'qa_safe_mode' }
  }
  if (!isKakaoDeliveryAllowedForEvent('customer_created', opts.channelPolicyOpts ?? {})) {
    return { processed: 0, skipped: true, reason: 'dev_native_push_replaces_kakao' }
  }
  const config = opts.config ?? loadInsuranceAlimtalkConfig()
  const sendFn = opts.sendFn ?? sendAligoAlimtalk
  const limitPerGa = Math.min(Math.max(Number(opts.limit) || 20, 1), 100)

  if (!config.customerRegistrationCompletedEnabled) {
    return { processed: 0, skipped: true, reason: 'disabled' }
  }

  await quarantineOutboxRowsMissingGaId(pool, OUTBOX_TABLE).catch(() => 0)
  const gaIds = await listOutboxGaIdsWithDueRows(pool, {
    table: OUTBOX_TABLE,
    maxAttempts: MAX_ATTEMPTS,
  })

  let processed = 0
  for (const gaId of gaIds) {
    const due = await safeQuery(
      pool,
      `
      SELECT *
      FROM ${OUTBOX_TABLE}
      WHERE ga_id = $1
        AND status IN ('PENDING', 'FAILED')
        AND permanent_failure = false
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
        UPDATE ${OUTBOX_TABLE}
        SET status = 'PROCESSING', updated_at = NOW()
        WHERE id = $1
          AND ga_id = $2
          AND status IN ('PENDING', 'FAILED')
          AND permanent_failure = false
        RETURNING id
        `,
        [row.id, gaId],
      )
      if (!claimed.rows[0]) continue

      try {
        await deliverCustomerRegistrationAlimtalkRow(pool, { ...row, ga_id: gaId }, { config, sendFn })
        processed += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const attempt = Number(row.attempt_count ?? 0) + 1
        const permanent = /permanent:/i.test(message) || attempt >= MAX_ATTEMPTS
        const delaySec = Math.min(60 * 2 ** Math.min(attempt, 5), 1800)
        await safeQuery(
          pool,
          `
          UPDATE ${OUTBOX_TABLE}
          SET status = 'FAILED',
              attempt_count = $3,
              next_attempt_at = NOW() + ($4 || ' seconds')::interval,
              last_error = $5,
              permanent_failure = $6,
              updated_at = NOW()
          WHERE id = $1 AND ga_id = $2
          `,
          [row.id, gaId, attempt, String(delaySec), message.slice(0, 1000), permanent],
        )
      }
    }
  }

  return {
    processed,
    skipped: false,
    gaCount: gaIds.length,
    diagnostics: getCustomerRegistrationCompletedAlimtalkDiagnostics(config),
  }
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} [config]
 */
export function getCustomerRegistrationCompletedAlimtalkDiagnostics(
  config = loadInsuranceAlimtalkConfig(),
) {
  const base = getCustomerRegistrationCompletedAlimtalkDiagnosticsBase(config)
  const tplCode = String(base.templateCode ?? '').trim()
  const cached = tplCode ? peekCachedAligoTemplateStatus(tplCode) : null
  const templateStatus = cached?.inspStatus ?? null
  let reason = null
  if (!base.enabled) reason = 'FEATURE_DISABLED'
  else if (!base.allowRealSend) reason = 'REAL_SEND_DISABLED'
  else if (!base.credentialsReady) reason = 'CREDENTIALS_MISSING'
  else if (!tplCode) reason = 'TEMPLATE_NOT_CONFIGURED'
  else if (!cached) reason = 'TEMPLATE_STATUS_UNKNOWN'
  else if (!cached.ok) reason = cached.reason || 'TEMPLATE_STATUS_UNAVAILABLE'
  else if (cached.inspStatus === 'APR') reason = null
  else if (cached.inspStatus === 'REJ') reason = 'TEMPLATE_REJECTED'
  else reason = 'SKIPPED_TEMPLATE_NOT_APPROVED'

  const readyToSend =
    Boolean(base.enabled) &&
    Boolean(base.allowRealSend) &&
    Boolean(base.credentialsReady) &&
    Boolean(tplCode) &&
    cached?.ok === true &&
    cached?.inspStatus === 'APR'

  return {
    ...base,
    templateStatus,
    readyToSend,
    reason,
    statusCacheTtlMs: TEMPLATE_STATUS_CACHE_TTL_MS,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {any} row
 * @param {{ config: ReturnType<typeof loadInsuranceAlimtalkConfig>, sendFn: typeof sendAligoAlimtalk }} deps
 */
async function deliverCustomerRegistrationAlimtalkRow(pool, row, deps) {
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

  const tplCode = String(row.template_code ?? '').trim()
  if (!tplCode || isPlaceholderTplCode(tplCode)) {
    await markPermanentFailed(pool, row, {
      lastError: 'TEMPLATE_NOT_CONFIGURED',
      providerCode: null,
    })
    return
  }

  const templateGate = await resolveCustomerRegistrationTemplateSendGate(config, tplCode)
  if (!templateGate.allowSend) {
    const reason = templateGate.reason || 'SKIPPED_TEMPLATE_NOT_APPROVED'
    if (templateGate.terminalSkip) {
      await markPermanentFailed(pool, row, {
        lastError: reason,
        providerCode: null,
      })
      await insertAlimtalkSendLog(pool, {
        gaId: row.ga_id,
        userId: row.recipient_user_id,
        customerId: row.customer_id,
        templateKey: TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED,
        tplCode,
        receiverMasked,
        status: 'blocked',
        provider: config.provider,
        providerMessageId: null,
        providerCode: null,
        providerMessage: reason,
        dryRun: true,
        requestContext: {
          eventType: CUSTOMER_REGISTRATION_COMPLETED_EVENT,
          customerId: row.customer_id,
          dedupeKey: row.dedupe_key,
          reason,
          templateStatus: templateGate.templateStatus,
        },
      }).catch(() => {})
      return
    }
    // TEMPLATE_STATUS_UNAVAILABLE 등 — 재시도 (승인 후 과거 일괄 발송과 무관)
    const attempt = Number(row.attempt_count ?? 0) + 1
    const delaySec = Math.max(Math.floor(TEMPLATE_STATUS_RETRY_SEC), 60)
    await safeQuery(
      pool,
      `
      UPDATE ${OUTBOX_TABLE}
      SET status = 'FAILED',
          attempt_count = $3,
          next_attempt_at = NOW() + ($4 || ' seconds')::interval,
          last_error = $5,
          permanent_failure = false,
          updated_at = NOW()
      WHERE id = $1 AND ga_id = $2
      `,
      [row.id, row.ga_id, attempt, String(delaySec), reason.slice(0, 1000)],
    )
    return
  }

  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  const realSendAllowed = isCustomerRegistrationCompletedRealSendAllowed(config, {
    receiverDigits,
    nodeEnv,
  })

  if (!realSendAllowed) {
    const tier = resolveAlimtalkRuntimeTier({ nodeEnv })
    const reason =
      tier === 'production'
        ? 'REAL_SEND_DISABLED'
        : config.customerRegistrationCompletedDevRealSendEnabled
          ? 'dev_allowlist_blocked'
          : 'DRY_RUN'
    await markPermanentFailed(pool, row, {
      lastError: reason,
      providerCode: null,
    })
    await insertAlimtalkSendLog(pool, {
      gaId: row.ga_id,
      userId: row.recipient_user_id,
      customerId: row.customer_id,
      templateKey: TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED,
      tplCode,
      receiverMasked,
      status: 'blocked',
      provider: config.provider,
      providerMessageId: null,
      providerCode: null,
      providerMessage: reason,
      dryRun: true,
      requestContext: {
        eventType: CUSTOMER_REGISTRATION_COMPLETED_EVENT,
        customerId: row.customer_id,
        dedupeKey: row.dedupe_key,
        reason,
      },
    }).catch(() => {})
    return
  }

  const message = buildCustomerRegistrationCompletedMessage({
    customerName: row.customer_name,
    registeredAtLabel: row.registered_at_label,
  })
  const buttonPayload = buildCustomerRegistrationCompletedButtonPayload({
    customerCheckUrl: row.customer_check_url,
  })

  const result = await sendFn({
    config,
    dryRun: false,
    tplCode,
    templateKey: TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED,
    receiver: receiverDigits,
    subject: CUSTOMER_REGISTRATION_COMPLETED_SUBJECT,
    message,
    buttonPayload,
    recvName: String(row.customer_name ?? '신규 고객').trim() || '신규 고객',
  })

  await insertAlimtalkSendLog(pool, {
    gaId: row.ga_id,
    userId: row.recipient_user_id,
    customerId: row.customer_id,
    templateKey: TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED,
    tplCode,
    receiverMasked,
    status: result.status,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    providerCode: result.providerCode,
    providerMessage: result.providerMessage,
    dryRun: Boolean(result.dryRun),
    requestContext: {
      eventType: CUSTOMER_REGISTRATION_COMPLETED_EVENT,
      customerId: row.customer_id,
      dedupeKey: row.dedupe_key,
      buttonCount: 1,
      hasLink: true,
    },
  }).catch((err) => {
    console.error(
      '[customer-registration-alimtalk] send log failed',
      err instanceof Error ? err.message : err,
    )
  })

  if (isAligoAlimtalkSuccessCode(result.providerCode) && result.status === 'accepted') {
    await safeQuery(
      pool,
      `
      UPDATE ${OUTBOX_TABLE}
      SET status = 'SENT',
          sent_at = NOW(),
          attempt_count = attempt_count + 1,
          provider_code = $3,
          provider_message_id = $4,
          last_error = NULL,
          permanent_failure = false,
          updated_at = NOW()
      WHERE id = $1 AND ga_id = $2
      `,
      [row.id, row.ga_id, result.providerCode, result.providerMessageId],
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
    UPDATE ${OUTBOX_TABLE}
    SET status = 'FAILED',
        attempt_count = $3,
        next_attempt_at = NOW() + ($4 || ' seconds')::interval,
        last_error = $5,
        provider_code = $6,
        provider_message_id = $7,
        permanent_failure = $8,
        updated_at = NOW()
    WHERE id = $1 AND ga_id = $2
    `,
    [
      row.id,
      row.ga_id,
      attempt,
      String(delaySec),
      errText,
      result.providerCode,
      result.providerMessageId,
      terminal,
    ],
  )
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
    UPDATE ${OUTBOX_TABLE}
    SET status = 'FAILED',
        attempt_count = attempt_count + 1,
        last_error = $3,
        provider_code = $4,
        permanent_failure = true,
        updated_at = NOW()
    WHERE id = $1 AND ga_id = $2
    `,
    [row.id, row.ga_id, String(info.lastError).slice(0, 1000), info.providerCode],
  )
}
