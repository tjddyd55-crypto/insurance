import { systemQuery } from '../utils/dbSafeQuery.js'
import { resolveMessageType } from '../sms/smsMessageUtils.js'
import { isValidKoreanMobilePhone, normalizeSenderNumber, normalizeSmsPhone } from '../sms/smsPhone.js'
import { resolveSmsProvider } from '../sms/smsProviderFactory.js'
import {
  getCrmUserBulkSmsDevAllowlist,
  getCrmUserBulkSmsDefaultSender,
  getCrmUserBulkSmsMaxRecipients,
  getCrmUserBulkSmsRuntimeInfo,
  isCrmUserBulkSmsEnabled,
  isCrmUserBulkSmsRealSendEnabled,
} from './crmUserBulkSmsConfig.js'
import { ensureCrmUserBulkSmsSchema } from './crmUserBulkSmsSchema.js'

const SERVICE_NAME = 'ONE FC'

export const CRM_USER_BULK_SMS_AUDIENCE = 'CRM_USER'
export const CRM_USER_BULK_SMS_SOURCE = 'SUPER_ADMIN_BULK_NOTICE'

/**
 * @param {string | null | undefined} phone
 */
export function maskCrmUserPhone(phone) {
  const digits = normalizeSmsPhone(phone)
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`
  }
  if (!digits) return '연락처 없음'
  return '****'
}

/**
 * @param {string} template
 * @param {{ displayName?: string | null; username?: string | null; gaName?: string | null }} vars
 */
export function renderCrmUserNoticeTemplate(template, vars) {
  const map = {
    사용자명: String(vars.displayName ?? '').trim() || String(vars.username ?? '').trim() || '회원',
    아이디: String(vars.username ?? '').trim(),
    소속명: String(vars.gaName ?? '').trim(),
    서비스명: SERVICE_NAME,
  }
  const missing = []
  for (const token of ['사용자명', '아이디', '소속명', '서비스명']) {
    if (String(template).includes(`{${token}}`) && !String(map[token] ?? '').trim() && token !== '사용자명') {
      if (token === '아이디' || token === '소속명') missing.push(token)
    }
  }
  let body = String(template ?? '')
  for (const [key, value] of Object.entries(map)) {
    body = body.replaceAll(`{${key}}`, value)
  }
  if (/\{[^}]+\}/.test(body)) {
    missing.push('UNKNOWN_TOKEN')
  }
  return { messageBody: body, missingVariables: missing }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string[]} userIds
 */
export async function loadCrmUsersForBulkSms(executor, userIds) {
  const ids = [...new Set(userIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (ids.length === 0) return []

  const r = await systemQuery(
    executor,
    `
    SELECT
      u.id,
      u.display_name,
      u.username,
      u.role,
      u.status,
      u.is_deleted,
      u.phone_number,
      u.ga_id,
      g.name AS ga_company_name
    FROM users u
    INNER JOIN ga_companies g ON g.id = u.ga_id AND g.is_deleted = false
    WHERE u.id = ANY($1::text[])
    `,
    [ids],
  )
  return r.rows
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} messageTemplate
 */
export function resolveCrmUserBulkSmsRecipients(rows, messageTemplate) {
  /** @type {Array<Record<string, unknown>>} */
  const resolved = []
  const seenPhones = new Map()

  for (const row of rows) {
    const userId = String(row.id ?? '')
    const isDeleted = row.is_deleted === true
    const status = String(row.status ?? '').toLowerCase()
    const phoneRaw = row.phone_number
    const phone = normalizeSmsPhone(phoneRaw)
    const displayName = String(row.display_name ?? '').trim()
    const username = String(row.username ?? '').trim()
    const gaName = String(row.ga_company_name ?? '').trim()

    const base = {
      userId,
      gaId: row.ga_id != null ? Number(row.ga_id) : null,
      displayName,
      username,
      gaCompanyName: gaName,
      role: String(row.role ?? ''),
      phoneNormalized: phone || null,
      phoneMasked: maskCrmUserPhone(phone),
    }

    if (isDeleted) {
      resolved.push({ ...base, status: 'EXCLUDED', exclusionReason: 'DELETED_USER', renderedMessage: null })
      continue
    }
    if (!phone) {
      resolved.push({ ...base, status: 'EXCLUDED', exclusionReason: 'NO_PHONE', renderedMessage: null })
      continue
    }
    if (!isValidKoreanMobilePhone(phone)) {
      resolved.push({ ...base, status: 'EXCLUDED', exclusionReason: 'INVALID_PHONE', renderedMessage: null })
      continue
    }

    const rendered = renderCrmUserNoticeTemplate(messageTemplate, {
      displayName,
      username,
      gaName,
    })
    if (rendered.missingVariables.length > 0) {
      resolved.push({
        ...base,
        status: 'EXCLUDED',
        exclusionReason: 'VARIABLE_FAILED',
        renderedMessage: null,
      })
      continue
    }

    if (seenPhones.has(phone)) {
      resolved.push({
        ...base,
        status: 'EXCLUDED',
        exclusionReason: 'DUPLICATE_PHONE',
        renderedMessage: rendered.messageBody,
        duplicateOfUserId: seenPhones.get(phone),
      })
      continue
    }

    seenPhones.set(phone, userId)
    resolved.push({
      ...base,
      status: 'PENDING',
      exclusionReason: null,
      renderedMessage: rendered.messageBody,
    })
  }

  const eligible = resolved.filter((r) => r.status === 'PENDING')
  const excluded = resolved.filter((r) => r.status === 'EXCLUDED')
  const sampleMessage = String(eligible[0]?.renderedMessage ?? messageTemplate)
  const smsType = resolveMessageType(sampleMessage)

  return {
    recipients: resolved,
    summary: {
      targetCount: resolved.length,
      eligibleCount: eligible.length,
      excludedCount: excluded.length,
      uniquePhoneCount: eligible.length,
      smsType,
      exclusionBreakdown: excluded.reduce((acc, r) => {
        const key = String(r.exclusionReason ?? 'UNKNOWN')
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, /** @type {Record<string, number>} */ ({})),
    },
  }
}

function assertFeatureEnabled() {
  if (!isCrmUserBulkSmsEnabled()) {
    const err = new Error('crm_user_bulk_sms_disabled')
    err.status = 403
    err.publicMessage = '사용자 단체문자 기능이 비활성화되어 있습니다.'
    throw err
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   actorUserId: string;
 *   userIds: string[];
 *   message: string;
 *   title?: string;
 *   senderNumber?: string;
 * }} input
 */
export async function previewCrmUserBulkSms(pool, input) {
  assertFeatureEnabled()
  await ensureCrmUserBulkSmsSchema(pool)

  const message = String(input.message ?? '').trim()
  if (!message) {
    const err = new Error('message_required')
    err.status = 400
    err.publicMessage = '문자 내용을 입력해 주세요.'
    throw err
  }

  const max = getCrmUserBulkSmsMaxRecipients()
  const userIds = [...new Set((input.userIds ?? []).map((id) => String(id).trim()).filter(Boolean))]
  if (userIds.length === 0) {
    const err = new Error('users_required')
    err.status = 400
    err.publicMessage = '발송 대상 사용자를 선택해 주세요.'
    throw err
  }
  if (userIds.length > max) {
    const err = new Error('too_many_recipients')
    err.status = 400
    err.publicMessage = `한 번에 최대 ${max}명까지 선택할 수 있습니다.`
    throw err
  }

  const rows = await loadCrmUsersForBulkSms(pool, userIds)
  const foundIds = new Set(rows.map((r) => String(r.id)))
  const missingIds = userIds.filter((id) => !foundIds.has(id))
  const { recipients, summary } = resolveCrmUserBulkSmsRecipients(rows, message)

  for (const missingId of missingIds) {
    recipients.push({
      userId: missingId,
      gaId: null,
      displayName: '',
      username: '',
      gaCompanyName: '',
      role: '',
      phoneNormalized: null,
      phoneMasked: '—',
      status: 'EXCLUDED',
      exclusionReason: 'UNAUTHORIZED_SCOPE',
      renderedMessage: null,
    })
    summary.excludedCount += 1
    summary.targetCount += 1
    summary.exclusionBreakdown.UNAUTHORIZED_SCOPE =
      (summary.exclusionBreakdown.UNAUTHORIZED_SCOPE ?? 0) + 1
  }

  const sender =
    normalizeSenderNumber(input.senderNumber) ||
    normalizeSenderNumber(getCrmUserBulkSmsDefaultSender())

  return {
    runtime: getCrmUserBulkSmsRuntimeInfo(),
    title: String(input.title ?? '').trim() || '사용자 안내',
    message,
    senderNumber: sender,
    audienceType: CRM_USER_BULK_SMS_AUDIENCE,
    sourceType: CRM_USER_BULK_SMS_SOURCE,
    messagePurpose: 'service_notice',
    summary,
    recipients: recipients.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      username: r.username,
      gaCompanyName: r.gaCompanyName,
      role: r.role,
      phoneMasked: r.phoneMasked,
      status: r.status,
      exclusionReason: r.exclusionReason,
    })),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   actorUserId: string;
 *   userIds: string[];
 *   message: string;
 *   title?: string;
 *   senderNumber?: string;
 *   idempotencyKey?: string;
 *   confirm: boolean;
 * }} input
 */
export async function sendCrmUserBulkSms(pool, input) {
  assertFeatureEnabled()
  await ensureCrmUserBulkSmsSchema(pool)

  if (!input.confirm) {
    const err = new Error('confirm_required')
    err.status = 400
    err.publicMessage = '발송 확인이 필요합니다.'
    throw err
  }

  const idempotencyKey = String(input.idempotencyKey ?? '').trim() || null
  if (idempotencyKey) {
    const existing = await systemQuery(
      pool,
      `SELECT id, status, dry_run, success_count, failed_count, excluded_count, eligible_count, target_count
       FROM crm_user_bulk_sms_campaigns WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    )
    if (existing.rows[0]) {
      return { campaign: mapCampaignRow(existing.rows[0]), reused: true }
    }
  }

  const preview = await previewCrmUserBulkSms(pool, input)
  if (preview.summary.eligibleCount < 1) {
    const err = new Error('no_eligible_recipients')
    err.status = 400
    err.publicMessage = '발송 가능한 사용자가 없습니다.'
    throw err
  }

  const senderNumber = preview.senderNumber
  if (!senderNumber) {
    const err = new Error('sender_required')
    err.status = 400
    err.publicMessage = '발신번호를 설정해 주세요.'
    throw err
  }

  const realSend = isCrmUserBulkSmsRealSendEnabled()
  const allowlist = getCrmUserBulkSmsDevAllowlist()
  const production = getCrmUserBulkSmsRuntimeInfo().productionRuntime
  const dryRun = !realSend

  const client = await pool.connect()
  let campaignId
  try {
    await client.query('BEGIN')
    const ins = await systemQuery(
      client,
      `
      INSERT INTO crm_user_bulk_sms_campaigns (
        title, message_template, sender_number, sms_type,
        audience_type, source_type, message_purpose,
        requested_by, idempotency_key,
        target_count, eligible_count, excluded_count,
        dry_run, status, started_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,'service_notice',
        $7,$8,
        $9,$10,$11,
        $12,'PROCESSING', NOW()
      )
      RETURNING id
      `,
      [
        preview.title,
        preview.message,
        senderNumber,
        preview.summary.smsType,
        CRM_USER_BULK_SMS_AUDIENCE,
        CRM_USER_BULK_SMS_SOURCE,
        input.actorUserId,
        idempotencyKey,
        preview.summary.targetCount,
        preview.summary.eligibleCount,
        preview.summary.excludedCount,
        dryRun,
      ],
    )
    campaignId = Number(ins.rows[0].id)

    const full = await loadCrmUsersForBulkSms(client, input.userIds)
    const { recipients } = resolveCrmUserBulkSmsRecipients(full, preview.message)

    for (const r of recipients) {
      await systemQuery(
        client,
        `
        INSERT INTO crm_user_bulk_sms_recipients (
          campaign_id, user_id, ga_id, display_name, username, ga_company_name, role,
          phone_normalized, phone_masked, rendered_message, status, exclusion_reason
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `,
        [
          campaignId,
          r.userId,
          r.gaId,
          r.displayName,
          r.username,
          r.gaCompanyName,
          r.role,
          r.phoneNormalized,
          r.phoneMasked,
          r.renderedMessage,
          r.status === 'EXCLUDED' ? 'EXCLUDED' : 'PENDING',
          r.exclusionReason,
        ],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    if (e && typeof e === 'object' && e.code === '23505' && idempotencyKey) {
      const existing = await systemQuery(
        pool,
        `SELECT id, status, dry_run, success_count, failed_count, excluded_count, eligible_count, target_count
         FROM crm_user_bulk_sms_campaigns WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey],
      )
      if (existing.rows[0]) {
        return { campaign: mapCampaignRow(existing.rows[0]), reused: true }
      }
    }
    throw e
  } finally {
    client.release()
  }

  const pending = await systemQuery(
    pool,
    `SELECT id, phone_normalized, rendered_message
     FROM crm_user_bulk_sms_recipients
     WHERE campaign_id = $1 AND status = 'PENDING'
     ORDER BY id ASC`,
    [campaignId],
  )

  let successCount = 0
  let failedCount = 0
  let provider = null
  if (!dryRun) {
    try {
      provider = resolveSmsProvider()
    } catch (e) {
      await systemQuery(
        pool,
        `UPDATE crm_user_bulk_sms_campaigns
         SET status = 'FAILED', failed_count = $2, completed_at = NOW()
         WHERE id = $1`,
        [campaignId, pending.rows.length],
      )
      const err = new Error('provider_unavailable')
      err.status = 503
      err.publicMessage = e?.publicMessage || e?.message || 'SMS provider를 사용할 수 없습니다.'
      throw err
    }
  }

  for (const row of pending.rows) {
    const phone = String(row.phone_normalized ?? '')
    const message = String(row.rendered_message ?? '')

    if (!dryRun && !production && allowlist.size > 0 && !allowlist.has(phone)) {
      await systemQuery(
        pool,
        `UPDATE crm_user_bulk_sms_recipients
         SET status = 'EXCLUDED', exclusion_reason = 'UNAUTHORIZED_SCOPE', sent_at = NOW()
         WHERE id = $1`,
        [row.id],
      )
      continue
    }

    if (!dryRun && !production && allowlist.size === 0) {
      // development 실발송 플래그가 켜져도 allowlist 없으면 dry-run 강제
      await systemQuery(
        pool,
        `UPDATE crm_user_bulk_sms_recipients
         SET status = 'DRY_RUN', sent_at = NOW()
         WHERE id = $1`,
        [row.id],
      )
      successCount += 1
      continue
    }

    if (dryRun) {
      await systemQuery(
        pool,
        `UPDATE crm_user_bulk_sms_recipients
         SET status = 'DRY_RUN', provider_message_id = $2, sent_at = NOW()
         WHERE id = $1`,
        [row.id, `dry-run-${campaignId}-${row.id}`],
      )
      successCount += 1
      continue
    }

    try {
      const sendResult = await provider.send({
        to: phone,
        from: senderNumber,
        message,
        title: preview.title,
        messageType: preview.summary.smsType,
        providerUserId: '',
        apiKey: '',
        requestId: `crm-user-bulk:${campaignId}:${row.id}`,
      })
      if (sendResult.success) {
        await systemQuery(
          pool,
          `UPDATE crm_user_bulk_sms_recipients
           SET status = 'SENT', provider_message_id = $2, sent_at = NOW()
           WHERE id = $1`,
          [row.id, sendResult.providerMessageId ?? null],
        )
        successCount += 1
      } else {
        await systemQuery(
          pool,
          `UPDATE crm_user_bulk_sms_recipients
           SET status = 'FAILED', error_code = $2, sent_at = NOW()
           WHERE id = $1`,
          [row.id, String(sendResult.errorMessage ?? 'send_failed').slice(0, 200)],
        )
        failedCount += 1
      }
    } catch (e) {
      await systemQuery(
        pool,
        `UPDATE crm_user_bulk_sms_recipients
         SET status = 'FAILED', error_code = $2, sent_at = NOW()
         WHERE id = $1`,
        [row.id, String(e?.message ?? 'send_exception').slice(0, 200)],
      )
      failedCount += 1
    }
  }

  const excludedRecount = await systemQuery(
    pool,
    `SELECT COUNT(*)::int AS c FROM crm_user_bulk_sms_recipients
     WHERE campaign_id = $1 AND status = 'EXCLUDED'`,
    [campaignId],
  )
  const excludedCount = Number(excludedRecount.rows[0]?.c ?? 0)
  let status = 'COMPLETED'
  if (failedCount > 0 && successCount > 0) status = 'PARTIAL_FAILED'
  if (failedCount > 0 && successCount === 0) status = 'FAILED'

  await systemQuery(
    pool,
    `UPDATE crm_user_bulk_sms_campaigns
     SET success_count = $2, failed_count = $3, excluded_count = $4, status = $5, completed_at = NOW()
     WHERE id = $1`,
    [campaignId, successCount, failedCount, excludedCount, status],
  )

  const campaign = await systemQuery(
    pool,
    `SELECT id, title, status, dry_run, sms_type, target_count, eligible_count,
            success_count, failed_count, excluded_count, created_at, started_at, completed_at,
            requested_by, sender_number, message_template
     FROM crm_user_bulk_sms_campaigns WHERE id = $1`,
    [campaignId],
  )

  return { campaign: mapCampaignRow(campaign.rows[0]), reused: false, dryRun }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ limit?: number }} [opts]
 */
export async function listCrmUserBulkSmsCampaigns(pool, opts = {}) {
  assertFeatureEnabled()
  await ensureCrmUserBulkSmsSchema(pool)
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100)
  const r = await systemQuery(
    pool,
    `
    SELECT c.id, c.title, c.status, c.dry_run, c.sms_type,
           c.target_count, c.eligible_count, c.success_count, c.failed_count, c.excluded_count,
           c.created_at, c.started_at, c.completed_at, c.requested_by, c.sender_number,
           u.username AS requested_by_username, u.display_name AS requested_by_display_name
    FROM crm_user_bulk_sms_campaigns c
    LEFT JOIN users u ON u.id = c.requested_by
    ORDER BY c.created_at DESC
    LIMIT $1
    `,
    [limit],
  )
  return r.rows.map((row) => ({
    ...mapCampaignRow(row),
    requestedByUsername: row.requested_by_username ?? null,
    requestedByDisplayName: row.requested_by_display_name ?? null,
  }))
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} campaignId
 */
export async function getCrmUserBulkSmsCampaignDetail(pool, campaignId) {
  assertFeatureEnabled()
  await ensureCrmUserBulkSmsSchema(pool)
  const id = Number(campaignId)
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('invalid_campaign')
    err.status = 400
    err.publicMessage = '잘못된 발송 이력 ID입니다.'
    throw err
  }
  const c = await systemQuery(
    pool,
    `SELECT c.id, c.title, c.status, c.dry_run, c.sms_type, c.message_template, c.sender_number,
            c.target_count, c.eligible_count, c.success_count, c.failed_count, c.excluded_count,
            c.created_at, c.started_at, c.completed_at, c.requested_by,
            u.username AS requested_by_username, u.display_name AS requested_by_display_name
     FROM crm_user_bulk_sms_campaigns c
     LEFT JOIN users u ON u.id = c.requested_by
     WHERE c.id = $1`,
    [id],
  )
  if (!c.rows[0]) {
    const err = new Error('campaign_not_found')
    err.status = 404
    err.publicMessage = '발송 이력을 찾을 수 없습니다.'
    throw err
  }
  const recipients = await systemQuery(
    pool,
    `SELECT user_id, display_name, username, ga_company_name, role,
            phone_masked, status, exclusion_reason, error_code, sent_at
     FROM crm_user_bulk_sms_recipients
     WHERE campaign_id = $1
     ORDER BY id ASC
     LIMIT 2000`,
    [id],
  )
  return {
    campaign: {
      ...mapCampaignRow(c.rows[0]),
      messageTemplate: c.rows[0].message_template,
      requestedByUsername: c.rows[0].requested_by_username ?? null,
      requestedByDisplayName: c.rows[0].requested_by_display_name ?? null,
    },
    recipients: recipients.rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      gaCompanyName: r.ga_company_name,
      role: r.role,
      phoneMasked: r.phone_masked,
      status: r.status,
      exclusionReason: r.exclusion_reason,
      errorCode: r.error_code,
      sentAt: r.sent_at,
    })),
  }
}

function mapCampaignRow(row) {
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    dryRun: Boolean(row.dry_run),
    smsType: row.sms_type,
    targetCount: Number(row.target_count ?? 0),
    eligibleCount: Number(row.eligible_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    excludedCount: Number(row.excluded_count ?? 0),
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    requestedBy: row.requested_by ?? null,
    senderNumber: row.sender_number ?? null,
  }
}
