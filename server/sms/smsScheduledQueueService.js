import { randomUUID } from 'node:crypto'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { createSmsCampaign } from './smsCampaignService.js'
import { loadSmsRecipientGroupMembers, touchSmsRecipientGroupLastSent } from './smsRecipientGroupService.js'
import { isSmsModuleEnabled } from './smsModuleConfig.js'
import { getSmsSettings } from './smsSettingsService.js'
import { renderSmsTemplate } from './smsMessageUtils.js'
import { computeScheduledNextRunAt } from './smsScheduledNextRun.js'
import { normalizeSmsPhone } from './smsPhone.js'

function rowScheduleInput(row) {
  return {
    scheduleType: String(row.schedule_type),
    sendDate: row.send_date ? String(row.send_date).slice(0, 10) : null,
    sendTime: String(row.send_time ?? '').slice(0, 5),
    weekdays: Array.isArray(row.weekdays) ? row.weekdays.map((value) => Number(value)) : [],
    monthDay: row.month_day != null ? Number(row.month_day) : null,
    enabled: String(row.status) === 'active',
  }
}

async function recoverStaleProcessing(executor) {
  await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_messages
    SET status = 'active', updated_at = NOW()
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '10 minutes'
      AND deleted_at IS NULL
    `,
  )
}

async function lockNextDueMessage(executor, batchSize = 50) {
  const r = await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_messages
    SET status = 'processing', updated_at = NOW()
    WHERE id IN (
      SELECT id
      FROM sms_scheduled_messages
      WHERE deleted_at IS NULL
        AND status = 'active'
        AND next_run_at IS NOT NULL
        AND next_run_at <= NOW()
      ORDER BY next_run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    )
    RETURNING *
    `,
    [batchSize],
  )
  return r.rows
}

export async function lockScheduledMessageById(executor, scope, id) {
  const r = await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_messages
    SET status = 'processing', updated_at = NOW()
    WHERE id = $1
      AND tenant_id = $2
      AND user_id = $3
      AND deleted_at IS NULL
      AND status IN ('active', 'paused')
    RETURNING *
    `,
    [id, scope.tenantId, scope.userId],
  )
  return r.rowCount > 0 ? r.rows[0] : null
}

async function releaseScheduledMessageAfterQueue(executor, row, {
  scheduledRunAt,
  campaignId = null,
  errorCode = null,
  errorMessage = null,
  failed = false,
  manualRun = false,
}) {
  const scheduleType = String(row.schedule_type)
  const runCount = Number(row.run_count ?? 0) + 1
  let nextStatus = failed ? 'failed' : 'active'
  let nextRunAt = null

  const preservePlannedRunAt =
    manualRun &&
    scheduleType !== 'once' &&
    row.next_run_at &&
    new Date(row.next_run_at).getTime() > Date.now()

  if (preservePlannedRunAt) {
    nextRunAt = new Date(row.next_run_at).toISOString()
  } else if (!failed && scheduleType !== 'once') {
    nextRunAt = computeScheduledNextRunAt({
      ...rowScheduleInput(row),
      enabled: true,
    })
    if (!nextRunAt) {
      nextStatus = 'completed'
    }
  } else if (!failed && scheduleType === 'once') {
    nextRunAt = null
  }

  await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_messages
    SET status = $2,
        next_run_at = $3,
        last_run_at = $4,
        run_count = $5,
        last_campaign_id = $6,
        last_error_code = $7,
        last_error_message = $8,
        updated_at = NOW()
    WHERE id = $1
    `,
    [row.id, nextStatus, nextRunAt, scheduledRunAt, runCount, campaignId, errorCode, errorMessage],
  )
}

async function insertSendJob(executor, job) {
  await systemQuery(
    executor,
    `
    INSERT INTO sms_send_jobs (
      id, tenant_id, user_id, source_type, source_id, run_id, campaign_id, customer_id,
      phone, sender_number, message_body, message_type, is_advertising, status, scheduled_for
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (source_type, source_id, run_id, phone) DO NOTHING
    `,
    [
      job.id,
      job.tenantId,
      job.userId,
      job.sourceType,
      job.sourceId,
      job.runId,
      job.campaignId,
      job.customerId,
      job.phone,
      job.senderNumber,
      job.messageBody,
      job.messageType,
      job.isAdvertising,
      job.status,
      job.scheduledFor,
    ],
  )
}

/**
 * due 예약 1건을 outbox(run + send_jobs)로 큐잉한다. gateway/provider 호출 없음.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Record<string, unknown>} row
 * @param {{ manualRun?: boolean }} [options]
 */
