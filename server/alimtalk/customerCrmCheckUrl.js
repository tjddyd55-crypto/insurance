/**
 * CRM 담당자용 고객 확인 deep-link (알림톡 버튼).
 * public registration URL / registration token 을 절대 재사용하지 않는다.
 *
 * SSOT: notificationTarget.buildStaffAppOpenUrl (Native 우선 → Web fallback)
 */

import {
  NOTIFICATION_TARGET_TYPES,
  buildStaffAppOpenUrl,
  resolveStaffPublicOrigin,
} from '../lib/notifications/notificationTarget.js'

export { resolveStaffPublicOrigin as resolveCrmPublicOrigin }

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
  return buildStaffAppOpenUrl({
    origin: input?.origin,
    reqLike: input?.reqLike ?? null,
    env: input?.env ?? process.env,
    target: {
      type: NOTIFICATION_TARGET_TYPES.CUSTOMER,
      customerId,
    },
  })
}
