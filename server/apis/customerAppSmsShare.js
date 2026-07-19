import {
  CUSTOMER_REGISTRATION_SMS_DISABLED_REASON,
  resolveCustomerRegistrationSmsAvailability,
  sendCustomerRegistrationSmsViaUserAligo,
} from './customerRegistrationSmsShare.js'

export const CUSTOMER_APP_SMS_DISABLED_REASON = CUSTOMER_REGISTRATION_SMS_DISABLED_REASON

export const CUSTOMER_APP_SMS_MISSING_RECEIVER_REASON =
  '고객 휴대폰번호가 없어 발송할 수 없습니다.'

/**
 * 고객앱 링크 문자 본문. 유저 개인 알리고(sendSingleSms)로만 발송한다.
 * @param {string} customerAppUrl
 */
export function buildCustomerAppLinkSmsMessage(customerAppUrl) {
  const url = String(customerAppUrl ?? '').trim()
  return [
    '안녕하세요.',
    '고객앱 접속 링크를 안내드립니다.',
    '',
    '아래 링크를 눌러 고객앱에 접속해 주세요.',
    url,
  ].join('\n')
}

/**
 * 고객앱 문자 availability — 유저 개인 알리고 설정 SSOT.
 * (수신번호 존재 여부는 API 레이어에서 customer phone / body receiver 로 판단)
 *
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 */
export async function resolveCustomerAppSmsAvailability(pool, req) {
  return resolveCustomerRegistrationSmsAvailability(pool, req)
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ receiver: string, message: string }} input
 */
export async function sendCustomerAppSmsViaUserAligo(pool, req, input) {
  return sendCustomerRegistrationSmsViaUserAligo(pool, req, input)
}
