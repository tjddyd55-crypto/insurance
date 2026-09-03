import { getUserNotificationSettings } from '../../services/userNotificationSettingsService.js'
import { enqueuePushOutbox } from './pushOutboxService.js'
import { shouldDeliverAppPush } from './pushPreferenceGate.js'

export const CUSTOMER_CREATED_EVENT = 'CUSTOMER_CREATED'

/**
 * @param {{ customerName?: string | null }} input
 */
export function buildCustomerCreatedPushCopy(input) {
  const name = String(input.customerName ?? '').trim()
  return {
    title: '신규 고객 등록',
    body: name ? `${name} 고객이 등록되었습니다.` : '신규 고객이 등록되었습니다.',
  }
}

/**
 * @param {{ customerName?: string | null }} input
 */
export function buildCustomerCreatedInternalMessage(input) {
  const name = String(input.customerName ?? '').trim() || '고객'
  return `${name} 고객이 등록되었습니다.`
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   notificationId: number | null
 *   recipientUserId: string
 *   gaId: number
 *   customerId: number
 *   customerName?: string | null
 * }} input
 */
export async function enqueueCustomerCreatedPush(db, input) {
  const recipientUserId = String(input.recipientUserId ?? '').trim()
  const customerId = Number(input.customerId)
  const gaId = Number(input.gaId)
  if (!recipientUserId || !Number.isInteger(customerId) || customerId < 1) {
    return null
  }
  if (!Number.isInteger(gaId) || gaId < 1) {
    return null
  }

  const settings = await getUserNotificationSettings(db, recipientUserId, gaId).catch(() => null)
  if (!shouldDeliverAppPush(settings, 'new_customer')) {
    return null
  }

  const { title, body } = buildCustomerCreatedPushCopy({ customerName: input.customerName })
  const route = `/customers/${customerId}`
  const dedupeKey = `customer-created:${customerId}:${recipientUserId}`
  const notificationId =
    input.notificationId != null && Number.isInteger(Number(input.notificationId))
      ? Number(input.notificationId)
      : null

  return enqueuePushOutbox(db, {
    gaId,
    notificationId,
    recipientUserId,
    eventType: CUSTOMER_CREATED_EVENT,
    dedupeKey,
    payload: {
      title,
      body,
      data: {
        type: CUSTOMER_CREATED_EVENT,
        customerId: String(customerId),
        notificationId: notificationId != null ? String(notificationId) : '',
        route,
        dedupeKey,
      },
    },
  })
}
