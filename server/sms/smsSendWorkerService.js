import { systemQuery } from '../utils/dbSafeQuery.js'
import { classifyGatewayProviderError } from './smsProviderErrors.js'
import { isSmsModuleEnabled, isSmsRealSendEnabled } from './smsModuleConfig.js'
import { loadDecryptedAligoCredentials } from './smsSettingsService.js'
import { resolveSmsProvider } from './smsProviderFactory.js'
import { composeAdvertisementSmsMessage, resolveMessageType } from './smsMessageUtils.js'
import { normalizeSmsPhone } from './smsPhone.js'

const TRANSIENT_ERROR_CODES = new Set(['network_error', 'provider_error'])
const PERMANENT_ERROR_CODES = new Set([
  'invalid_api_key',
  'sender_not_registered',
  'insufficient_balance',
  'invalid_receiver',
  'gateway_auth_error',
  'real_send_disabled',
  'invalid_phone',
  'opt_out',
])

const RETRY_DELAYS_MS = [60_000, 5 * 60_000]

const DEFAULT_RUNTIME = {
  workerId: 'sms-sender-worker',
  batchSize: 20,
  concurrency: 1,
  rateLimitPerMinute: 30,
  pollIntervalMs: 5000,
  idleBackoffMs: 10000,
  staleLockMinutes: 10,
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0))
  })
}

export function resolveSmsSendWorkerRuntimeConfig(options = {}) {
  const batchSizeRaw = options.batchSize ?? process.env.SMS_SEND_WORKER_BATCH_SIZE ?? DEFAULT_RUNTIME.batchSize
  const batchSizeNum = Number(batchSizeRaw)
  const batchSize =
    Number.isFinite(batchSizeNum) && batchSizeNum > 0 ? Math.min(200, Math.floor(batchSizeNum)) : DEFAULT_RUNTIME.batchSize

  const concurrencyRaw = options.concurrency ?? process.env.SMS_SEND_WORKER_CONCURRENCY ?? DEFAULT_RUNTIME.concurrency
  const concurrencyNum = Number(concurrencyRaw)
  const concurrency =
    Number.isFinite(concurrencyNum) && concurrencyNum > 0
      ? Math.min(20, Math.floor(concurrencyNum))
      : DEFAULT_RUNTIME.concurrency

  const rateLimitRaw =
    options.rateLimitPerMinute ?? process.env.SMS_SEND_WORKER_RATE_LIMIT_PER_MINUTE ?? DEFAULT_RUNTIME.rateLimitPerMinute
  const rateLimitNum = Number(rateLimitRaw)
  const rateLimitPerMinute =
    Number.isFinite(rateLimitNum) && rateLimitNum > 0
      ? Math.min(600, Math.floor(rateLimitNum))
      : DEFAULT_RUNTIME.rateLimitPerMinute

  const pollRaw = options.pollIntervalMs ?? process.env.SMS_SEND_WORKER_POLL_INTERVAL_MS ?? DEFAULT_RUNTIME.pollIntervalMs
  const pollNum = Number(pollRaw)
  const pollIntervalMs =
    Number.isFinite(pollNum) && pollNum >= 0 ? Math.min(60_000, Math.floor(pollNum)) : DEFAULT_RUNTIME.pollIntervalMs

  const idleRaw = options.idleBackoffMs ?? process.env.SMS_SEND_WORKER_IDLE_BACKOFF_MS ?? DEFAULT_RUNTIME.idleBackoffMs
  const idleNum = Number(idleRaw)
  const idleBackoffMs =
    Number.isFinite(idleNum) && idleNum >= 0 ? Math.min(120_000, Math.floor(idleNum)) : DEFAULT_RUNTIME.idleBackoffMs

  const staleRaw =
    options.staleLockMinutes ?? process.env.SMS_SEND_WORKER_STALE_LOCK_MINUTES ?? DEFAULT_RUNTIME.staleLockMinutes
  const staleNum = Number(staleRaw)
  const staleLockMinutes =
    Number.isFinite(staleNum) && staleNum > 0 ? Math.min(120, Math.floor(staleNum)) : DEFAULT_RUNTIME.staleLockMinutes

  return {
    workerId: String(options.workerId ?? process.env.SMS_SEND_WORKER_ID ?? DEFAULT_RUNTIME.workerId).trim() || DEFAULT_RUNTIME.workerId,
    batchSize,
    concurrency,
    rateLimitPerMinute,
    pollIntervalMs,
    idleBackoffMs,
    staleLockMinutes,
    maxIterations: options.maxIterations ?? null,
    sleepFn: options.sleepFn ?? sleep,
    manageSignals: options.manageSignals !== false,
  }
}

