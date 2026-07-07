import { systemQuery } from '../utils/dbSafeQuery.js'
import { assertSmsRealSendAllowed } from './smsModuleConfig.js'
import { composeAdvertisementSmsMessage, renderSmsTemplate, resolveMessageType } from './smsMessageUtils.js'
import { isValidKoreanMobilePhone, normalizeSenderNumber, normalizeSmsPhone } from './smsPhone.js'
import { resolveSmsProvider } from './smsProviderFactory.js'
import { assertCustomerOwnedByScope, assertOwnedSenderNumber, loadOptOutPhoneSet } from './smsScope.js'
import { loadDecryptedAligoCredentials } from './smsSettingsService.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{
 *   senderNumber: string;
 *   receiver: string;
 *   message: string;
 *   customerId?: number | null;
 *   messageType?: 'info' | 'ad';
 *   title?: string;
 * }} input
 */
export async function sendSingleSms(executor, scope, input) {
  assertSmsRealSendAllowed()
  const senderNumber = normalizeSenderNumber(input.senderNumber)
  const receiver = normalizeSmsPhone(input.receiver)
  const message = String(input.message ?? '').trim()
  const messageType = input.messageType === 'ad' ? 'ad' : 'info'

  if (!senderNumber) {
    const err = new Error('sms_sender_invalid')
    err.status = 400
    err.publicMessage = '발신번호가 올바르지 않습니다.'
    throw err
  }
  if (!message) {
    const err = new Error('sms_message_empty')
    err.status = 400
    err.publicMessage = '메시지를 입력해 주세요.'
    throw err
  }
  if (!isValidKoreanMobilePhone(receiver)) {
    const err = new Error('sms_receiver_invalid')
    err.status = 400
    err.publicMessage = '수신번호가 올바르지 않습니다.'
    throw err
  }

  await assertOwnedSenderNumber(executor, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    senderNumber,
    requireVerified: true,
  })

  const optOuts = await loadOptOutPhoneSet(executor, { tenantId: scope.tenantId, phones: [receiver] })
  if (optOuts.has(receiver)) {
    const err = new Error('sms_receiver_opt_out')
    err.status = 400
    err.publicMessage = '수신거부 번호입니다.'
    throw err
  }

  if (input.customerId != null) {
    await assertCustomerOwnedByScope(executor, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      customerId: Number(input.customerId),
    })
  }

  const creds = await loadDecryptedAligoCredentials(executor, scope)
  const provider = resolveSmsProvider()
  let messageToSend = message
  if (messageType === 'ad') {
    const composed = composeAdvertisementSmsMessage({
      body: message,
      adDisplayName: creds.adDisplayName,
    })
    if (!composed.ok) {
      const err = new Error(composed.code)
      err.status = 400
      err.publicMessage = composed.publicMessage
      throw err
    }
    messageToSend = composed.message
  }
  const aligoMsgType = resolveMessageType(messageToSend)

  const campaignIns = await systemQuery(
    executor,
    `
    INSERT INTO sms_campaigns (
      tenant_id, user_id, title, message, message_type, sender_number,
      target_count, success_count, fail_count, skipped_count, status, sent_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 1, 0, 0, 0, 'sending', NOW())
    RETURNING id
    `,
    [scope.tenantId, scope.userId, '단건 발송', message, messageType, senderNumber],
  )
  const campaignId = Number(campaignIns.rows[0].id)

  const sendResult = await provider.send({
    to: receiver,
    from: senderNumber,
    message: messageToSend,
    title: input.title,
    messageType: aligoMsgType,
    providerUserId: creds.providerUserId,
    apiKey: creds.apiKey,
    requestId: `single:${campaignId}`,
  })

  const recipientStatus = sendResult.success ? 'success' : 'failed'
  await systemQuery(
    executor,
    `
    INSERT INTO sms_recipients (
      tenant_id, campaign_id, customer_id, phone, customer_name, message,
      status, provider_message_id, fail_reason, sent_at
    )
    VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, CASE WHEN $6 = 'success' THEN NOW() ELSE NULL END)
    `,
    [
      scope.tenantId,
      campaignId,
      input.customerId ?? null,
      receiver,
      messageToSend,
      recipientStatus,
      sendResult.providerMessageId ?? null,
      sendResult.success ? null : sendResult.errorMessage ?? '발송 실패',
    ],
  )

  await systemQuery(
    executor,
    `
    UPDATE sms_campaigns
    SET success_count = CASE WHEN $2 THEN 1 ELSE 0 END,
        fail_count = CASE WHEN $2 THEN 0 ELSE 1 END,
        status = $3,
        sent_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    `,
    [campaignId, sendResult.success, sendResult.success ? 'completed' : 'failed'],
  )

  return {
    success: sendResult.success,
    campaignId,
    providerMessageId: sendResult.providerMessageId ?? null,
    errorMessage: sendResult.errorMessage ?? null,
    messageTypeDetected: aligoMsgType,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; campaignId?: number; limit?: number; offset?: number }} params
 */
export async function listSmsCampaignHistory(executor, params) {
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 1), 200)
  const offset = Math.max(Number(params.offset ?? 0), 0)
  const values = [params.tenantId, params.userId, limit, offset]
  let campaignFilter = ''
  if (params.campaignId != null) {
    campaignFilter = ' AND c.id = $5'
    values.push(params.campaignId)
  }
  const r = await systemQuery(
    executor,
    `
    SELECT c.id, c.title, c.message, c.message_type, c.sender_number, c.target_count,
           c.success_count, c.fail_count, c.skipped_count, c.status, c.scheduled_at,
           c.sent_at, c.created_at, c.updated_at
    FROM sms_campaigns c
    WHERE c.tenant_id = $1 AND c.user_id = $2
    ${campaignFilter}
    ORDER BY c.created_at DESC
    LIMIT $3 OFFSET $4
    `,
    values,
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

export async function listSmsCampaignRecipients(executor, scope, campaignId) {
  const owner = await systemQuery(
    executor,
    `
    SELECT id FROM sms_campaigns
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    LIMIT 1
    `,
    [campaignId, scope.tenantId, scope.userId],
  )
  if (owner.rowCount === 0) {
    const err = new Error('sms_campaign_not_found')
    err.status = 404
    throw err
  }
  const r = await systemQuery(
    executor,
    `
    SELECT id, customer_id, phone, customer_name, message, status, skip_reason,
           provider_message_id, fail_reason, sent_at, created_at
    FROM sms_recipients
    WHERE campaign_id = $1 AND tenant_id = $2
    ORDER BY id ASC
    `,
    [campaignId, scope.tenantId],
  )
  return r.rows.map((row) => ({
    id: Number(row.id),
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    phoneMasked: maskPhoneForList(String(row.phone)),
    customerName: row.customer_name != null ? String(row.customer_name) : null,
    message: String(row.message ?? ''),
    status: String(row.status),
    skipReason: row.skip_reason != null ? String(row.skip_reason) : null,
    providerMessageId: row.provider_message_id != null ? String(row.provider_message_id) : null,
    failReason: row.fail_reason != null ? String(row.fail_reason) : null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at,
  }))
}

function maskPhoneForList(phone) {
  const d = normalizeSmsPhone(phone)
  if (d.length < 8) {
    return '***'
  }
  return `${d.slice(0, 3)}****${d.slice(-4)}`
}

export { renderSmsTemplate }
