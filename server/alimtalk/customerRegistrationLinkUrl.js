/**
 * 고객등록 초대 링크 URL (서버).
 * 클라 `buildCustomerRegistrationInviteUrl` 과 동일 규칙.
 * 알림톡 승인 버튼 URL 은 https 고정.
 */

import { forceHttpsPublicOrigin, forceHttpsPublicUrl } from './alimtalkPublicUrl.js'

/**
 * @param {{
 *   origin: string,
 *   refUsername: string,
 *   gaCode: string,
 * }} input
 */
export function buildCustomerRegistrationInviteUrl(input) {
  const origin = forceHttpsPublicOrigin(String(input?.origin ?? '').trim())
  const refUsername = String(input?.refUsername ?? '').trim()
  const gaCode = String(input?.gaCode ?? '')
    .trim()
    .toUpperCase()
  if (!origin || !refUsername || !gaCode) {
    return ''
  }
  return forceHttpsPublicUrl(
    `${origin}/customer/register?ref=${encodeURIComponent(refUsername)}&ga=${encodeURIComponent(gaCode)}`,
  )
}

/**
 * @param {{ protocol?: string, host?: string } | null | undefined} reqLike
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveCustomerRegistrationPublicOrigin(reqLike, env = process.env) {
  const fromEnv = String(
    env.CUSTOMER_REGISTER_PUBLIC_BASE ??
      env.VITE_BASE_URL ??
      env.PUBLIC_BASE_URL ??
      env.CUSTOMER_APP_LINK_PAGE_BASE ??
      '',
  )
    .trim()
    .replace(/\/$/, '')
  if (fromEnv) return forceHttpsPublicOrigin(fromEnv)
  const protocol = String(reqLike?.protocol ?? 'https').replace(/:$/, '')
  const host = String(reqLike?.host ?? '').trim()
  if (host) return forceHttpsPublicOrigin(`${protocol}://${host}`)
  return ''
}

/**
 * @param {string} registrationUrl
 */
export function buildCustomerRegistrationSmsMessage(registrationUrl) {
  const url = String(registrationUrl ?? '').trim()
  return [
    '안녕하세요.',
    '보험 상담 및 업무 진행을 위해 고객정보 등록 링크를 안내드립니다.',
    '',
    '아래 링크를 눌러 필요한 정보를 입력해 주세요.',
    url,
  ].join('\n')
}