export function createSendRateLimiter(maxPerMinute, sleepFn = sleep) {
  let windowStart = Date.now()
  let count = 0
  const limit = Number(maxPerMinute)
  return {
    async waitForSlot() {
      if (!Number.isFinite(limit) || limit <= 0) {
        return
      }
      const now = Date.now()
      if (now - windowStart >= 60_000) {
        windowStart = now
        count = 0
      }
      if (count >= limit) {
        const waitMs = Math.max(0, 60_000 - (now - windowStart))
        await sleepFn(waitMs)
        windowStart = Date.now()
        count = 0
      }
      count += 1
    },
  }
}

function readWorkerId() {
  return resolveSmsSendWorkerRuntimeConfig().workerId
}

function readBatchSize() {
  return resolveSmsSendWorkerRuntimeConfig().batchSize
}

function computeRetryScheduledFor(attemptCount) {
  const index = Math.max(0, Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1))
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString()
}

function isTransientFailure(code) {
  return TRANSIENT_ERROR_CODES.has(String(code ?? ''))
}

function isPermanentFailure(code) {
  return PERMANENT_ERROR_CODES.has(String(code ?? ''))
}

export async function claimSmsSendJobs(executor, { batchSize, workerId, shouldStop } = {}) {
  if (shouldStop?.()) {
    return []
  }
  const limit = batchSize ?? readBatchSize()
  const lockedBy = workerId ?? readWorkerId()
  const r = await systemQuery(
    executor,
    `
    WITH picked AS (
      SELECT id
      FROM sms_send_jobs
      WHERE status IN ('queued', 'retry')
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC, created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE sms_send_jobs
    SET status = 'processing',
        locked_at = NOW(),
        locked_by = $2,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM picked)
    RETURNING *
    `,
    [limit, lockedBy],
  )
  return r.rows
}

/**
 * processing 상태로 오래 멈춘 job을 retry 또는 failed로 복구한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ staleLockMinutes?: number }} [options]
 */
export async function recoverStaleProcessingJobs(executor, options = {}) {
  const staleLockMinutes =
    Number(options.staleLockMinutes ?? process.env.SMS_SEND_WORKER_STALE_LOCK_MINUTES ?? DEFAULT_RUNTIME.staleLockMinutes) ||
    DEFAULT_RUNTIME.staleLockMinutes

  const r = await systemQuery(
    executor,
    `
    UPDATE sms_send_jobs
    SET status = CASE
          WHEN attempt_count >= max_attempts THEN 'failed'
          ELSE 'retry'
        END,
        scheduled_for = CASE
          WHEN attempt_count >= max_attempts THEN scheduled_for
          ELSE NOW()
        END,
        locked_at = NULL,
        locked_by = NULL,
        error_code = CASE
          WHEN attempt_count >= max_attempts THEN 'stale_lock_failed'
          ELSE 'stale_lock_recovered'
        END,
        error_message = 'Stale processing lock recovered after worker interruption.',
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < NOW() - ($1 * INTERVAL '1 minute')
    RETURNING id
    `,
    [staleLockMinutes],
  )
  return Number(r.rowCount ?? 0)
}

