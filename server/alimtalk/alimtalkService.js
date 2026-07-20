import {
  isCustomerAppLinkRealSendApproved,
  isInsuranceAlimtalkCredentialsComplete,
  loadInsuranceAlimtalkConfig,
} from './alimtalkConfig.js'
import { ensureCustomerAppUniversalUrl } from './customerAppLinkForAlimtalk.js'
import { ensureAlimtalkSendLogsTable, insertAlimtalkSendLog } from './alimtalkLogService.js'
import { maskAlimtalkReceiver, normalizeAlimtalkPhone, validateAlimtalkPhone } from './alimtalkPhone.js'
import { sendAligoAlimtalk } from './alimtalkProvider.js'
import {
  getCustomerAppLinkTemplate,
  isPlaceholderTplCode,
  TEMPLATE_KEY_CUSTOMER_APP_LINK,
} from './alimtalkTemplates.js'

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {string} agentId
 * @param {number} customerId
 * @param {import('express').Request['user'] | { id?: string, role?: string, gaId?: unknown }} user
 */
export async function assertCanSendCustomerAppAlimtalk(pool, agentId, customerId, user) {
  const role = String(user?.role ?? '')
  if (role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER') {
    return { ok: false, status: 403, message: '해당 계정은 고객앱 알림톡을 발송할 수 없습니다.' }
  }
  const gaId = Number(user?.gaId)
  if (!Number.isInteger(gaId) || gaId < 1) {
    return { ok: false, status: 400, message: 'GA 컨텍스트를 확인할 수 없습니다.' }
  }
  if (role === 'SUPER_ADMIN' || role === 'GA_ADMIN' || role === 'GA_STAFF') {
    const r = await pool.query(
      `
      SELECT id, name, phone, deleted_at
      FROM customers
      WHERE id = $1
        AND ga_id = $2
      LIMIT 1
      `,
      [customerId, gaId],
    )
    if (r.rowCount === 0) {
      return { ok: false, status: 404, message: '고객을 찾을 수 없습니다.' }
    }
    if (r.rows[0].deleted_at) {
      return { ok: false, status: 404, message: '삭제된 고객에게는 발송할 수 없습니다.' }
    }
    return { ok: true, gaId, customer: r.rows[0] }
  }
  if (String(user?.id ?? '').trim() !== agentId) {
    return { ok: false, status: 403, message: '고객 접근 권한이 없습니다.' }
  }
  const r = await pool.query(
    `
    SELECT id, name, phone, deleted_at
    FROM customers
    WHERE id = $1
      AND user_id = $2
      AND ga_id = $3
    LIMIT 1
    `,
    [customerId, agentId, gaId],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 404, message: '고객을 찾을 수 없습니다.' }
  }
  if (r.rows[0].deleted_at) {
    return { ok: false, status: 404, message: '삭제된 고객에게는 발송할 수 없습니다.' }
  }
  return { ok: true, gaId, customer: r.rows[0] }
}

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {string} userId
 */
