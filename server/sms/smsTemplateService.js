import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizeSmsPhone } from './smsPhone.js'

export async function listSmsTemplates(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, title, message, message_type, created_at, updated_at
    FROM sms_templates
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY updated_at DESC
    `,
    [scope.tenantId, scope.userId],
  )
  return r.rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    messageType: String(row.message_type),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function createSmsTemplate(executor, scope, input) {
  const title = String(input.title ?? '').trim()
  const message = String(input.message ?? '').trim()
  const messageType = input.messageType === 'ad' ? 'ad' : 'info'
  if (!title || !message) {
    const err = new Error('sms_template_invalid')
    err.status = 400
    err.publicMessage = '제목과 메시지를 입력해 주세요.'
    throw err
  }
  const r = await systemQuery(
    executor,
    `
    INSERT INTO sms_templates (tenant_id, user_id, title, message, message_type)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, message, message_type, created_at, updated_at
    `,
    [scope.tenantId, scope.userId, title, message, messageType],
  )
  const row = r.rows[0]
  return {
    id: Number(row.id),
    title: String(row.title),
    message: String(row.message),
    messageType: String(row.message_type),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function updateSmsTemplate(executor, scope, templateId, input) {
  const existing = await systemQuery(
    executor,
    `
    SELECT id FROM sms_templates
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    LIMIT 1
    `,
    [templateId, scope.tenantId, scope.userId],
  )
  if (existing.rowCount === 0) {
    const err = new Error('sms_template_not_found')
    err.status = 404
    throw err
  }
  await systemQuery(
    executor,
    `
    UPDATE sms_templates
    SET title = COALESCE($4, title),
        message = COALESCE($5, message),
        message_type = COALESCE($6, message_type),
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    `,
    [
      templateId,
      scope.tenantId,
      scope.userId,
      input.title != null ? String(input.title).trim() : null,
      input.message != null ? String(input.message).trim() : null,
      input.messageType != null ? (input.messageType === 'ad' ? 'ad' : 'info') : null,
    ],
  )
  const r = await systemQuery(
    executor,
    `SELECT id, title, message, message_type, created_at, updated_at FROM sms_templates WHERE id = $1`,
    [templateId],
  )
  const row = r.rows[0]
  return {
    id: Number(row.id),
    title: String(row.title),
    message: String(row.message),
    messageType: String(row.message_type),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function deleteSmsTemplate(executor, scope, templateId) {
  const r = await systemQuery(
    executor,
    `
    DELETE FROM sms_templates
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    RETURNING id
    `,
    [templateId, scope.tenantId, scope.userId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_template_not_found')
    err.status = 404
    throw err
  }
  return { deleted: true }
}

export async function listSmsOptOuts(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, phone, reason, created_at
    FROM sms_opt_outs
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 500
    `,
    [scope.tenantId],
  )
  return r.rows.map((row) => ({
    id: Number(row.id),
    phoneMasked: maskPhone(String(row.phone)),
    reason: row.reason != null ? String(row.reason) : null,
    createdAt: row.created_at,
  }))
}

export async function addSmsOptOut(executor, scope, input) {
  const phone = normalizeSmsPhone(input.phone)
  if (!phone) {
    const err = new Error('sms_opt_out_phone_invalid')
    err.status = 400
    err.publicMessage = '전화번호를 입력해 주세요.'
    throw err
  }
  await systemQuery(
    executor,
    `
    INSERT INTO sms_opt_outs (tenant_id, phone, reason)
    VALUES ($1, $2, $3)
    ON CONFLICT (tenant_id, phone) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, sms_opt_outs.reason)
    `,
    [scope.tenantId, phone, input.reason != null ? String(input.reason).trim() : null],
  )
  return { phoneMasked: maskPhone(phone) }
}

export async function removeSmsOptOut(executor, scope, optOutId) {
  const r = await systemQuery(
    executor,
    `
    DELETE FROM sms_opt_outs
    WHERE id = $1 AND tenant_id = $2
    RETURNING id
    `,
    [optOutId, scope.tenantId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_opt_out_not_found')
    err.status = 404
    throw err
  }
  return { deleted: true }
}

function maskPhone(phone) {
  const d = normalizeSmsPhone(phone)
  if (d.length < 8) {
    return '***'
  }
  return `${d.slice(0, 3)}****${d.slice(-4)}`
}
