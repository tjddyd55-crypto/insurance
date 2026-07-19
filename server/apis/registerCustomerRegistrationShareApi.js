import { sendCustomerRegistrationLinkAlimtalk } from '../alimtalk/alimtalkRegistrationService.js'
import {
  buildCustomerRegistrationInviteUrl,
  buildCustomerRegistrationSmsMessage,
  resolveCustomerRegistrationPublicOrigin,
} from '../alimtalk/customerRegistrationLinkUrl.js'
import { maskAlimtalkReceiver, normalizeAlimtalkPhone, validateAlimtalkPhone } from '../alimtalk/alimtalkPhone.js'
import {
  CUSTOMER_REGISTRATION_SMS_DISABLED_REASON,
  resolveCustomerRegistrationSmsAvailability,
  sendCustomerRegistrationSmsViaUserAligo,
} from './customerRegistrationSmsShare.js'

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
 * 고객등록 링크 공유: preview / SMS availability / SMS send / alimtalk
 * SMS 는 유저 개인 알리고 설정 + CRM 단건 발송(sendSingleSms)만 사용한다.
 *
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
      const avail = await resolveCustomerRegistrationSmsAvailability(pool, req)
      res.json({
        success: true,
        data: {
          available: Boolean(avail.available),
          reason: avail.available
            ? null
            : avail.reason || CUSTOMER_REGISTRATION_SMS_DISABLED_REASON,
        },
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/agent/customer-registration/sms', requireAuth, async (req, res) => {
    try {
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

      const message = buildCustomerRegistrationSmsMessage(registrationUrl)
      const result = await sendCustomerRegistrationSmsViaUserAligo(pool, req, {
        receiver: phoneDigits,
        message,
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
        const isDisabled =
          String(/** @type {{ message?: string }} */ (error).message ?? '') ===
            'sms_customer_registration_disabled' ||
          msg === CUSTOMER_REGISTRATION_SMS_DISABLED_REASON
        res.status(Number(error.status) || 400).json({
          success: false,
          message: msg,
          error: msg,
          data: { status: isDisabled ? 'disabled' : 'failed', message: msg },
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
