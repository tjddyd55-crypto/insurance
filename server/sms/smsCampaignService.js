import { systemQuery } from '../utils/dbSafeQuery.js'
import { assertSmsRealSendAllowed } from './smsModuleConfig.js'
import { renderSmsTemplate, resolveMessageType } from './smsMessageUtils.js'
import { isValidKoreanMobilePhone, normalizeSenderNumber, normalizeSmsPhone } from './smsPhone.js'
import { resolveSmsProvider } from './smsProviderFactory.js'
import { assertOwnedSenderNumber, assertCustomerOwnedByScope, loadOptOutPhoneSet } from './smsScope.js'
import { loadDecryptedAligoCredentials } from './smsSettingsService.js'

/**
 * @typedef {Object} CampaignTargetInput
 * @property {number[]} [customerIds]
 * @property {{ search?: string; tag?: string }} [filter]
 */

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {CampaignTargetInput} input
 */
async function loadCampaignTargetCustomers(executor, scope, input) {
  if (Array.isArray(input.customerIds) && input.customerIds.length > 0) {
    const r = await systemQuery(
      executor,
      `
      SELECT c.id, c.name, c.phone
      FROM customers c
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
      WHERE c.user_id = $1
        AND t.id = $2
        AND c.id = ANY($3::int[])
      `,
      [scope.userId, scope.tenantId, input.customerIds],
    )
    return r.rows
  }
  const search = String(input.filter?.search ?? '').trim()
  const values = [scope.userId, scope.tenantId]
  let searchSql = ''
  if (search) {
    values.push(`%${search}%`)
    searchSql = ` AND (c.name ILIKE $3 OR c.phone ILIKE $3)`
  }
  const r = await systemQuery(
    executor,
    `
    SELECT c.id, c.name, c.phone
    FROM customers c
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1 AND t.id = $2
    ${searchSql}
    ORDER BY c.id ASC
    LIMIT 5000
    `,
    values,
  )
  return r.rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{
 *   senderNumber: string;
 *   message: string;
 *   messageType?: 'info' | 'ad';
 *   customerIds?: number[];
 *   filter?: { search?: string };
 *   title?: string;
 * }} input
 */
export async function previewSmsCampaign(executor, scope, input) {
  const senderNumber = normalizeSenderNumber(input.senderNumber)
  const messageTemplate = String(input.message ?? '').trim()
  if (!senderNumber) {
    const err = new Error('sms_sender_invalid')
    err.status = 400
    err.publicMessage = '발신번호를 선택해 주세요.'
    throw err
  }
  if (!messageTemplate) {
    const err = new Error('sms_message_empty')
    err.status = 400
    err.publicMessage = '메시지를 입력해 주세요.'
    throw err
  }
  await assertOwnedSenderNumber(executor, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    senderNumber,
    requireVerified: true,
  })

  const customers = await loadCampaignTargetCustomers(executor, scope, input)
  const skipCounts = {
    no_phone: 0,
    invalid_phone: 0,
    duplicate_phone: 0,
    opt_out: 0,
  }
  /** @type {Array<{ customerId: number; customerName: string; phone: string; sampleMessage: string }>} */
  const sendable = []
  const seenPhones = new Set()
  const allPhones = customers.map((row) => normalizeSmsPhone(row.phone)).filter(Boolean)
  const optOutSet = await loadOptOutPhoneSet(executor, { tenantId: scope.tenantId, phones: allPhones })

  for (const row of customers) {
    const phone = normalizeSmsPhone(row.phone)
    if (!phone) {
      skipCounts.no_phone += 1
      continue
    }
    if (!isValidKoreanMobilePhone(phone)) {
      skipCounts.invalid_phone += 1
      continue
    }
    if (seenPhones.has(phone)) {
      skipCounts.duplicate_phone += 1
      continue
    }
    seenPhones.add(phone)
    if (optOutSet.has(phone)) {
      skipCounts.opt_out += 1
      continue
    }
    const customerName = String(row.name ?? '').trim()
    sendable.push({
      customerId: Number(row.id),
      customerName,
      phone,
      sampleMessage: renderSmsTemplate(messageTemplate, { customerName }),
    })
  }

  return {
    senderNumber,
    messageTypeDetected: resolveMessageType(messageTemplate),
    sendableCount: sendable.length,
    skippedCount: Object.values(skipCounts).reduce((a, b) => a + b, 0),
    skipReasonCounts: skipCounts,
    samples: sendable.slice(0, 5),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{
 *   title?: string;
 *   senderNumber: string;
 *   message: string;
 *   messageType?: 'info' | 'ad';
 *   customerIds?: number[];
 *   filter?: { search?: string };
 *   scheduledAt?: string | null;
 * }} input
 */
