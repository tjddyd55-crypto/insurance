/**
 * CRM 담당자용 고객 확인 deep-link (알림톡 버튼).
 * public registration URL / registration token 을 절대 재사용하지 않는다.
 *
 * PC SSOT: /customers/:id/consultations?customerId=:id
 * (CustomersPage path 우선 + query fallback 과 동일)
 */

import { forceHttpsPublicOrigin, forceHttpsPublicUrl } from './alimtalkPublicUrl.js'

/**
 * @param {{ protocol?: string, host?: string } | null | undefined} reqLike
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveCrmPublicOrigin(reqLike, env = process.env) {
  const fromEnv = String(
    env.VITE_BASE_URL ??
      env.PUBLIC_BASE_URL ??
      env.CUSTOMER_REGISTER_PUBLIC_BASE ??
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
 * @param {{
 *   customerId: number | string
 *   origin?: string
 *   reqLike?: { protocol?: string, host?: string } | null
 *   env?: NodeJS.ProcessEnv
 * }} input
 */
export function buildCustomerCrmCheckUrl(input) {
  const customerId = Number(input?.customerId)
  if (!Number.isInteger(customerId) || customerId < 1) {
    return ''
  }
  const origin =
    String(input?.origin ?? '').trim() ||
    resolveCrmPublicOrigin(input?.reqLike ?? null, input?.env ?? process.env)
  if (!origin) {
    return ''
  }
  return forceHttpsPublicUrl(
    `${origin}/customers/${customerId}/consultations?customerId=${encodeURIComponent(String(customerId))}`,
  )
}