async function loadManagerName(pool, userId) {
  const r = await pool.query(
    `
    SELECT display_name, username
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId],
  )
  const display = String(r.rows[0]?.display_name ?? '').trim()
  if (display) return display
  return String(r.rows[0]?.username ?? '').trim() || '담당자'
}

/**
 * 고객앱 링크 알림톡 발송.
 *
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {{
 *   agentId: string,
 *   customerId: number,
 *   user: import('express').Request['user'] | { id?: string, role?: string, gaId?: unknown },
 *   reqLike?: { protocol?: string, host?: string } | null,
 *   receiver?: string | null,
 *   forceDryRun?: boolean,
 *   config?: ReturnType<typeof loadInsuranceAlimtalkConfig>,
 *   templateEnv?: NodeJS.ProcessEnv,
 *   sendFn?: typeof sendAligoAlimtalk,
 *   ensureLinkFn?: typeof ensureCustomerAppUniversalUrl,
 *   skipEnsureLogTable?: boolean,
 * }} params
 */
export async function sendCustomerAppLinkAlimtalk(pool, params) {
  const config = params.config ?? loadInsuranceAlimtalkConfig()
  const template = getCustomerAppLinkTemplate(params.templateEnv ?? process.env)
  const sendFn = params.sendFn ?? sendAligoAlimtalk
  const ensureLinkFn = params.ensureLinkFn ?? ensureCustomerAppUniversalUrl

  if (!params.skipEnsureLogTable) {
    try {
      await ensureAlimtalkSendLogsTable(pool)
    } catch {
      // 테이블 보장 실패해도 발송 흐름은 계속 (로그만 스킵될 수 있음)
    }
  }

  const access = await assertCanSendCustomerAppAlimtalk(pool, params.agentId, params.customerId, params.user)
  if (!access.ok) {
    return {
      success: false,
      httpStatus: access.status,
      error: access.message,
      data: { status: 'failed', templateKey: TEMPLATE_KEY_CUSTOMER_APP_LINK },
    }
  }

  const customerName = String(access.customer.name ?? '').trim() || '고객'
  const bodyReceiver = normalizeAlimtalkPhone(params.receiver)
  const customerPhone = normalizeAlimtalkPhone(access.customer.phone)
  const phoneDigits = bodyReceiver || customerPhone
  const receiverMasked = maskAlimtalkReceiver(phoneDigits)
  const phoneErr = validateAlimtalkPhone(phoneDigits)
  if (phoneErr) {
    await insertAlimtalkSendLog(pool, {
      gaId: access.gaId,
      userId: params.agentId,
      customerId: params.customerId,
      templateKey: template.key,
      tplCode: template.tplCode,
      receiverMasked,
      status: 'failed',
      provider: config.provider,
      providerMessage: phoneErr,
      dryRun: true,
      requestContext: { reason: 'missing_or_invalid_phone' },
    }).catch(() => null)
    return {
      success: false,
      httpStatus: 400,
      error: '고객 휴대폰번호가 없어 발송할 수 없습니다.',
      data: {
        status: 'missing_receiver',
        templateKey: template.key,
        receiverMasked,
        provider: config.provider,
        providerMessage: phoneErr,
      },
    }
  }

  const link = await ensureLinkFn(pool, {
    agentId: params.agentId,
    customerId: params.customerId,
    reqLike: params.reqLike,
  })
  if (!link.ok || !link.customerAppUrl) {
    await insertAlimtalkSendLog(pool, {
      gaId: access.gaId,
      userId: params.agentId,
      customerId: params.customerId,
      templateKey: template.key,
      tplCode: template.tplCode,
      receiverMasked,
      status: 'failed',
      provider: config.provider,
      providerMessage: 'customer app link create failed',
      dryRun: true,
      requestContext: { reason: link.error || 'link_failed' },
    }).catch(() => null)
    return {
      success: false,
      httpStatus: 500,
      error: '고객앱 링크를 생성하지 못했습니다.',
      data: {
        status: 'failed',
        templateKey: template.key,
        receiverMasked,
        provider: config.provider,
        providerMessage: 'customer app link create failed',
      },
    }
  }

  const managerName = await loadManagerName(pool, params.agentId)
  const message = template.buildMessage({ customerName, managerName })
  if (!customerName.trim() || !managerName.trim()) {
    return {
      success: false,
      httpStatus: 400,
      error: '알림톡 템플릿 변수가 부족합니다.',
      data: { status: 'failed', templateKey: template.key, receiverMasked },
    }
  }

  const buttonPayload = template.buildButtonPayload({ customerAppUrl: link.customerAppUrl })
  const forceDryRun = Boolean(params.forceDryRun)
  const effectiveDryRun = Boolean(config.dryRun) || forceDryRun

  // placeholder tpl: dry-run 만 허용. 실발송 시도는 차단.
  if (!effectiveDryRun && isPlaceholderTplCode(template.tplCode)) {
    await insertAlimtalkSendLog(pool, {
      gaId: access.gaId,
      userId: params.agentId,
      customerId: params.customerId,
      templateKey: template.key,
      tplCode: template.tplCode,
      receiverMasked,
      status: 'failed',
      provider: config.provider,
      providerMessage: 'placeholder tpl_code',
      dryRun: false,
      requestContext: { reason: 'placeholder_tpl_blocked' },
    }).catch(() => null)
    return {
      success: false,
      httpStatus: 503,
      error: '승인된 알림톡 템플릿 코드가 없어 실발송할 수 없습니다.',
      data: {
        status: 'failed',
        templateKey: template.key,
        receiverMasked,
        provider: config.provider,
        providerMessage: 'placeholder tpl_code',
      },
    }
  }

  // 검수중(승인 flag false): 실발송 HTTP 호출 금지
  if (!effectiveDryRun && !isCustomerAppLinkRealSendApproved(config)) {
    await insertAlimtalkSendLog(pool, {
      gaId: access.gaId,
      userId: params.agentId,
      customerId: params.customerId,
      templateKey: template.key,
      tplCode: template.tplCode,
      receiverMasked,
      status: 'blocked',
      provider: config.provider,
      providerMessage: 'template not approved for real send',
      dryRun: false,
      requestContext: {
        reason: 'approval_flag_blocked',
        customerAppLinkApproved: config.customerAppLinkApproved,
        allowRealSend: config.allowRealSend,
      },
    }).catch(() => null)
    return {
      success: false,
      httpStatus: 503,
      error: '템플릿 검수 완료 전에는 알림톡을 실발송할 수 없습니다.',
      data: {
        status: 'blocked',
        templateKey: template.key,
        tplCode: template.tplCode,
        receiverMasked,
        provider: config.provider,
        providerMessage: 'template not approved for real send',
      },
    }
  }

  if (!effectiveDryRun && !isInsuranceAlimtalkCredentialsComplete(config)) {
    return {
      success: false,
      httpStatus: 503,
      error: '알림톡 발송 설정이 완료되지 않았습니다.',
      data: {
        status: 'failed',
        templateKey: template.key,
        receiverMasked,
        provider: config.provider,
        providerMessage: 'credentials incomplete',
      },
    }
  }

  const providerResult = await sendFn({
    config,
    dryRun: effectiveDryRun,
    tplCode: template.tplCode,
    templateKey: template.key,
    receiver: phoneDigits,
    subject: template.subject,
    message,
    buttonPayload,
    recvName: customerName,
  })

  const status =
    providerResult.status === 'accepted' || providerResult.status === 'sent'
      ? 'accepted'
      : providerResult.status === 'dry_run'
        ? 'dry_run'
        : 'failed'

  await insertAlimtalkSendLog(pool, {
    gaId: access.gaId,
    userId: params.agentId,
    customerId: params.customerId,
    templateKey: template.key,
    tplCode: template.tplCode,
    receiverMasked,
    status,
    provider: providerResult.provider ?? config.provider,
    providerMessageId: providerResult.providerMessageId ?? null,
    providerCode: providerResult.providerCode ?? null,
    providerMessage: providerResult.providerMessage ?? null,
    dryRun: Boolean(providerResult.dryRun),
    requestContext: {
      templateKey: template.key,
      subject: template.subject,
      hasButton: true,
      customerAppUrlPresent: true,
      apikey: config.apiKey,
      senderkey: config.senderKey,
      receiver_1: phoneDigits,
      linkMo: link.customerAppUrl,
    },
  }).catch(() => null)

  if (status === 'dry_run') {
    return {
      success: true,
      httpStatus: 200,
      data: {
        status: 'dry_run',
        templateKey: template.key,
        tplCode: template.tplCode,
        receiverMasked,
        customerAppUrl: link.customerAppUrl,
        provider: config.provider,
        providerMessageId: null,
        providerCode: null,
        providerMessage: providerResult.providerMessage || 'dry run',
      },
    }
  }

  if (status === 'accepted') {
    return {
      success: true,
      httpStatus: 200,
      data: {
        status: 'accepted',
        templateKey: template.key,
        receiverMasked,
        provider: config.provider,
        providerMessageId: providerResult.providerMessageId ?? null,
        providerCode: providerResult.providerCode ?? 0,
        providerMessage: providerResult.providerMessage ?? null,
      },
    }
  }

  return {
    success: false,
    httpStatus: 502,
    error: '알림톡 발송에 실패했습니다.',
    data: {
      status: 'failed',
      templateKey: template.key,
      receiverMasked,
      provider: config.provider,
      providerMessageId: providerResult.providerMessageId ?? null,
      providerCode: providerResult.providerCode ?? null,
      providerMessage: providerResult.providerMessage ?? null,
    },
  }
}
