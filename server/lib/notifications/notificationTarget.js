/**
 * Notification target / deep-link SSOT.
 * Push, in-app 알림함, 카카오 알림톡 버튼은 동일 target을 사용한다.
 */

import { buildInternalCustomerClaimRoute } from '../internalCustomerClaimRoute.js'
import { forceHttpsPublicOrigin, forceHttpsPublicUrl } from '../../alimtalk/alimtalkPublicUrl.js'
import {
  ANDROID_PACKAGE_DEV,
  IOS_BUNDLE_DEV,
  resolveAllowedPushAppPackageForRuntime,
} from '../push/pushDeviceService.js'

export const NOTIFICATION_TARGET_TYPES = {
  CUSTOMER: 'customer',
  NEWSLETTER: 'newsletter',
  CLAIM: 'claim',
}

export const PUSH_EVENT_TYPES = {
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_CLAIM_SUBMITTED: 'CUSTOMER_CLAIM_SUBMITTED',
  NEWSLETTER_PUBLISHED: 'NEWSLETTER_PUBLISHED',
}

export const NATIVE_SCHEME_PROD = 'onefc'
export const NATIVE_SCHEME_DEV = 'onefc-dev'

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveNativeAppScheme(env = process.env) {
  const appPackage = resolveAllowedPushAppPackageForRuntime(env)
  if (appPackage === ANDROID_PACKAGE_DEV || appPackage === IOS_BUNDLE_DEV) {
    return NATIVE_SCHEME_DEV
  }
  return NATIVE_SCHEME_PROD
}

/**
 * Native custom-scheme deep link (Android intent / iOS URL scheme).
 * @param {{ customerId: number | string; env?: NodeJS.ProcessEnv }} input
 */
export function buildNativeCustomerDeepLink(input) {
  const customerId = Number(input?.customerId)
  if (!Number.isInteger(customerId) || customerId < 1) {
    return ''
  }
  const scheme = resolveNativeAppScheme(input?.env ?? process.env)
  return `${scheme}://customers/${customerId}`
}

/**
 * CRM Native internal route (expo-router path).
 * @param {{ type: string; customerId?: number | string | null; claimRequestId?: number | string | null; newsletterId?: string | null; newsChannel?: string | null; boardSlug?: string | null }} target
 */
export function buildNativeInternalRoute(target) {
  const type = String(target?.type ?? '').trim().toLowerCase()
  if (type === NOTIFICATION_TARGET_TYPES.CUSTOMER) {
    const customerId = Number(target.customerId)
    if (!Number.isInteger(customerId) || customerId < 1) return ''
    return `/customers/${customerId}`
  }
  if (type === NOTIFICATION_TARGET_TYPES.CLAIM) {
    return buildInternalCustomerClaimRoute({
      customerId: target.customerId,
      claimRequestId: target.claimRequestId,
    })
  }
  if (type === NOTIFICATION_TARGET_TYPES.NEWSLETTER) {
    const newsletterId = String(target.newsletterId ?? '').trim()
    if (!newsletterId) return ''
    const params = new URLSearchParams()
    params.set('newsletterId', newsletterId)
    const channel = String(target.newsChannel ?? 'INSURER').trim().toUpperCase()
    if (channel) params.set('channel', channel)
    const boardSlug = String(target.boardSlug ?? '').trim()
    if (boardSlug) {
      return `/portal/boards/${encodeURIComponent(boardSlug)}?${params.toString()}`
    }
    const base =
      channel === 'LOSS_ADJUSTER' ? '/portal/adjuster-news' : '/portal/newsletters'
    return `${base}?${params.toString()}`
  }
  return ''
}

/**
 * Web CRM fallback when Native app is unavailable.
 * @param {{ type: string; customerId?: number | string | null; claimRequestId?: number | string | null }} target
 */
