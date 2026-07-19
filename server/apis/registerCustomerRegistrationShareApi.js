import { sendCustomerRegistrationLinkAlimtalk } from '../alimtalk/alimtalkRegistrationService.js'
import {
  buildCustomerRegistrationInviteUrl,
  buildCustomerRegistrationSmsMessage,
  resolveCustomerRegistrationPublicOrigin,
} from '../alimtalk/customerRegistrationLinkUrl.js'
import { maskAlimtalkReceiver, normalizeAlimtalkPhone, validateAlimtalkPhone } from '../alimtalk/alimtalkPhone.js'
import { isSmsModuleEnabled, isSmsRealSendEnabled } from '../sms/smsModuleConfig.js'
import { listSmsSenders } from '../sms/smsSenderService.js'
import { sendSingleSms } from '../sms/smsSendService.js'
import { getSmsSettings } from '../sms/smsSettingsService.js'
import { resolveSmsAuthContext } from '../sms/smsScope.js'

const SMS_DISABLED_REASON = '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.'

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
async function loadUserInviteIdentity(pool, userId) {
  const r = await pool.query(
    `
    SELECT
      u.username,
      g.code AS ga_code,
      u.ga_id
    FROM users u
    LEFT JOIN ga_companies g ON g.id = u.ga_id AND COALESCE(g.is_deleted, false) = false
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('express').Request} req
 * @param {import('pg').Pool} pool
 */
async function resolveRegistrationUrlForRequest(req, pool) {
  const agentId = String(req.user?.id ?? '').trim()
  const row = agentId ? await loadUserInviteIdentity(pool, agentId) : null
  const refUsername = String(row?.username ?? req.user?.username ?? '').trim()
  const gaCode = String(row?.ga_code ?? req.user?.gaCode ?? '')
    .trim()
    .toUpperCase()
  const origin = resolveCustomerRegistrationPublicOrigin({
    protocol: req.protocol,
    host: req.get('host'),
  })
  const registrationUrl = buildCustomerRegistrationInviteUrl({
    origin,
    refUsername,
    gaCode,
  })
  return { agentId, registrationUrl, refUsername, gaCode }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 */
async function resolveSmsAvailability(pool, req) {
  if (!isSmsModuleEnabled()) {
    return { available: false, reason: SMS_DISABLED_REASON }
  }
  if (!isSmsRealSendEnabled()) {
    return { available: false, reason: SMS_DISABLED_REASON }
  }
  try {
    const scope = await resolveSmsAuthContext(pool, req)
    const settings = await getSmsSettings(pool, scope)
    if (!settings?.configured || settings.providerMisconfigured) {
      return { available: false, reason: SMS_DISABLED_REASON }
    }
    const senders = await listSmsSenders(pool, scope)
    const senderList = Array.isArray(senders) ? senders : []
    const verifiedSenders = senderList.filter((s) => String(s.status ?? '').toLowerCase() === 'verified')
    const defaultSender = String(settings.defaultSender ?? '').replace(/\D/g, '')
    if (verifiedSenders.length === 0 && !defaultSender) {
      return { available: false, reason: SMS_DISABLED_REASON }
    }
    return {
      available: true,
      reason: null,
      defaultSender,
      scope,
      settings,
      verifiedSenders,
    }
  } catch {
    return { available: false, reason: SMS_DISABLED_REASON }
  }
}

/**
 * 고객등록 링크 공유: preview / SMS availability / SMS send / alimtalk
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   handleDbError: Function,
 * }} ctx
 */
export function registerCustomerRegistrationShareApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/agent/customer-registration/link', requireAuth, async (req, res) => {
    try {
      const { registrationUrl } = await resolveRegistrationUrlForRequest(req, pool)
      if (!registrationUrl) {
        res.status(400).json({
          success: false,
          message: '고객등록 링크를 만들 수 없습니다.',
          error: '고객등록 링크를 만들 수 없습니다.',
        })
        return
      }
      res.json({
        success: true,
        data: { registrationUrl },
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/agent/customer-registration/sms-availability', requireAuth, async (req, res) => {
    try {
      const avail = await resolveSmsAvailability(pool, req)
      res.json({
        success: true,
        data: {
          available: Boolean(avail.available),
          reason: avail.available ? null : avail.reason || SMS_DISABLED_REASON,
        },
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/agent/customer-registration/sms', requireAuth, async (req, res) => {
    try {
      const avail = await resolveSmsAvailability(pool, req)
      if (!avail.available || !avail.scope) {
        res.status(400).json({
          success: false,
          message: SMS_DISABLED_REASON,
          error: SMS_DISABLED_REASON,
          data: { status: 'disabled' },
        })
        return
      }

      const phoneDigits = normalizeAlimtalkPhone(req.body?.receiver)
      const phoneErr = validateAlimtalkPhone(phoneDigits)
      if (phoneErr) {
        res.status(400).json({
          success: false,
          message: phoneErr,
          error: phoneErr,
          data: { status: 'failed', receiverMasked: maskAlimtalkReceiver(phoneDigits) },
        })
        return
      }

      const { registrationUrl } = await resolveRegistrationUrlForRequest(req, pool)
      if (!registrationUrl) {
        res.status(400).json({
          success: false,
          message: '고객등록 링크를 만들 수 없습니다.',
          error: '고객등록 링크를 만들 수 없습니다.',
          data: { status: 'failed' },
        })
        return
      }

      const preferred =
        (avail.verifiedSenders || []).find((s) => s.isDefault) ||
        (avail.verifiedSenders || [])[0]
      const senderNumber = String(preferred?.senderNumber || avail.defaultSender || '').replace(/\D/g, '')

      if (!senderNumber) {
        res.status(400).json({
          success: false,
          message: SMS_DISABLED_REASON,
          error: SMS_DISABLED_REASON,
          data: { status: 'disabled' },
        })
        return
      }

      const message = buildCustomerRegistrationSmsMessage(registrationUrl)
      const result = await sendSingleSms(pool, avail.scope, {
        senderNumber,
        receiver: phoneDigits,
        message,
        messageType: 'info',
      })

      res.json({
        success: true,
        data: {
          status: 'sent',
          receiverMasked: maskAlimtalkReceiver(phoneDigits),
          campaignId: result?.campaignId ?? null,
        },
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status) {
        const msg =
          /** @type {{ publicMessage?: string, message?: string }} */ (error).publicMessage ||
          /** @type {{ message?: string }} */ (error).message ||
          '문자 발송에 실패했습니다.'
        res.status(Number(error.status) || 400).json({
          success: false,
          message: msg,
          error: msg,
          data: { status: 'failed' },
        })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/agent/customer-registration/alimtalk', requireAuth, async (req, res) => {
    try {
      const agentId = String(req.user?.id ?? '').trim()
      if (!agentId) {
        res.status(401).json({ success: false, error: '로그인이 필요합니다.', message: '로그인이 필요합니다.' })
        return
      }
      const forceDryRun = req.body?.dryRun === true
      const result = await sendCustomerRegistrationLinkAlimtalk(pool, {
        agentId,
        receiver: req.body?.receiver,
        user: req.user,
        reqLike: {
          protocol: req.protocol,
          host: req.get('host'),
        },
        forceDryRun,
      })

      if (!result.success) {
        res.status(result.httpStatus || 400).json({
          success: false,
          message: result.error || '카카오톡 발송에 실패했습니다.',
          error: result.error || '카카오톡 발송에 실패했습니다.',
          data: result.data,
        })
        return
      }

      res.status(200).json({
        success: true,
        data: result.data,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