export async function createSmsCampaign(executor, scope, input) {
  const preview = await previewSmsCampaign(executor, scope, input)
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    const err = new Error('sms_schedule_invalid')
    err.status = 400
    err.publicMessage = '예약 시간 형식이 올바르지 않습니다.'
    throw err
  }
  if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
    const err = new Error('sms_schedule_past')
    err.status = 400
    err.publicMessage = '예약 시간은 현재보다 이후여야 합니다.'
    throw err
  }

  const customers = await loadCampaignTargetCustomers(executor, scope, input)
  const messageTemplate = String(input.message ?? '').trim()
  const messageType = input.messageType === 'ad' ? 'ad' : 'info'
  const title = String(input.title ?? '').trim() || '단체문자'
  const status = scheduledAt ? 'scheduled' : 'draft'

  const campaignIns = await systemQuery(
    executor,
    `
    INSERT INTO sms_campaigns (
      tenant_id, user_id, title, message, message_type, sender_number,
      target_count, success_count, fail_count, skipped_count, status, scheduled_at, preview_validated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, $9, $10, NOW())
    RETURNING id
    `,
    [
      scope.tenantId,
      scope.userId,
      title,
      messageTemplate,
      messageType,
      preview.senderNumber,
      preview.sendableCount,
      preview.skippedCount,
      status,
      scheduledAt,
    ],
  )
  const campaignId = Number(campaignIns.rows[0].id)

  const seenPhones = new Set()
  const optOutSet = await loadOptOutPhoneSet(executor, {
    tenantId: scope.tenantId,
    phones: customers.map((c) => normalizeSmsPhone(c.phone)).filter(Boolean),
  })

  for (const row of customers) {
    const phone = normalizeSmsPhone(row.phone)
    let skipReason = null
    if (!phone) {
      skipReason = 'no_phone'
    } else if (!isValidKoreanMobilePhone(phone)) {
      skipReason = 'invalid_phone'
    } else if (seenPhones.has(phone)) {
      skipReason = 'duplicate_phone'
    } else if (optOutSet.has(phone)) {
      skipReason = 'opt_out'
    }
    if (skipReason) {
      await systemQuery(
        executor,
        `
        INSERT INTO sms_recipients (
          tenant_id, campaign_id, customer_id, phone, customer_name, message, status, skip_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7)
        `,
        [
          scope.tenantId,
          campaignId,
          Number(row.id),
          phone || '',
          String(row.name ?? ''),
          renderSmsTemplate(messageTemplate, { customerName: String(row.name ?? '') }),
          skipReason,
        ],
      )
      continue
    }
    seenPhones.add(phone)
    await systemQuery(
      executor,
      `
      INSERT INTO sms_recipients (
        tenant_id, campaign_id, customer_id, phone, customer_name, message, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `,
      [
        scope.tenantId,
        campaignId,
        Number(row.id),
        phone,
        String(row.name ?? ''),
        renderSmsTemplate(messageTemplate, { customerName: String(row.name ?? '') }),
      ],
    )
  }

  return { campaignId, status, scheduledAt, preview }
}

