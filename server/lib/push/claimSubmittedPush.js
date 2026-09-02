import { buildInternalCustomerClaimRoute } from '../internalCustomerClaimRoute.js'
import { getUserNotificationSettings } from '../../services/userNotificationSettingsService.js'
import { enqueuePushOutbox } from './pushOutboxService.js'
import { resolveClaimPushEventKind, shouldDeliverAppPush } from './pushPreferenceGate.js'

export const CLAIM_SUBMITTED_EVENT = 'CUSTOMER_CLAIM_SUBMITTED'
export const CLAIM_CREATED_TYPE = 'CLAIM_CREATED'
export const CUSTOMER_FILE_CREATED_TYPE = 'CUSTOMER_FILE_CREATED'
export const CUSTOMER_INQUIRY_CREATED_TYPE = 'CUSTOMER_INQUIRY_CREATED'

/**
 * @param {{
 *   customerName?: string | null
 *   hasFiles?: boolean
 *   submissionKind?: string | null
 * }} input
 */
export function resolveClaimPushPayloadType(input) {
  if (input?.hasFiles) {
    return CUSTOMER_FILE_CREATED_TYPE
  }
  const kind = String(input?.submissionKind ?? '').trim().toUpperCase()
  if (kind.includes('INQUIRY')) {
    return CUSTOMER_INQUIRY_CREATED_TYPE
  }
  if (kind.includes('FILE')) {
    return CUSTOMER_FILE_CREATED_TYPE
  }
  return CLAIM_CREATED_TYPE
}

/**
 * @param {{
 *   customerName?: string | null
 *   hasFiles?: boolean
 *   submissionKind?: string | null
 * }} input
 */
export function buildClaimSubmittedPushCopy(input) {
  const name = String(input.customerName ?? '').trim()
  const payloadType = resolveClaimPushPayloadType(input)
  if (payloadType === CUSTOMER_FILE_CREATED_TYPE) {
    return {
      title: '고객 파일 등록',
      body: name ? `${name} 고객이 새 파일을 등록했습니다.` : '고객이 새 파일을 등록했습니다.',
    }
  }
  if (payloadType === CUSTOMER_INQUIRY_CREATED_TYPE) {
    return {
      title: '고객 문의 등록',
      body: name ? `${name} 고객의 새 문의가 도착했습니다.` : '고객의 새 문의가 도착했습니다.',
    }
  }
  return {
    title: '보험금 청구 요청',
    body: name
      ? `${name} 고객의 청구 요청이 도착했습니다.`
      : '고객의 청구 요청이 도착했습니다.',
  }
}

/**
 * @param {{
 *   customerName?: string | null
 *   hasFiles?: boolean
 * }} input
 */
export function buildClaimSubmittedInternalMessage(input) {
  const name = String(input.customerName ?? '').trim() || '고객'
  if (input.hasFiles) {
    return `${name} 고객이 청구 파일을 등록했습니다.`
  }
  return `${name} 고객이 청구 내용을 등록했습니다.`
}

/**
 * Enqueue Android push after internal notification is created.
 * Never throws to claim API callers — failures are logged by outbox worker.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   notificationId: number | null
 *   recipientUserId: string
 *   gaId: number
 *   customerId: number
 *   claimRequestId: number
 *   customerName?: string | null
 *   hasFiles?: boolean
 *   submissionKind?: string
 * }} input
 */
export async function enqueueClaimSubmittedPush(db, input) {
  const recipientUserId = String(input.recipientUserId ?? '').trim()
  const customerId = Number(input.customerId)
  const claimRequestId = Number(input.claimRequestId)
  const gaId = Number(input.gaId)
  if (!recipientUserId || !Number.isInteger(customerId) || customerId < 1) {
    return null
  }
  if (!Number.isInteger(claimRequestId) || claimRequestId < 1) {
    return null
  }
  if (!Number.isInteger(gaId) || gaId < 1) {
    return null
  }

  const settings = await getUserNotificationSettings(db, recipientUserId, gaId).catch(() => null)
  const eventKind = resolveClaimPushEventKind({
    hasFiles: input.hasFiles,
    submissionKind: input.submissionKind,
  })
  if (!shouldDeliverAppPush(settings, eventKind)) {
    return null
  }

  const { title, body } = buildClaimSubmittedPushCopy({
    customerName: input.customerName,
    hasFiles: input.hasFiles,
    submissionKind: input.submissionKind,
  })
  const route = buildInternalCustomerClaimRoute({
    customerId,
    claimRequestId,
  })
  const dedupeKey = `claim-submitted:${claimRequestId}:${recipientUserId}`
  const notificationId =
    input.notificationId != null && Number.isInteger(Number(input.notificationId))
      ? Number(input.notificationId)
      : null
  const payloadType = resolveClaimPushPayloadType({
    hasFiles: input.hasFiles,
    submissionKind: input.submissionKind,
  })

  return enqueuePushOutbox(db, {
    gaId,
    notificationId,
    recipientUserId,
    eventType: CLAIM_SUBMITTED_EVENT,
    dedupeKey,
    payload: {
      title,
      body,
      data: {
        type: payloadType,
        customerId: String(customerId),
        claimId: String(claimRequestId),
        route,
        notificationId: notificationId != null ? String(notificationId) : '',
        dedupeKey,
        submissionKind: String(input.submissionKind ?? 'CLAIM_CONTENT_ADDED'),
      },
    },
  })
}
