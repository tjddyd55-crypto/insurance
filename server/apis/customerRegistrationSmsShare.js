import { assertSmsRealSendAllowed, isSmsModuleEnabled } from '../sms/smsModuleConfig.js'
import { listSmsSenders } from '../sms/smsSenderService.js'
import { sendSingleSms } from '../sms/smsSendService.js'
import { getSmsSettings } from '../sms/smsSettingsService.js'
import { resolveSmsAuthContext } from '../sms/smsScope.js'

export const CUSTOMER_REGISTRATION_SMS_DISABLED_REASON =
  '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.'

/**
 * @param {unknown} status
 */
function isVerifiedSenderStatus(status) {
  return String(status ?? '')
    .trim()
    .toLowerCase() === 'verified'
}

/**
 * @param {string | null | undefined} raw
 */
function digitsOnly(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * CRM 단건 발송과 동일한 유저 개인 알리고 설정·발신번호 SSOT.
 * 시스템 인증 SMS / 자동문자 / 예약문자와 무관하다.
 *
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @returns {Promise<{
 *   available: boolean,
 *   reason: string | null,
 *   scope?: { tenantId: number, userId: string, gaId: number | null },
 *   senderNumber?: string,
 * }>}
 */
export async function resolveCustomerRegistrationSmsAvailability(pool, req) {
  try {
    if (!isSmsModuleEnabled()) {
      return { available: false, reason: CUSTOMER_REGISTRATION_SMS_DISABLED_REASON }
    }

    const scope = await resolveSmsAuthContext(pool, req)
    const settings = await getSmsSettings(pool, scope)

    // 유저 개인 알리고 설정이 SSOT (시스템 인증 SMS env만으로 판단하지 않음)
    const aligoUserId = String(settings?.aligoUserId ?? '').trim()
    const defaultSender = digitsOnly(settings?.defaultSender)
    if (!settings?.configured || !aligoUserId) {
      return { available: false, reason: CUSTOMER_REGISTRATION_SMS_DISABLED_REASON }
    }

    const senders = await listSmsSenders(pool, scope)
    const senderList = Array.isArray(senders) ? senders : []
    const verifiedSenders = senderList.filter((s) => isVerifiedSenderStatus(s.status))

    const preferredVerified =
      verifiedSenders.find((s) => s.isDefault) ||
      verifiedSenders.find((s) => digitsOnly(s.senderNumber) === defaultSender) ||
      verifiedSenders[0]

    // CRM 단건 발송과 동일: verified 우선, 없으면 설정 기본 발신번호
    const senderNumber = digitsOnly(preferredVerified?.senderNumber) || defaultSender
    if (!senderNumber) {
      return { available: false, reason: CUSTOMER_REGISTRATION_SMS_DISABLED_REASON }
    }

    // sendSingleSms 가 요구하는 실발송 게이트 (정책 변경 없이 동일 검사)
    try {
      assertSmsRealSendAllowed()
    } catch {
      return { available: false, reason: CUSTOMER_REGISTRATION_SMS_DISABLED_REASON }
    }

    return {
      available: true,
      reason: null,
      scope,
      senderNumber,
    }
  } catch {
    return { available: false, reason: CUSTOMER_REGISTRATION_SMS_DISABLED_REASON }
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ receiver: string, message: string }} input
 */
export async function sendCustomerRegistrationSmsViaUserAligo(pool, req, input) {
  const avail = await resolveCustomerRegistrationSmsAvailability(pool, req)
  if (!avail.available || !avail.scope || !avail.senderNumber) {
    const err = new Error('sms_customer_registration_disabled')
    err.status = 400
    err.publicMessage = avail.reason || CUSTOMER_REGISTRATION_SMS_DISABLED_REASON
    throw err
  }

  return sendSingleSms(pool, avail.scope, {
    senderNumber: avail.senderNumber,
    receiver: input.receiver,
    message: input.message,
    messageType: 'info',
  })
}
