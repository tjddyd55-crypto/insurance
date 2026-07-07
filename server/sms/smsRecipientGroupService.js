import { systemQuery } from '../utils/dbSafeQuery.js'
import { loadSmsRecipientCustomersByIds } from './smsRecipientSearchService.js'

function mapGroupRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    recipientCount: Number(row.recipient_count ?? 0),
    lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

async function assertOwnedGroup(executor, scope, groupId) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, name, description, recipient_count, last_sent_at, created_at, updated_at
    FROM sms_recipient_groups
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND archived_at IS NULL
    LIMIT 1
    `,
    [groupId, scope.tenantId, scope.userId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_recipient_group_not_found')
    err.status = 404
    err.publicMessage = '그룹을 찾을 수 없습니다.'
    throw err
  }
  return r.rows[0]
}

async function replaceGroupMembers(executor, groupId, customerIds) {
  await systemQuery(executor, `DELETE FROM sms_recipient_group_members WHERE group_id = $1`, [groupId])
  const uniqueIds = [...new Set(customerIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
  for (const customerId of uniqueIds) {
    await systemQuery(
      executor,
      `
      INSERT INTO sms_recipient_group_members (group_id, customer_id)
      VALUES ($1, $2)
      ON CONFLICT (group_id, customer_id) DO NOTHING
      `,
      [groupId, customerId],
    )
  }
  await systemQuery(
    executor,
    `
    UPDATE sms_recipient_groups
    SET recipient_count = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [groupId, uniqueIds.length],
  )
  return uniqueIds.length
}

export async function listSmsRecipientGroups(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, name, description, recipient_count, last_sent_at, created_at, updated_at
    FROM sms_recipient_groups
    WHERE tenant_id = $1 AND user_id = $2 AND archived_at IS NULL
    ORDER BY updated_at DESC, id DESC
    `,
    [scope.tenantId, scope.userId],
  )
  return r.rows.map(mapGroupRow)
}

export async function createSmsRecipientGroup(executor, scope, input) {
  const name = String(input.name ?? '').trim()
  if (!name) {
    const err = new Error('sms_recipient_group_name_required')
    err.status = 400
    err.publicMessage = '그룹명을 입력해 주세요.'
    throw err
  }
  const customerIds = Array.isArray(input.customerIds) ? input.customerIds : []
  const description = String(input.description ?? '').trim()

  const ins = await systemQuery(
    executor,
    `
    INSERT INTO sms_recipient_groups (tenant_id, user_id, name, description, recipient_count)
    VALUES ($1, $2, $3, $4, 0)
    RETURNING id, name, description, recipient_count, last_sent_at, created_at, updated_at
    `,
    [scope.tenantId, scope.userId, name, description],
  )
  const groupId = Number(ins.rows[0].id)
  const count = await replaceGroupMembers(executor, groupId, customerIds)
  return mapGroupRow({ ...ins.rows[0], recipient_count: count })
}

export async function updateSmsRecipientGroup(executor, scope, groupId, input) {
  await assertOwnedGroup(executor, scope, groupId)
  const name = input.name != null ? String(input.name).trim() : null
  const description = input.description != null ? String(input.description).trim() : null
  if (name === '') {
    const err = new Error('sms_recipient_group_name_required')
    err.status = 400
    err.publicMessage = '그룹명을 입력해 주세요.'
    throw err
  }

  if (name != null || description != null) {
    await systemQuery(
      executor,
      `
      UPDATE sms_recipient_groups
      SET
        name = COALESCE($4, name),
        description = COALESCE($5, description),
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND archived_at IS NULL
      `,
      [groupId, scope.tenantId, scope.userId, name, description],
    )
  }

  if (Array.isArray(input.customerIds)) {
    await replaceGroupMembers(executor, groupId, input.customerIds)
  }

  const row = await assertOwnedGroup(executor, scope, groupId)
  return mapGroupRow(row)
}

export async function archiveSmsRecipientGroup(executor, scope, groupId) {
  await assertOwnedGroup(executor, scope, groupId)
  await systemQuery(
    executor,
    `
    UPDATE sms_recipient_groups
    SET archived_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    `,
    [groupId, scope.tenantId, scope.userId],
  )
  return { ok: true }
}

export async function loadSmsRecipientGroupMembers(executor, scope, groupId) {
  await assertOwnedGroup(executor, scope, groupId)
  const r = await systemQuery(
    executor,
    `
    SELECT customer_id
    FROM sms_recipient_group_members
    WHERE group_id = $1
    ORDER BY customer_id ASC
    `,
    [groupId],
  )
  const customerIds = r.rows.map((row) => Number(row.customer_id))
  const customers = await loadSmsRecipientCustomersByIds(executor, scope, customerIds)
  return { customerIds, customers }
}

export async function touchSmsRecipientGroupLastSent(executor, scope, groupId) {
  await systemQuery(
    executor,
    `
    UPDATE sms_recipient_groups
    SET last_sent_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND archived_at IS NULL
    `,
    [groupId, scope.tenantId, scope.userId],
  )
}
