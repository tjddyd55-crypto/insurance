/**
 * Kakao 승인 템플릿(UJ_6670 / UJ_6184) 버튼 URL용 public base.
 *
 * 일반 DEV UI·링크 복사 API는 req.host / CUSTOMER_APP_LINK_PAGE_BASE(미설정 시)를 유지한다.
 * 알림톡 button_1 만 승인 도메인(production public base)을 사용한다.
 */

import { forceHttpsPublicOrigin, forceHttpsPublicUrl } from './alimtalkPublicUrl.js'

/**
 * Aligo 승인 템플릿에 등록된 production public origin.
 * env 미설정 시 fallback (신규 env 추가 없음).
 */
export const APPROVED_ALIMTALK_PUBLIC_ORIGIN_FALLBACK =
  'https://insurance-production-7bd8.up.railway.app'

/**
 * 고객등록·고객앱 알림톡 버튼 origin.
 * SSOT: CUSTOMER_REGISTER_PUBLIC_BASE → PUBLIC_BASE_URL → VITE_BASE_URL → production fallback.
 * req.host 는 사용하지 않는다.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveApprovedAlimtalkPublicOrigin(env = process.env) {
  const fromEnv = String(
    env.CUSTOMER_REGISTER_PUBLIC_BASE ?? env.PUBLIC_BASE_URL ?? env.VITE_BASE_URL ?? '',
  )
    .trim()
    .replace(/\/$/, '')
  if (fromEnv) return forceHttpsPublicOrigin(fromEnv)
  return forceHttpsPublicOrigin(APPROVED_ALIMTALK_PUBLIC_ORIGIN_FALLBACK)
}

/**
 * 고객앱 알림톡 버튼 base path (/customer-app/link).
 * SSOT: CUSTOMER_APP_LINK_PAGE_BASE → {approved origin}/customer-app/link
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveApprovedAlimtalkCustomerAppLinkPageBase(env = process.env) {
  const fromEnv = String(env.CUSTOMER_APP_LINK_PAGE_BASE ?? '')
    .trim()
    .replace(/\/+$/, '')
  if (fromEnv) return forceHttpsPublicUrl(fromEnv)
  return forceHttpsPublicUrl(
    `${resolveApprovedAlimtalkPublicOrigin(env)}/customer-app/link`,
  )
}

/**
 * @param {string} linkCode
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildCustomerAppAlimtalkButtonUrl(linkCode, env = process.env) {
  const base = resolveApprovedAlimtalkCustomerAppLinkPageBase(env)
  const code = String(linkCode ?? '').trim()
  if (!base || !code) return ''
  const separator = base.includes('?') ? '&' : '?'
  return forceHttpsPublicUrl(`${base}${separator}code=${encodeURIComponent(code)}`)
}