export async function getSmsCampaign(executor, scope, campaignId) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, title, message, message_type, sender_number, target_count, success_count,
           fail_count, skipped_count, status, scheduled_at, sent_at, created_at, updated_at
    FROM sms_campaigns
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    LIMIT 1
    `,
    [campaignId, scope.tenantId, scope.userId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_campaign_not_found')
    err.status = 404
    throw err
  }
  const row = r.rows[0]
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    messageType: String(row.message_type),
    senderNumber: String(row.sender_number),
    targetCount: Number(row.target_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    failCount: Number(row.fail_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    status: String(row.status),
    scheduledAt: row.scheduled_at ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listSmsCampaigns(executor, scope, { limit = 50, offset = 0 } = {}) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, title, message, message_type, sender_number, target_count, success_count,
           fail_count, skipped_count, status, scheduled_at, sent_at, created_at, updated_at
    FROM sms_campaigns
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
    `,
    [scope.tenantId, scope.userId, Math.min(limit, 200), Math.max(offset, 0)],
  )
  return r.rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    messageType: String(row.message_type),
    senderNumber: String(row.sender_number),
    targetCount: Number(row.target_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    failCount: Number(row.fail_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    status: String(row.status),
    scheduledAt: row.scheduled_at ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function cancelSmsCampaign(executor, scope, campaignId) {
  const r = await systemQuery(
    executor,
    `
    UPDATE sms_campaigns
    SET status = 'canceled', updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status IN ('draft', 'scheduled')
    RETURNING id, status
    `,
    [campaignId, scope.tenantId, scope.userId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_campaign_cancel_not_allowed')
    err.status = 400
    err.publicMessage = '취소할 수 없는 캠페인입니다.'
    throw err
  }
  return { id: Number(r.rows[0].id), status: String(r.rows[0].status) }
}

export async function sendSmsCampaignNow(executor, scope, campaignId, input = {}) {
  assertSmsRealSendAllowed()

  if (input.previewConfirmed !== true) {
    const err = new Error('sms_campaign_preview_required')
    err.status = 400
    err.publicMessage = '단체문자 발송 전 미리보기 확인이 필요합니다.'
    throw err
  }

  const campaign = await getSmsCampaign(executor, scope, campaignId)
  if (campaign.status === 'canceled') {
    const err = new Error('sms_campaign_canceled')
    err.status = 400
    err.publicMessage = '취소된 캠페인은 발송할 수 없습니다.'
    throw err
  }
  if (campaign.status === 'scheduled') {
    const err = new Error('sms_campaign_scheduled')
    err.status = 400
    err.publicMessage =
      '예약 캠페인은 자동 발송 worker 준비 전입니다. 저장된 예약 캠페인은 발송 전 취소할 수 있습니다.'
    throw err
  }
  if (['sending', 'completed'].includes(campaign.status)) {
    const err = new Error('sms_campaign_already_sent')
    err.status = 400
    err.publicMessage = '이미 발송 중이거나 완료된 캠페인입니다.'
    throw err
  }

  const lock = await systemQuery(
    executor,
    `
    UPDATE sms_campaigns
    SET status = 'sending', updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status = 'draft'
    RETURNING id, preview_validated_at
    `,
    [campaignId, scope.tenantId, scope.userId],
  )
  if (lock.rowCount === 0) {
    const err = new Error('sms_campaign_send_locked')
    err.status = 409
    err.publicMessage = '캠페인을 발송할 수 없습니다. 이미 처리 중이거나 미리보기 검증이 없습니다.'
    throw err
  }
  if (!lock.rows[0]?.preview_validated_at) {
    const err = new Error('sms_campaign_preview_missing')
    err.status = 400
    err.publicMessage = '미리보기 검증 없이 생성된 캠페인은 발송할 수 없습니다.'
    throw err
  }

  await assertOwnedSenderNumber(executor, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    senderNumber: campaign.senderNumber,
    requireVerified: true,
  })
  const creds = await loadDecryptedAligoCredentials(executor, scope)
  const provider = resolveSmsProvider()

  const pending = await systemQuery(
    executor,
    `
    SELECT id, phone, message, customer_id
    FROM sms_recipients
    WHERE campaign_id = $1 AND tenant_id = $2 AND status = 'pending'
    ORDER BY id ASC
    `,
    [campaignId, scope.tenantId],
  )

  const optOutSet = await loadOptOutPhoneSet(executor, {
    tenantId: scope.tenantId,
    phones: pending.rows.map((row) => normalizeSmsPhone(row.phone)).filter(Boolean),
  })

  let successCount = 0
  let failCount = 0
  let skippedDuringSend = 0

  for (const row of pending.rows) {
    const phone = normalizeSmsPhone(row.phone)
    if (!phone || !isValidKoreanMobilePhone(phone)) {
      skippedDuringSend += 1
      await systemQuery(
        executor,
        `UPDATE sms_recipients SET status = 'skipped', skip_reason = 'invalid_phone' WHERE id = $1 AND status = 'pending'`,
        [row.id],
      )
      continue
    }
    if (optOutSet.has(phone)) {
      skippedDuringSend += 1
      await systemQuery(
        executor,
        `UPDATE sms_recipients SET status = 'skipped', skip_reason = 'opt_out' WHERE id = $1 AND status = 'pending'`,
        [row.id],
      )
      continue
    }
    if (row.customer_id != null) {
      try {
        await assertCustomerOwnedByScope(executor, {
          tenantId: scope.tenantId,
          userId: scope.userId,
          customerId: Number(row.customer_id),
        })
      } catch {
        skippedDuringSend += 1
        await systemQuery(
          executor,
          `UPDATE sms_recipients SET status = 'skipped', skip_reason = 'customer_scope' WHERE id = $1 AND status = 'pending'`,
          [row.id],
        )
        continue
      }
    }

    const sendResult = await provider.send({
      to: phone,
      from: campaign.senderNumber,
      message: String(row.message),
      messageType: resolveMessageType(String(row.message)),
      providerUserId: creds.providerUserId,
      apiKey: creds.apiKey,
      requestId: `campaign:${campaignId}:recipient:${row.id}`,
    })
    if (sendResult.success) {
      successCount += 1
      await systemQuery(
        executor,
        `
        UPDATE sms_recipients
        SET status = 'success', provider_message_id = $2, sent_at = NOW()
        WHERE id = $1 AND status = 'pending'
        `,
        [row.id, sendResult.providerMessageId ?? null],
      )
    } else {
      failCount += 1
      await systemQuery(
        executor,
        `
        UPDATE sms_recipients
        SET status = 'failed', fail_reason = $2
        WHERE id = $1 AND status = 'pending'
        `,
        [row.id, sendResult.errorMessage ?? '발송 실패'],
      )
    }
  }

  const finalStatus = failCount > 0 && successCount === 0 ? 'failed' : 'completed'
  await systemQuery(
    executor,
    `
    UPDATE sms_campaigns
    SET success_count = $2,
        fail_count = $3,
        skipped_count = skipped_count + $4,
        status = $5,
        sent_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    `,
    [campaignId, successCount, failCount, skippedDuringSend, finalStatus],
  )

  return getSmsCampaign(executor, scope, campaignId)
}
