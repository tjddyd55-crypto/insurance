import { buildInternalCustomerClaimRoute } from '../internalCustomerClaimRoute.js'
import { enqueuePushOutbox } from './pushOutboxService.js'

export const CLAIM_SUBMITTED_EVENT = 'CUSTOMER_CLAIM_SUBMITTED'

/**
 * @param {{
 *   customerName?: string | null
 *   hasFiles?: boolean
 * }} input
 */
export function buildClaimSubmittedPushCopy(input) {
  const name = String(input.customerName ?? '').trim()
  const hasFiles = Boolean(input.hasFiles)
  const title = '새로운 보험 청구가 접수되었습니다.'
  let body = '고객앱에서 새로운 청구가 접수되었습니다.'
  if (name) {
    body = hasFiles
      ? `${name} 고객이 청구 파일을 등록했습니다.`
      : `${name} 고객이 청구 내용을 등록했습니다.`
  }
  return { title, body }
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

  const { title, body } = buildClaimSubmittedPushCopy({
    customerName: input.customerName,
    hasFiles: input.hasFiles,
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
        type: CLAIM_SUBMITTED_EVENT,
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