async function recordScheduledDelivery(executor, job, {
  scheduledRunAt,
  status,
  providerMessageId = null,
  errorCode = null,
  errorMessage = null,
  sentAt = null,
}) {
  const scheduledMessageId = Number(job.source_id)
  if (!Number.isInteger(scheduledMessageId) || scheduledMessageId <= 0) {
    return
  }
  await systemQuery(
    executor,
    `
    INSERT INTO sms_scheduled_message_deliveries (
      scheduled_message_id, customer_id, phone, scheduled_run_at, status,
      provider_message_id, error_code, error_message, sent_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (scheduled_message_id, phone, scheduled_run_at) DO UPDATE
    SET status = EXCLUDED.status,
        provider_message_id = EXCLUDED.provider_message_id,
        error_code = EXCLUDED.error_code,
        error_message = EXCLUDED.error_message,
        sent_at = EXCLUDED.sent_at
    `,
    [
      scheduledMessageId,
      job.customer_id != null ? Number(job.customer_id) : null,
      String(job.phone ?? ''),
      scheduledRunAt,
      status,
      providerMessageId,
      errorCode,
      errorMessage,
      sentAt,
    ],
  )
}

async function updateSmsRecipientForJob(executor, job, {
  status,
  providerMessageId = null,
  failReason = null,
  skipReason = null,
}) {
  if (job.campaign_id == null || job.customer_id == null) {
    return
  }
  await systemQuery(
    executor,
    `
    UPDATE sms_recipients
    SET status = $4,
        provider_message_id = COALESCE($5, provider_message_id),
        fail_reason = $6,
        skip_reason = $7,
        sent_at = CASE WHEN $4 = 'success' THEN NOW() ELSE sent_at END
    WHERE campaign_id = $1
      AND tenant_id = $2
      AND customer_id = $3
      AND phone = $8
    `,
    [
      job.campaign_id,
      job.tenant_id,
      job.customer_id,
      status,
      providerMessageId,
      failReason,
      skipReason,
      String(job.phone ?? ''),
    ],
  )
}

async function finalizeJob(executor, job, patch) {
  await systemQuery(
    executor,
    `
    UPDATE sms_send_jobs
    SET status = $2,
        attempt_count = $3,
        scheduled_for = $4,
        provider_message_id = $5,
        error_code = $6,
        error_message = $7,
        sent_at = $8,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND status IN ('processing', 'queued', 'retry')
    `,
    [
      job.id,
      patch.status,
      patch.attemptCount,
      patch.scheduledFor,
      patch.providerMessageId ?? null,
      patch.errorCode ?? null,
      patch.errorMessage ?? null,
      patch.sentAt ?? null,
    ],
  )
}