export function buildWebFallbackRoute(target) {
  const type = String(target?.type ?? '').trim().toLowerCase()
  if (type === NOTIFICATION_TARGET_TYPES.CUSTOMER) {
    const customerId = Number(target.customerId)
    if (!Number.isInteger(customerId) || customerId < 1) return ''
    return `/customers/${customerId}/consultations?customerId=${encodeURIComponent(String(customerId))}`
  }
  if (type === NOTIFICATION_TARGET_TYPES.CLAIM) {
    const route = buildInternalCustomerClaimRoute({
      customerId: target.customerId,
      claimRequestId: target.claimRequestId,
    })
    return route || ''
  }
  if (type === NOTIFICATION_TARGET_TYPES.NEWSLETTER) {
    return buildNativeInternalRoute(target)
  }
  return ''
}

/**
 * @param {{ protocol?: string; host?: string } | null | undefined} reqLike
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveStaffPublicOrigin(reqLike, env = process.env) {
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
 * Kakao WL button / SMS용 https 진입점.
 * Native 앱 우선 → Web fallback.
 *
 * @param {{
 *   target: { type: string; customerId?: number | string | null; claimRequestId?: number | string | null; newsletterId?: string | null; newsChannel?: string | null; boardSlug?: string | null }
 *   origin?: string
 *   reqLike?: { protocol?: string; host?: string } | null
 *   env?: NodeJS.ProcessEnv
 * }} input
 */
export function buildStaffAppOpenUrl(input) {
  const target = input?.target ?? {}
  const type = String(target.type ?? '').trim().toLowerCase()
  if (!type) return ''

  const origin =
    String(input?.origin ?? '').trim() ||
    resolveStaffPublicOrigin(input?.reqLike ?? null, input?.env ?? process.env)
  if (!origin) return ''

  const params = new URLSearchParams()
  params.set('target', type)
  if (target.customerId != null) params.set('customerId', String(target.customerId))
  if (target.claimRequestId != null) params.set('claimId', String(target.claimRequestId))
  if (target.newsletterId != null) params.set('newsletterId', String(target.newsletterId))
  if (target.newsChannel != null) params.set('channel', String(target.newsChannel))
  if (target.boardSlug != null) params.set('boardSlug', String(target.boardSlug))

  const webFallback = buildWebFallbackRoute(target)
  if (webFallback) params.set('fallback', webFallback)

  const nativeDeepLink =
    type === NOTIFICATION_TARGET_TYPES.CUSTOMER
      ? buildNativeCustomerDeepLink({ customerId: target.customerId, env: input?.env })
      : ''
  if (nativeDeepLink) params.set('native', nativeDeepLink)

  return forceHttpsPublicUrl(`${origin}/staff-app/open?${params.toString()}`)
}

/**
 * @param {{
 *   type: string
 *   notificationId?: number | string | null
 *   target: { type: string; customerId?: number | string | null; claimRequestId?: number | string | null; newsletterId?: string | null; newsChannel?: string | null; boardSlug?: string | null }
 *   dedupeKey?: string
 * }} input
 */
export function buildPushDataPayload(input) {
  const pushType = String(input?.type ?? '').trim()
  const target = input?.target ?? {}
  const route = buildNativeInternalRoute(target)
  const data = {
    type: pushType,
    targetType: String(target.type ?? ''),
    route,
  }
  const notificationId = input?.notificationId
  if (notificationId != null && String(notificationId).trim()) {
    data.notificationId = String(notificationId)
  }
  const customerId = Number(target.customerId)
  if (Number.isInteger(customerId) && customerId > 0) {
    data.customerId = String(customerId)
  }
  const claimRequestId = Number(target.claimRequestId)
  if (Number.isInteger(claimRequestId) && claimRequestId > 0) {
    data.claimId = String(claimRequestId)
  }
  const newsletterId = String(target.newsletterId ?? '').trim()
  if (newsletterId) {
    data.newsletterId = newsletterId
  }
  const channel = String(target.newsChannel ?? '').trim()
  if (channel) {
    data.channel = channel
  }
  const boardSlug = String(target.boardSlug ?? '').trim()
  if (boardSlug) {
    data.boardSlug = boardSlug
  }
  if (input?.dedupeKey) {
    data.dedupeKey = String(input.dedupeKey)
  }
  return data
}
