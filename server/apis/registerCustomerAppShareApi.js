import { assertCanSendCustomerAppAlimtalk } from '../alimtalk/alimtalkService.js'
import { ensureCustomerAppUniversalUrl } from '../alimtalk/customerAppLinkForAlimtalk.js'
import { maskAlimtalkReceiver, normalizeAlimtalkPhone, validateAlimtalkPhone } from '../alimtalk/alimtalkPhone.js'
import {
  CUSTOMER_APP_SMS_DISABLED_REASON,
  CUSTOMER_APP_SMS_MISSING_RECEIVER_REASON,
  buildCustomerAppLinkSmsMessage,
  resolveCustomerAppSmsAvailability,
  sendCustomerAppSmsViaUserAligo,
} from './customerAppSmsShare.js'

function parsePositiveInt(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * 고객앱 링크 문자: availability / send (유저 개인 알리고 + sendSingleSms).
 * POST /agent/customers/:customerId/customer-app/sms
 * GET  /agent/customers/:customerId/customer-app/sms-availability
 *
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   handleDbError: Function,
 * }} ctx
 */
export function registerCustomerAppShareApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get(
    '/agent/customers/:customerId/customer-app/sms-availability',
    requireAuth,
    async (req, res) => {
      try {
        const customerId = parsePositiveInt(req.params.customerId)
        if (customerId == null) {
          res.status(400).json({ success: false, error: '고객 ID가 올바르지 않습니다.' })
          return
        }
        const agentId = String(req.user?.id ?? '').trim()
        if (!agentId) {
          res.status(401).json({ success: false, error: '로그인이 필요합니다.' })
          return
        }

        const access = await assertCanSendCustomerAppAlimtalk(pool, agentId, customerId, req.user)
        if (!access.ok) {
          res.status(access.status || 403).json({
            success: false,
            error: access.message,
            message: access.message,
          })
          return
        }

        // 수신번호는 모달에서 고객 휴대폰 기본값·수정 가능. availability 는 유저 알리고만 판단.
        const avail = await resolveCustomerAppSmsAvailability(pool, req)
        res.json({
          success: true,
          data: {
            available: Boolean(avail.available),
            reason: avail.available
              ? null
              : avail.reason || CUSTOMER_APP_SMS_DISABLED_REASON,
          },
        })
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.post('/agent/customers/:customerId/customer-app/sms', requireAuth, async (req, res) => {
    try {
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        res.status(400).json({ success: false, error: '고객 ID가 올바르지 않습니다.' })
        return
      }
      const agentId = String(req.user?.id ?? '').trim()
      if (!agentId) {
        res.status(401).json({ success: false, error: '로그인이 필요합니다.' })
        return
      }

      const access = await assertCanSendCustomerAppAlimtalk(pool, agentId, customerId, req.user)
      if (!access.ok) {
        res.status(access.status || 403).json({
          success: false,
          error: access.message,
          message: access.message,
          data: { status: 'failed' },
        })
        return
      }

      const bodyReceiver = normalizeAlimtalkPhone(req.body?.receiver)
      const customerPhone = normalizeAlimtalkPhone(access.customer?.phone)
      const phoneDigits = bodyReceiver || customerPhone
      const phoneErr = validateAlimtalkPhone(phoneDigits)
      if (phoneErr) {
        res.status(400).json({
          success: false,
          message: CUSTOMER_APP_SMS_MISSING_RECEIVER_REASON,
          error: CUSTOMER_APP_SMS_MISSING_RECEIVER_REASON,
          data: {
            status: 'missing_receiver',
            receiverMasked: maskAlimtalkReceiver(phoneDigits),
          },
        })
        return
      }

      const link = await ensureCustomerAppUniversalUrl(pool, {
        agentId,
        customerId,
        reqLike: {
          protocol: req.protocol,
          host: req.get('host'),
        },
      })
      if (!link.ok || !link.customerAppUrl) {
        res.status(500).json({
          success: false,
          message: '고객앱 링크를 생성하지 못했습니다.',
          error: '고객앱 링크를 생성하지 못했습니다.',
          data: { status: 'failed' },
        })
        return
      }

      const message = buildCustomerAppLinkSmsMessage(link.customerAppUrl)
      const result = await sendCustomerAppSmsViaUserAligo(pool, req, {
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
          msg === CUSTOMER_APP_SMS_DISABLED_REASON
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
}
