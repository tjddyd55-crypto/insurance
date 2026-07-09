import { systemQuery } from '../utils/dbSafeQuery.js'

const TRIGGER_TYPES = new Set(['BIRTHDAY', 'CAR_INSURANCE_EXPIRY', 'INSURANCE_AGE', 'CUSTOMER_SPECIAL_DATE'])
const SPECIAL_DATE_PURPOSE_TYPES = new Set(['ALL', 'CELEBRATION', 'THANKS', 'NOTICE', 'CHECKUP'])
const SEND_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function mapRowToApi(row) {
  return {
    id: Number(row.id),
    ruleName: String(row.rule_name ?? ''),
    triggerType: String(row.trigger_type),
    specialDatePurposeType:
      row.special_date_purpose_type != null && String(row.special_date_purpose_type).trim() !== ''
        ? String(row.special_date_purpose_type)
        : null,
    dayOffset: Number(row.day_offset ?? 0),
    sendTime: String(row.send_time ?? '10:00').slice(0, 5),
    messageBody: String(row.message_body ?? ''),
    isActive: row.is_active !== false,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function normalizeTriggerType(raw) {
  const value = String(raw ?? '').trim().toUpperCase()
  if (!TRIGGER_TYPES.has(value)) {
    const err = new Error('sms_automation_trigger_invalid')
    err.status = 400
    err.publicMessage = '유효한 자동문자 유형이 아닙니다.'
    throw err
  }
  return value
}

function normalizeSpecialDatePurposeType(triggerType, raw) {
  if (triggerType !== 'CUSTOMER_SPECIAL_DATE') {
    return null
  }
  const value = String(raw ?? 'ALL').trim().toUpperCase() || 'ALL'
  if (!SPECIAL_DATE_PURPOSE_TYPES.has(value)) {
    const err = new Error('sms_automation_special_date_purpose_invalid')
    err.status = 400
    err.publicMessage = '유효한 기념일 타입 필터가 아닙니다.'
    throw err
  }
  return value
}

function normalizeDayOffset(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 366) {
    const err = new Error('sms_automation_day_offset_invalid')
    err.status = 400
    err.publicMessage = '발송 시점(며칠 전)은 0~366 사이 정수여야 합니다.'
    throw err
  }
  return n
}

function normalizeSendTime(raw) {
  const value = String(raw ?? '10:00').trim().slice(0, 5)
  if (!SEND_TIME_RE.test(value)) {
    const err = new Error('sms_automation_send_time_invalid')
    err.status = 400
    err.publicMessage = '발송 시간은 HH:mm 형식이어야 합니다.'
    throw err
  }
  return value
}

function normalizeRuleInput(input, { partial = false } = {}) {
  const patch = {}
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'ruleName') || Object.prototype.hasOwnProperty.call(input, 'rule_name')) {
    const ruleName = String(input.ruleName ?? input.rule_name ?? '').trim()
    if (!ruleName) {
      const err = new Error('sms_automation_rule_name_required')
      err.status = 400
      err.publicMessage = '규칙명을 입력해 주세요.'
      throw err
    }
    patch.ruleName = ruleName
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'triggerType') || Object.prototype.hasOwnProperty.call(input, 'trigger_type')) {
    patch.triggerType = normalizeTriggerType(input.triggerType ?? input.trigger_type)
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'specialDatePurposeType') || Object.prototype.hasOwnProperty.call(input, 'special_date_purpose_type')) {
    const triggerType = patch.triggerType ?? normalizeTriggerType(input.triggerType ?? input.trigger_type)
    patch.specialDatePurposeType = normalizeSpecialDatePurposeType(
      triggerType,
      input.specialDatePurposeType ?? input.special_date_purpose_type,
    )
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'dayOffset') || Object.prototype.hasOwnProperty.call(input, 'day_offset')) {
    patch.dayOffset = normalizeDayOffset(input.dayOffset ?? input.day_offset ?? 0)
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'sendTime') || Object.prototype.hasOwnProperty.call(input, 'send_time')) {
    patch.sendTime = normalizeSendTime(input.sendTime ?? input.send_time)
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'messageBody') || Object.prototype.hasOwnProperty.call(input, 'message_body')) {
    const messageBody = String(input.messageBody ?? input.message_body ?? '').trim()
    if (!messageBody) {
      const err = new Error('sms_automation_message_required')
      err.status = 400
      err.publicMessage = '문자 내용을 입력해 주세요.'
      throw err
    }
    patch.messageBody = messageBody
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'isActive') || Object.prototype.hasOwnProperty.call(input, 'is_active')) {
    patch.isActive = input.isActive !== false && input.is_active !== false
  }
  return patch
}