export async function queueOneScheduledMessage(executor, row, options = {}) {
  const manualRun = options.manualRun === true
  const ruleId = Number(row.id)
  const scheduledRunAt = row.next_run_at
    ? new Date(row.next_run_at).toISOString()
    : new Date().toISOString()
  const scope = { tenantId: Number(row.tenant_id), userId: String(row.user_id) }

  console.info('[sms-scheduled] queue started', { ruleId, scheduledRunAt, manualRun })

  if (!isSmsModuleEnabled()) {
    await releaseScheduledMessageAfterQueue(executor, row, {
      scheduledRunAt,
      failed: true,
      errorCode: 'module_disabled',
      errorMessage: '문자 모듈이 비활성화되어 예약 발송을 실행할 수 없습니다.',
      manualRun,
    })
    return { queued: false, runId: null, jobCount: 0 }
  }

  const settings = await getSmsSettings(executor, scope)
  const senderNumber = String(settings.defaultSender ?? '').trim()
  if (!senderNumber) {
    await releaseScheduledMessageAfterQueue(executor, row, {
      scheduledRunAt,
      failed: true,
      errorCode: 'no_sender',
      errorMessage: '기본 발신번호가 설정되어 있지 않아 예약 발송을 실행할 수 없습니다.',
      manualRun,
    })
    return { queued: false, runId: null, jobCount: 0 }
  }

  const groupId = Number(row.recipient_group_id)
  const { customers } = await loadSmsRecipientGroupMembers(executor, scope, groupId)
  const sendable = customers.filter((member) => member.canSend)
  const skippedCount = customers.length - sendable.length

  if (!sendable.length) {
    await releaseScheduledMessageAfterQueue(executor, row, {
      scheduledRunAt,
      failed: true,
      errorCode: 'no_sendable',
      errorMessage: '발송 가능한 수신자가 없어 예약 발송을 실행하지 않았습니다.',
      manualRun,
    })
    return { queued: false, runId: null, jobCount: 0 }
  }

  const runId = randomUUID()
  const runInsert = await systemQuery(
    executor,
    `
    INSERT INTO sms_scheduled_runs (
      id, scheduled_message_id, tenant_id, user_id, scheduled_run_at, status,
      total_count, queued_count, skipped_count, started_at
    )
    VALUES ($1, $2, $3, $4, $5, 'pending', $6, 0, $7, NOW())
    ON CONFLICT (scheduled_message_id, scheduled_run_at) DO NOTHING
    RETURNING id
    `,
    [runId, ruleId, scope.tenantId, scope.userId, scheduledRunAt, customers.length, skippedCount],
  )

  if (runInsert.rowCount === 0) {
    await systemQuery(
      executor,
      `
      UPDATE sms_scheduled_messages
      SET status = 'active', updated_at = NOW()
      WHERE id = $1
      `,
      [ruleId],
    )
    console.info('[sms-scheduled] duplicate run skipped', { ruleId, scheduledRunAt })
    return { queued: false, runId: null, jobCount: 0, duplicate: true }
  }

  const messageTemplate = String(row.message_body ?? '')
  const isAdvertising = row.message_type === 'ad'
  const allCustomerIds = customers.map((member) => Number(member.customerId))
  const created = await createSmsCampaign(executor, scope, {
    title: `예약발송 · ${String(row.name ?? '').trim() || '예약문자'}`,
    senderNumber,
    message: messageTemplate,
    messageType: isAdvertising ? 'ad' : 'info',
    customerIds: allCustomerIds,
  })

  let queuedJobCount = 0
  for (const member of sendable) {
    const phone = normalizeSmsPhone(member.phone)
    if (!phone) {
      continue
    }
    const renderedMessage = renderSmsTemplate(messageTemplate, {
      customerName: member.name,
    })
    await insertSendJob(executor, {
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.userId,
      sourceType: 'scheduled',
      sourceId: String(ruleId),
      runId,
      campaignId: created.campaignId,
      customerId: Number(member.customerId),
      phone,
      senderNumber,
      messageBody: renderedMessage,
      messageType: 'SMS',
      isAdvertising,
      status: 'queued',
      scheduledFor: scheduledRunAt,
    })
    queuedJobCount += 1
  }

  await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_runs
    SET campaign_id = $2,
        status = 'queued',
        queued_count = $3,
        updated_at = NOW()
    WHERE id = $1
    `,
    [runId, created.campaignId, queuedJobCount],
  )

  await touchSmsRecipientGroupLastSent(executor, scope, groupId)
  await releaseScheduledMessageAfterQueue(executor, row, {
    scheduledRunAt,
    campaignId: created.campaignId,
    manualRun,
  })

  console.info('[sms-scheduled] queue finished', {
    ruleId,
    runId,
    campaignId: created.campaignId,
    queuedJobCount,
    skippedCount,
  })

  return { queued: true, runId, campaignId: created.campaignId, jobCount: queuedJobCount, skippedCount }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ batchSize?: number }} [options]
 */
export async function queueDueScheduledMessages(executor, options = {}) {
  const batchSize = Number(options.batchSize ?? process.env.SMS_SCHEDULER_BATCH_SIZE ?? 50)
  const safeBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? Math.min(batchSize, 200) : 50

  await recoverStaleProcessing(executor)
  const lockedRows = await lockNextDueMessage(executor, safeBatchSize)
  let processed = 0
  let runsCreated = 0
  let jobsCreated = 0

  for (const row of lockedRows) {
    const result = await queueOneScheduledMessage(executor, row)
    processed += 1
    if (result.queued) {
      runsCreated += 1
      jobsCreated += result.jobCount ?? 0
    }
  }

  return { processed, runsCreated, jobsCreated }
}

/** @deprecated use queueDueScheduledMessages */
export async function runDueScheduledMessages(executor, options = {}) {
  return queueDueScheduledMessages(executor, options)
}

export { recoverStaleProcessing }
