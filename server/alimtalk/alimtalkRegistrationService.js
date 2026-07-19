import {
  isCustomerRegistrationLinkRealSendApproved,
  isInsuranceAlimtalkCredentialsComplete,
  loadInsuranceAlimtalkConfig,
} from './alimtalkConfig.js'
import {
  buildCustomerRegistrationInviteUrl,
  resolveCustomerRegistrationPublicOrigin,
} from './customerRegistrationLinkUrl.js'
import { ensureAlimtalkSendLogsTable, insertAlimtalkSendLog } from './alimtalkLogService.js'
import { maskAlimtalkReceiver, normalizeAlimtalkPhone, validateAlimtalkPhone } from './alimtalkPhone.js'
import { sendAligoAlimtalk } from './alimtalkProvider.js'
import {
  getCustomerRegistrationLinkTemplate,
  isPlaceholderTplCode,
  TEMPLATE_KEY_CUSTOMER_REGISTRATION_LINK,
} from './alimtalkTemplates.js'

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {string} userId
 */
async function loadManagerAndRef(pool, userId) {
  const r = await pool.query(
    `
    SELECT
      u.display_name,
      u.username,
      g.code AS ga_code
    FROM users u
    LEFT JOIN ga_companies g ON g.id = u.ga_id AND COALESCE(g.is_deleted, false) = false
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId],
  )
  const row = r.rows[0] ?? null
  if (!row) return null
  const display = String(row.display_name ?? '').trim()
  const username = String(row.username ?? '').trim()
  return {
    managerName: display || username || '담당자',
    refUsername: username,
    gaCode: String(row.ga_code ?? '')
      .trim()
      .toUpperCase(),
  }
}

/**
 * 고객등록 링크 알림톡 발송 (수신번호 직접 입력, customer_id 없음).
 *
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {{
 *   agentId: string,
 *   receiver: string,
 *   user?: { id?: string, role?: string, gaId?: unknown, username?: string, gaCode?: string },
 *   reqLike?: { protocol?: string, host?: string } | null,
 *   forceDryRun?: boolean,
 *   config?: ReturnType<typeof loadInsuranceAlimtalkConfig>,
 *   templateEnv?: NodeJS.ProcessEnv,
 *   sendFn?: typeof sendAligoAlimtalk,
 *   skipEnsureLogTable?: boolean,
 * }} params
 */
export async function sendCustomerRegistrationLinkAlimtalk(pool, params) {
  const config = params.config ?? loadInsuranceAlimtalkConfig()
  const template = getCustomerRegistrationLinkTemplate(params.templateEnv ?? process.env)
  const sendFn = params.sendFn ?? sendAligoAlimtalk
  const gaId = Number(params.user?.gaId)
  const resolvedGaId = Number.isInteger(gaId) && gaId > 0 ? gaId : null

  if (!params.skipEnsureLogTable) {
    try {
      await ensureAlimtalkSendLogsTable(pool)
    } catch {
      // ignore
    }
  }

  const role = String(params.user?.role ?? '')
  if (role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER') {
    return {
      success: false,
      httpStatus: 403,
      error: '해당 계정은 고객등록 알림톡을 발송할 수 없습니다.',
      data: { status: 'failed', templateKey: TEMPLATE_KEY_CUSTOMER_REGISTRATION_LINK },
    }
  }

  const phoneDigits = normalizeAlimtalkPhone(params.receiver)
  const receiverMasked = maskAlimtalkReceiver(phoneDigits)
  const phoneErr = validateAlimtalkPhone(phoneDigits)
  if (phoneErr) {
    return {
      success: false,
      httpStatus: 400,
      error: phoneErr,
      data: {
        status: 'failed',
        templateKey: template.key,
        tplCode: template.tplCode,
        receiverMasked,
        providerMessage: phoneErr,
      },
    }
  }

  const profile = await loadManagerAndRef(pool, params.agentId)
  const refUsername =
    profile?.refUsername ||
    String(params.user?.username ?? '').trim()
  const gaCode =
    profile?.gaCode ||
    String(params.user?.gaCode ?? '')
      .trim()
      .toUpperCase()
  const managerName = profile?.managerName || '담당자'

  const origin = resolveCustomerRegistrationPublicOrigin(params.reqLike)
  const registrationUrl = buildCustomerRegistrationInviteUrl({
    origin,
    refUsername,
    gaCode,
  })
  if (!registrationUrl) {
    return {
      success: false,
      httpStatus: 400,
      error: '고객등록 링크를 생성하지 못했습니다.',
      data: {
        status: 'failed',
        templateKey: template.key,
        tplCode: template.tplCode,
        receiverMasked,
        providerMessage: 'registration url build failed',
      },
    }
  }

  const message = template.buildMessage({ managerName })
  const buttonPayload = template.buildButtonPayload({ registrationUrl })
  const forceDryRun = Boolean(params.forceDryRun)
  const effectiveDryRun = Boolean(config.dryRun) || forceDryRun

  if (!effectiveDryRun && isPlaceholderTplCode(template.tplCode)) {
    return {
      success: false,
      httpStatus: 503,
      error: '승인된 알림톡 템플릿 코드가 없어 실발송할 수 없습니다.',
      data: {
        status: 'failed',
        templateKey: template.key,
        tplCode: template.tplCode,
        receiverMasked,
        providerMessage: 'placeholder tpl_code',
      },
    }
  }

  if (!effectiveDryRun && !isCustomerRegistrationLinkRealSendApproved(config)) {
    await insertAlimtalkSendLog(pool, {
      gaId: resolvedGaId,
      userId: params.agentId,
      customerId: null,
      templateKey: template.key,
      tplCode: template.tplCode,
      receiverMasked,
      status: 'blocked',
      provider: config.provider,
      providerMessage: 'customer registration template is not approved',
      dryRun: false,
      requestContext: {
        reason: 'approval_flag_blocked',
        customerRegistrationLinkApproved: config.customerRegistrationLinkApproved,
        allowRealSend: config.allowRealSend,
      },
    }).catch(() => null)

    // 검수중: success=true + blocked (UI에서 링크 복사 유도)
    return {
      success: true,
      httpStatus: 200,
      data: {
        status: 'blocked',
        templateKey: template.key,
        tplCode: template.tplCode,
        receiverMasked,
        provider: config.provider,
        providerMessage: 'customer registration template is not approved',
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
        tplCode: template.tplCode,
        receiverMasked,
        providerMessage: 'credentials incomplete',
      },
    }
  }

  const providerResult = await sendFn({
    config,
    dryRun: effectiveDryRun,
    tplCode: template.tplCode,
    receiver: phoneDigits,
    subject: template.subject,
    message,
    buttonPayload,
    recvName: '고객',
  })

  const status =
    providerResult.status === 'sent'
      ? 'sent'
      : providerResult.status === 'dry_run'
        ? 'dry_run'
        : 'failed'

  await insertAlimtalkSendLog(pool, {
    gaId: resolvedGaId,
    userId: params.agentId,
    customerId: null,
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
      registrationUrlPresent: true,
      apikey: config.apiKey,
      senderkey: config.senderKey,
      receiver_1: phoneDigits,
      linkMo: registrationUrl,
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
        provider: config.provider,
        providerMessageId: null,
        providerCode: null,
        providerMessage: providerResult.providerMessage || 'dry run',
      },
    }
  }

  if (status === 'sent') {
    return {
      success: true,
      httpStatus: 200,
      data: {
        status: 'sent',
        templateKey: template.key,
        tplCode: template.tplCode,
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
    error: '카카오톡 발송에 실패했습니다.',
    data: {
      status: 'failed',
      templateKey: template.key,
      tplCode: template.tplCode,
      receiverMasked,
      provider: config.provider,
      providerMessageId: providerResult.providerMessageId ?? null,
      providerCode: providerResult.providerCode ?? null,
      providerMessage: providerResult.providerMessage ?? null,
    },
  }
}
