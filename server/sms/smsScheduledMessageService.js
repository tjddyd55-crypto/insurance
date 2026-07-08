import { systemQuery } from '../utils/dbSafeQuery.js'
import { loadSmsRecipientGroupMembers } from './smsRecipientGroupService.js'
import { computeScheduledNextRunAt, assertScheduledNextRunInFuture } from './smsScheduledNextRun.js'
import {
  lockScheduledMessageById,
  queueDueScheduledMessages,
  queueOneScheduledMessage,
  recoverStaleProcessing,
} from './smsScheduledQueueService.js'
import { runSmsSendWorkerOnce } from './smsSendWorkerService.js'

function mapRowToApi(row) {
  const weekdays = Array.isArray(row.weekdays) ? row.weekdays.map((value) => Number(value)) : []
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    recipientGroupId: Number(row.recipient_group_id),
    messageBody: String(row.message_body ?? ''),
    messageType: row.message_type === 'ad' ? 'ad' : 'info',
    scheduleType: String(row.schedule_type),
    sendDate: row.send_date ? String(row.send_date).slice(0, 10) : null,
    sendTime: String(row.send_time ?? '').slice(0, 5),
    timezone: String(row.timezone ?? 'Asia/Seoul'),
    weekdays,
    monthDay: row.month_day != null ? Number(row.month_day) : null,
    templateId: row.template_id != null ? Number(row.template_id) : null,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : null,
    status: String(row.status),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
    runCount: Number(row.run_count ?? 0),
    lastCampaignId: row.last_campaign_id != null ? Number(row.last_campaign_id) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    lastErrorMessage: row.last_error_message ? String(row.last_error_message) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function normalizeMessageType(input) {
  if (input?.isAdvertising === true || input?.messageType === 'ad') {
    return 'ad'
  }
  return 'info'
}

function normalizeScheduleType(raw) {
  const value = String(raw ?? 'once').trim()
  if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'once') {
    return value
  }
  const err = new Error('sms_schedule_type_invalid')
  err.status = 400
  err.publicMessage = '예약 주기 형식이 올바르지 않습니다.'
  throw err
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 */
export async function listScheduledMessages(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_scheduled_messages
    WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
    ORDER BY updated_at DESC, id DESC
    `,
    [scope.tenantId, scope.userId],
  )
  return r.rows.map(mapRowToApi)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {Record<string, unknown>} input
 */
export async function createScheduledMessage(executor, scope, input) {
  const name = String(input.name ?? '').trim()
  if (!name) {
    const err = new Error('sms_scheduled_name_required')
    err.status = 400
    err.publicMessage = '예약명을 입력해 주세요.'
    throw err
  }
  const messageBody = String(input.messageBody ?? input.message ?? '').trim()
  if (!messageBody) {
    const err = new Error('sms_message_empty')
    err.status = 400
    err.publicMessage = '메시지를 입력해 주세요.'
    throw err
  }
  const groupId = Number(input.recipientGroupId)
  if (!Number.isInteger(groupId) || groupId <= 0) {
    const err = new Error('sms_recipient_group_required')
    err.status = 400
    err.publicMessage = '발송 그룹을 선택해 주세요.'
    throw err
  }

  await loadSmsRecipientGroupMembers(executor, scope, groupId)

  const scheduleType = normalizeScheduleType(input.scheduleType)
  const sendTime = String(input.sendTime ?? '09:00').trim()
  const sendDate = scheduleType === 'once' ? String(input.sendDate ?? '').trim() : null
  const weekdays =
    scheduleType === 'weekly' && Array.isArray(input.weekdays)
      ? [...new Set(input.weekdays.map((value) => Number(value)).filter((value) => value >= 1 && value <= 7))].sort(
          (a, b) => a - b,
        )
      : []
  const monthDay = scheduleType === 'monthly' ? Number(input.monthDay ?? 1) : null
  const enabled = input.enabled !== false
  const timezone = String(input.timezone ?? 'Asia/Seoul').trim() || 'Asia/Seoul'

  const nextRunAt = computeScheduledNextRunAt({
    scheduleType,
    sendDate,
    sendTime,
    weekdays,
    monthDay,
    enabled,
  })

  if (scheduleType === 'once') {
    assertScheduledNextRunInFuture(nextRunAt)
  } else if (!nextRunAt) {
    const err = new Error('sms_schedule_invalid')
    err.status = 400
    err.publicMessage = '예약 주기 설정을 확인해 주세요.'
    throw err
  }

  const messageType = normalizeMessageType(input)
  const description = String(input.description ?? '').trim()
  const templateIdRaw = input.templateId != null ? Number(input.templateId) : null
  const templateId = Number.isInteger(templateIdRaw) && templateIdRaw > 0 ? templateIdRaw : null
  const status = enabled ? 'active' : 'paused'

  const ins = await systemQuery(
    executor,
    `
    INSERT INTO sms_scheduled_messages (
      tenant_id, user_id, name, description, recipient_group_id, message_body, message_type,
      schedule_type, send_date, send_time, timezone, weekdays, month_day, template_id,
      next_run_at, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *
    `,
    [
      scope.tenantId,
      scope.userId,
      name,
      description,
      groupId,
      messageBody,
      messageType,
      scheduleType,
      sendDate,
      sendTime,
      timezone,
      weekdays,
      monthDay,
      templateId,
      nextRunAt,
      status,
    ],
  )
  const row = ins.rows[0]
  console.info('[sms-scheduled] rule saved', {
    ruleId: Number(row.id),
    gaId: scope.tenantId,
    groupId,
    nextRunAt,
  })
  return mapRowToApi(row)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {number} id
 */
export async function deleteScheduledMessage(executor, scope, id) {
  const r = await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_messages
    SET status = 'deleted', deleted_at = NOW(), updated_at = NOW(), next_run_at = NULL
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
    RETURNING id
    `,
    [id, scope.tenantId, scope.userId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_scheduled_not_found')
    err.status = 404
    err.publicMessage = '예약문자를 찾을 수 없습니다.'
    throw err
  }
  return { ok: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {number} id
 * @param {Record<string, unknown>} input
 */
export async function updateScheduledMessage(executor, scope, id, input) {
  const existing = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_scheduled_messages
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [id, scope.tenantId, scope.userId],
  )
  if (existing.rowCount === 0) {
    const err = new Error('sms_scheduled_not_found')
    err.status = 404
    err.publicMessage = '예약문자를 찾을 수 없습니다.'
    throw err
  }
  const row = existing.rows[0]
  if (String(row.status) === 'processing') {
    const err = new Error('sms_scheduled_processing')
    err.status = 409
    err.publicMessage = '예약 발송 실행 중에는 수정할 수 없습니다.'
    throw err
  }

  const name = input.name != null ? String(input.name).trim() : String(row.name ?? '')
  if (!name) {
    const err = new Error('sms_scheduled_name_required')
    err.status = 400
    err.publicMessage = '예약명을 입력해 주세요.'
    throw err
  }

  const messageBody =
    input.messageBody != null ? String(input.messageBody).trim() : String(row.message_body ?? '').trim()
  if (!messageBody) {
    const err = new Error('sms_message_empty')
    err.status = 400
    err.publicMessage = '메시지를 입력해 주세요.'
    throw err
  }

  const scheduleType = input.scheduleType != null ? normalizeScheduleType(input.scheduleType) : String(row.schedule_type)
  const sendTime = input.sendTime != null ? String(input.sendTime).trim() : String(row.send_time ?? '09:00').trim()
  const sendDate =
    scheduleType === 'once'
      ? String(input.sendDate ?? row.send_date ?? '').trim()
      : null
  const weekdays =
    scheduleType === 'weekly' && Array.isArray(input.weekdays)
      ? [...new Set(input.weekdays.map((value) => Number(value)).filter((value) => value >= 1 && value <= 7))].sort(
          (a, b) => a - b,
        )
      : scheduleType === 'weekly'
        ? Array.isArray(row.weekdays)
          ? row.weekdays.map((value) => Number(value))
          : []
        : []
  const monthDay =
    scheduleType === 'monthly'
      ? Number(input.monthDay ?? row.month_day ?? 1)
      : null
  const enabled = input.enabled !== undefined ? input.enabled !== false : String(row.status) !== 'paused'
  const timezone =
    input.timezone != null ? String(input.timezone).trim() || 'Asia/Seoul' : String(row.timezone ?? 'Asia/Seoul')

  const nextRunAt = computeScheduledNextRunAt({
    scheduleType,
    sendDate,
    sendTime,
    weekdays,
    monthDay,
    enabled,
  })

  if (scheduleType === 'once') {
    assertScheduledNextRunInFuture(nextRunAt)
  } else if (enabled && !nextRunAt) {
    const err = new Error('sms_schedule_invalid')
    err.status = 400
    err.publicMessage = '예약 주기 설정을 확인해 주세요.'
    throw err
  }

  const messageType =
    input.messageType != null || input.isAdvertising != null
      ? normalizeMessageType(input)
      : row.message_type === 'ad'
        ? 'ad'
        : 'info'
  const description = input.description != null ? String(input.description).trim() : String(row.description ?? '')
  const templateIdRaw = input.templateId != null ? Number(input.templateId) : row.template_id
  const templateId = Number.isInteger(templateIdRaw) && templateIdRaw > 0 ? templateIdRaw : null
  const status = enabled ? 'active' : 'paused'

  const upd = await systemQuery(
    executor,
    `
    UPDATE sms_scheduled_messages
    SET name = $4,
        description = $5,
        message_body = $6,
        message_type = $7,
        schedule_type = $8,
        send_date = $9,
        send_time = $10,
        timezone = $11,
        weekdays = $12,
        month_day = $13,
        template_id = $14,
        next_run_at = $15,
        status = $16,
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      id,
      scope.tenantId,
      scope.userId,
      name,
      description,
      messageBody,
      messageType,
      scheduleType,
      sendDate,
      sendTime,
      timezone,
      weekdays,
      monthDay,
      templateId,
      enabled ? nextRunAt : null,
      status,
    ],
  )
  return mapRowToApi(upd.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {number} id
 */
export async function runScheduledMessageNow(executor, scope, id) {
  await recoverStaleProcessing(executor)
  const locked = await lockScheduledMessageById(executor, scope, id)
  if (!locked) {
    const err = new Error('sms_scheduled_not_runnable')
    err.status = 409
    err.publicMessage = '예약을 실행할 수 없습니다. 이미 실행 중이거나 삭제·완료된 예약입니다.'
    throw err
  }

  const queueResult = await queueOneScheduledMessage(executor, locked, { manualRun: true })
  let workerResult = { claimed: 0, sent: 0, failed: 0, skipped: 0, retry: 0 }
  if (queueResult.queued && queueResult.jobCount > 0) {
    workerResult = await runSmsSendWorkerOnce(executor, {
      batchSize: Math.min(queueResult.jobCount, 20),
    })
  }

  const refreshed = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_scheduled_messages
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    LIMIT 1
    `,
    [id, scope.tenantId, scope.userId],
  )

  return {
    ...(refreshed.rowCount > 0 ? mapRowToApi(refreshed.rows[0]) : { ok: true }),
    queue: queueResult,
    worker: workerResult,
  }
}

export { queueDueScheduledMessages, runDueScheduledMessages } from './smsScheduledQueueService.js'