async function processOneSendJob(executor, jobRow) {
  const job = jobRow
  const attemptCount = Number(job.attempt_count ?? 0) + 1
  const scope = { tenantId: Number(job.tenant_id), userId: String(job.user_id) }
  const scheduledRunAt =
    job.run_id != null
      ? (
          await systemQuery(
            executor,
            `SELECT scheduled_run_at FROM sms_scheduled_runs WHERE id = $1 LIMIT 1`,
            [job.run_id],
          )
        ).rows[0]?.scheduled_run_at ?? new Date().toISOString()
      : new Date().toISOString()

  if (!isSmsModuleEnabled()) {
    await finalizeJob(executor, job, {
      status: 'failed',
      attemptCount,
      scheduledFor: job.scheduled_for,
      errorCode: 'module_disabled',
      errorMessage: '문자 모듈이 비활성화되어 발송할 수 없습니다.',
    })
    await recordScheduledDelivery(executor, job, {
      scheduledRunAt,
      status: 'failed',
      errorCode: 'module_disabled',
      errorMessage: 'module disabled',
    })
    return { outcome: 'failed' }
  }

  if (!isSmsRealSendEnabled()) {
    await finalizeJob(executor, job, {
      status: 'skipped',
      attemptCount,
      scheduledFor: job.scheduled_for,
      errorCode: 'real_send_disabled',
      errorMessage: '실제 문자 발송이 비활성화되어 발송하지 않았습니다.',
    })
    await recordScheduledDelivery(executor, job, {
      scheduledRunAt,
      status: 'skipped',
      errorCode: 'real_send_disabled',
      errorMessage: 'real send disabled',
    })
    await updateSmsRecipientForJob(executor, job, {
      status: 'skipped',
      skipReason: 'real_send_disabled',
    })
    return { outcome: 'skipped' }
  }

  const phone = normalizeSmsPhone(job.phone)
  if (!phone) {
    await finalizeJob(executor, job, {
      status: 'skipped',
      attemptCount,
      scheduledFor: job.scheduled_for,
      errorCode: 'invalid_phone',
      errorMessage: '유효하지 않은 수신번호입니다.',
    })
    await recordScheduledDelivery(executor, job, {
      scheduledRunAt,
      status: 'skipped',
      errorCode: 'invalid_phone',
      errorMessage: 'invalid phone',
    })
    return { outcome: 'skipped' }
  }

  let messageToSend = String(job.message_body ?? '')
  if (job.is_advertising === true) {
    const creds = await loadDecryptedAligoCredentials(executor, scope)
    const composed = composeAdvertisementSmsMessage({
      body: messageToSend,
      adDisplayName: creds.adDisplayName,
    })
    if (!composed.ok) {
      await finalizeJob(executor, job, {
        status: 'failed',
        attemptCount,
        scheduledFor: job.scheduled_for,
        errorCode: composed.code,
        errorMessage: composed.publicMessage,
      })
      await recordScheduledDelivery(executor, job, {
        scheduledRunAt,
        status: 'failed',
        errorCode: composed.code,
        errorMessage: composed.publicMessage,
      })
      return { outcome: 'failed' }
    }
    messageToSend = composed.message
  }

  const creds = await loadDecryptedAligoCredentials(executor, scope)
  const provider = resolveSmsProvider()
  const sendResult = await provider.send({
    to: phone,
    from: String(job.sender_number ?? ''),
    message: messageToSend,
    messageType: resolveMessageType(messageToSend),
    providerUserId: creds.providerUserId,
    apiKey: creds.apiKey,
    requestId: `job:${job.id}`,
  })

  if (sendResult.success) {
    await finalizeJob(executor, job, {
      status: 'sent',
      attemptCount,
      scheduledFor: job.scheduled_for,
      providerMessageId: sendResult.providerMessageId ?? null,
      sentAt: new Date().toISOString(),
    })
    await recordScheduledDelivery(executor, job, {
      scheduledRunAt,
      status: 'success',
      providerMessageId: sendResult.providerMessageId ?? null,
      sentAt: new Date().toISOString(),
    })
    await updateSmsRecipientForJob(executor, job, {
      status: 'success',
      providerMessageId: sendResult.providerMessageId ?? null,
    })
    return { outcome: 'sent' }
  }

  const classified = classifyGatewayProviderError({
    errorCode: sendResult.errorCode,
    message: sendResult.errorMessage,
    network: sendResult.network === true,
    httpStatus: sendResult.httpStatus,
  })
  const errorCode = classified.code
  const errorMessage = classified.publicMessage

  if (isPermanentFailure(errorCode) || attemptCount >= Number(job.max_attempts ?? 3)) {
    await finalizeJob(executor, job, {
      status: 'failed',
      attemptCount,
      scheduledFor: job.scheduled_for,
      errorCode,
      errorMessage,
    })
    await recordScheduledDelivery(executor, job, {
      scheduledRunAt,
      status: 'failed',
      errorCode,
      errorMessage,
    })
    await updateSmsRecipientForJob(executor, job, {
      status: 'failed',
      failReason: errorMessage,
    })
    return { outcome: 'failed' }
  }

  if (isTransientFailure(errorCode)) {
    await finalizeJob(executor, job, {
      status: 'retry',
      attemptCount,
      scheduledFor: computeRetryScheduledFor(attemptCount),
      errorCode,
      errorMessage,
    })
    return { outcome: 'retry' }
  }

  await finalizeJob(executor, job, {
    status: 'failed',
    attemptCount,
    scheduledFor: job.scheduled_for,
    errorCode,
    errorMessage,
  })
  await recordScheduledDelivery(executor, job, {
    scheduledRunAt,
    status: 'failed',
    errorCode,
    errorMessage,
  })
  await updateSmsRecipientForJob(executor, job, {
    status: 'failed',
    failReason: errorMessage,
  })
  return { outcome: 'failed' }
}