async function loadRuleById(executor, scope, ruleId) {
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_automation_rules
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
  `,
    [ruleId, scope.tenantId, scope.userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; gaId?: number | null }} scope
 */
export async function listAutomationRules(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_automation_rules
    WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
    ORDER BY updated_at DESC, id DESC
    `,
    [scope.tenantId, scope.userId],
  )
  return r.rows.map(mapRowToApi)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; gaId?: number | null }} scope
 * @param {Record<string, unknown>} input
 */
export async function createAutomationRule(executor, scope, input) {
  const patch = normalizeRuleInput(input, { partial: false })
  const gaId = scope.gaId != null && Number.isInteger(scope.gaId) && scope.gaId > 0 ? scope.gaId : null

  const ins = await systemQuery(
    executor,
    `
    INSERT INTO sms_automation_rules (
      tenant_id, user_id, ga_id,
      rule_name, trigger_type, special_date_purpose_type,
      day_offset, send_time, message_body, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
    `,
    [
      scope.tenantId,
      scope.userId,
      gaId,
      patch.ruleName,
      patch.triggerType,
      patch.specialDatePurposeType,
      patch.dayOffset,
      patch.sendTime,
      patch.messageBody,
      patch.isActive,
    ],
  )
  return mapRowToApi(ins.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; gaId?: number | null }} scope
 * @param {number} ruleId
 * @param {Record<string, unknown>} input
 */
export async function updateAutomationRule(executor, scope, ruleId, input) {
  const existing = await loadRuleById(executor, scope, ruleId)
  if (!existing) {
    const err = new Error('sms_automation_rule_not_found')
    err.status = 404
    err.publicMessage = '자동문자 규칙을 찾을 수 없습니다.'
    throw err
  }

  const patch = normalizeRuleInput(
    {
      ruleName: input.ruleName ?? input.rule_name ?? existing.rule_name,
      triggerType: input.triggerType ?? input.trigger_type ?? existing.trigger_type,
      specialDatePurposeType:
        input.specialDatePurposeType ??
        input.special_date_purpose_type ??
        existing.special_date_purpose_type,
      dayOffset: input.dayOffset ?? input.day_offset ?? existing.day_offset,
      sendTime: input.sendTime ?? input.send_time ?? existing.send_time,
      messageBody: input.messageBody ?? input.message_body ?? existing.message_body,
      isActive:
        Object.prototype.hasOwnProperty.call(input, 'isActive') || Object.prototype.hasOwnProperty.call(input, 'is_active')
          ? input.isActive ?? input.is_active
          : existing.is_active,
    },
    { partial: false },
  )

  const upd = await systemQuery(
    executor,
    `
    UPDATE sms_automation_rules
    SET rule_name = $1,
        trigger_type = $2,
        special_date_purpose_type = $3,
        day_offset = $4,
        send_time = $5,
        message_body = $6,
        is_active = $7,
        updated_at = NOW()
    WHERE id = $8 AND tenant_id = $9 AND user_id = $10 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      patch.ruleName,
      patch.triggerType,
      patch.specialDatePurposeType,
      patch.dayOffset,
      patch.sendTime,
      patch.messageBody,
      patch.isActive,
      ruleId,
      scope.tenantId,
      scope.userId,
    ],
  )
  if (upd.rowCount === 0) {
    const err = new Error('sms_automation_rule_not_found')
    err.status = 404
    err.publicMessage = '자동문자 규칙을 찾을 수 없습니다.'
    throw err
  }
  return mapRowToApi(upd.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {number} ruleId
 */
export async function deleteAutomationRule(executor, scope, ruleId) {
  const existing = await loadRuleById(executor, scope, ruleId)
  if (!existing) {
    const err = new Error('sms_automation_rule_not_found')
    err.status = 404
    err.publicMessage = '자동문자 규칙을 찾을 수 없습니다.'
    throw err
  }
  await systemQuery(
    executor,
    `
    UPDATE sms_automation_rules
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
    `,
    [ruleId, scope.tenantId, scope.userId],
  )
  return { id: ruleId, deleted: true }
}

/**
 * 대상자 미리보기는 smsAutomationPreviewService.js 에서 구현한다.
 */

export { normalizeTriggerType, normalizeDayOffset, normalizeSendTime, normalizeSpecialDatePurposeType, mapRowToApi }