async function refreshRunAggregates(executor, runId) {
  if (!runId) {
    return
  }
  const counts = await systemQuery(
    executor,
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
      COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count,
      COUNT(*) FILTER (WHERE status IN ('queued', 'retry', 'processing')) AS pending_count
    FROM sms_send_jobs
    WHERE run_id = $1
    `,
    [runId],
  )
  const row = counts.rows[0] ?? {}
  const sentCount = Number(row.sent_count ?? 0)
  const failedCount = Number(row.failed_count ?? 0)
  const skippedCount = Number(row.skipped_count ?? 0)
  const pendingCount = Number(row.pending_count ?? 0)

  let runStatus = 'processing'
  if (pendingCount === 0) {
    if (failedCount > 0 && sentCount > 0) {
      runStatus = 'partial_failed'
    } else if (failedCount > 0) {
      runStatus = 'failed'
    } else {
      runStatus = 'completed'
    }
  }

  const runUpdate = await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_runs
    SET sent_count = $2,
        failed_count = $3,
        skipped_count = $4,
        status = $5,
        finished_at = CASE WHEN $6 = 0 THEN NOW() ELSE finished_at END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING scheduled_message_id, campaign_id, scheduled_run_at
    `,
    [runId, sentCount, failedCount, skippedCount, runStatus, pendingCount],
  )

  if (runUpdate.rowCount === 0 || pendingCount > 0) {
    return
  }

  const runRow = runUpdate.rows[0]
  const campaignId = runRow.campaign_id != null ? Number(runRow.campaign_id) : null
  if (campaignId) {
    const recipientCounts = await systemQuery(
      executor,
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'success') AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS fail_count,
        COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count
      FROM sms_recipients
      WHERE campaign_id = $1
      `,
      [campaignId],
    )
    const cRow = recipientCounts.rows[0] ?? {}
    const campaignSuccess = Number(cRow.success_count ?? 0)
    const campaignFail = Number(cRow.fail_count ?? 0)
    const campaignSkipped = Number(cRow.skipped_count ?? 0)
    const finalCampaignStatus = campaignFail > 0 && campaignSuccess === 0 ? 'failed' : 'completed'
    await systemQuery(
      executor,
      `
      UPDATE sms_campaigns
      SET success_count = $2,
          fail_count = $3,
          skipped_count = $4,
          status = $5,
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [campaignId, campaignSuccess, campaignFail, campaignSkipped, finalCampaignStatus],
    )
  }

  const scheduledMessageId = Number(runRow.scheduled_message_id)
  const scheduleMeta = await systemQuery(
    executor,
    `SELECT schedule_type, status FROM sms_scheduled_messages WHERE id = $1 LIMIT 1`,
    [scheduledMessageId],
  )
  const scheduleType = String(scheduleMeta.rows[0]?.schedule_type ?? 'once')
  let messageStatus = scheduleMeta.rows[0]?.status
  if (scheduleType === 'once' && pendingCount === 0) {
    messageStatus = runStatus === 'failed' && sentCount === 0 ? 'failed' : 'completed'
    await systemQuery(
      executor,
      `
      UPDATE sms_scheduled_messages
      SET status = $2,
          last_error_code = CASE WHEN $3 > 0 AND $4 = 0 THEN 'send_failed' ELSE last_error_code END,
          last_error_message = CASE WHEN $3 > 0 AND $4 = 0 THEN '예약 발송에 실패했습니다.' ELSE last_error_message END,
          updated_at = NOW()
      WHERE id = $1
      `,
      [scheduledMessageId, messageStatus, failedCount, sentCount],
    )
  }
}

/**
 * queued/retry job을 claim 후 1 batch 처리한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   batchSize?: number;
 *   workerId?: string;
 *   concurrency?: number;
 *   rateLimitPerMinute?: number;
 *   shouldStop?: () => boolean;
 *   rateLimiter?: ReturnType<typeof createSendRateLimiter>;
 *   sleepFn?: (ms: number) => Promise<void>;
 * }} [options]
 */
export async function runSmsSendWorkerOnce(executor, options = {}) {
  const config = resolveSmsSendWorkerRuntimeConfig(options)
  const shouldStop = options.shouldStop ?? (() => false)

  if (shouldStop()) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, retry: 0, stopped: true }
  }

  const jobs = await claimSmsSendJobs(executor, {
    batchSize: config.batchSize,
    workerId: config.workerId,
    shouldStop,
  })
  if (!jobs.length) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, retry: 0 }
  }

  console.info('[sms-send-worker] batch claimed', {
    workerId: config.workerId,
    claimedCount: jobs.length,
  })

  const rateLimiter = options.rateLimiter ?? createSendRateLimiter(config.rateLimitPerMinute, config.sleepFn)
  const touchedRunIds = new Set()
  const summary = { claimed: jobs.length, sent: 0, failed: 0, skipped: 0, retry: 0 }
  const batchStartedAt = Date.now()

  for (let index = 0; index < jobs.length; index += config.concurrency) {
    const slice = jobs.slice(index, index + config.concurrency)
    const results = []
    for (const job of slice) {
      await rateLimiter.waitForSlot()
      results.push(await processOneSendJob(executor, job))
    }
    for (const job of slice) {
      if (job.run_id) {
        touchedRunIds.add(String(job.run_id))
      }
    }
    for (const result of results) {
      if (result.outcome === 'sent') {
        summary.sent += 1
      } else if (result.outcome === 'failed') {
        summary.failed += 1
      } else if (result.outcome === 'skipped') {
        summary.skipped += 1
      } else if (result.outcome === 'retry') {
        summary.retry += 1
      }
    }
  }

  for (const runId of touchedRunIds) {
    await refreshRunAggregates(executor, runId)
  }

  console.info('[sms-send-worker] batch finished', {
    workerId: config.workerId,
    claimedCount: summary.claimed,
    sentCount: summary.sent,
    failedCount: summary.failed,
    skippedCount: summary.skipped,
    retryCount: summary.retry,
    durationMs: Date.now() - batchStartedAt,
  })

  return summary
}

/**
 * runSmsSendWorkerOnce를 poll/backoff 루프로 반복 실행하는 persistent worker.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Parameters<typeof resolveSmsSendWorkerRuntimeConfig>[0]} [options]
 */
export async function runSmsSendWorkerPersistent(executor, options = {}) {
  const config = resolveSmsSendWorkerRuntimeConfig(options)
  let shouldStop = false
  const getShouldStop = () => shouldStop || options.shouldStop?.() === true

  const requestStop = () => {
    console.info('[sms-send-worker] graceful shutdown requested', { workerId: config.workerId })
    shouldStop = true
  }

  if (config.manageSignals) {
    process.on('SIGTERM', requestStop)
    process.on('SIGINT', requestStop)
  }

  try {
    const recoveredCount = await recoverStaleProcessingJobs(executor, {
      staleLockMinutes: config.staleLockMinutes,
    })
    if (recoveredCount > 0) {
      console.info('[sms-send-worker] stale jobs recovered', {
        workerId: config.workerId,
        recoveredCount,
      })
    }

    console.info('[sms-send-worker] started', {
      workerId: config.workerId,
      mode: 'persistent',
      batchSize: config.batchSize,
      concurrency: config.concurrency,
      rateLimitPerMinute: config.rateLimitPerMinute,
      pollIntervalMs: config.pollIntervalMs,
      idleBackoffMs: config.idleBackoffMs,
    })

    const rateLimiter = createSendRateLimiter(config.rateLimitPerMinute, config.sleepFn)
    let iterations = 0

    while (!getShouldStop()) {
      if (config.maxIterations != null && iterations >= config.maxIterations) {
        break
      }
      iterations += 1

      const result = await runSmsSendWorkerOnce(executor, {
        ...config,
        shouldStop: getShouldStop,
        rateLimiter,
        manageSignals: false,
      })

      if (getShouldStop()) {
        break
      }

      if (result.claimed > 0) {
        await config.sleepFn(config.pollIntervalMs)
      } else {
        console.info('[sms-send-worker] idle', { workerId: config.workerId })
        await config.sleepFn(config.idleBackoffMs)
      }
    }

    console.info('[sms-send-worker] stopped', { workerId: config.workerId })
    return { stopped: true, iterations }
  } finally {
    if (config.manageSignals) {
      process.removeListener('SIGTERM', requestStop)
      process.removeListener('SIGINT', requestStop)
    }
  }
}
