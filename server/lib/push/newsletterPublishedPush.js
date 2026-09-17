import {
  NOTIFICATION_TARGET_TYPES,
  PUSH_EVENT_TYPES,
  buildPushDataPayload,
} from '../notifications/notificationTarget.js'
import { getUserNotificationSettings } from '../../services/userNotificationSettingsService.js'
import { enqueuePushOutbox } from './pushOutboxService.js'
import { shouldDeliverAppPush } from './pushPreferenceGate.js'

export const NEWSLETTER_PUBLISHED_EVENT = PUSH_EVENT_TYPES.NEWSLETTER_PUBLISHED

/**
 * @param {{ title?: string | null }} [input]
 */
export function buildNewsletterPublishedPushCopy(input = {}) {
  const title = String(input.title ?? '').trim()
  return {
    title: '새 소식지',
    body: title ? `${title}` : '새로운 소식지가 등록되었습니다.',
  }
}

export function buildNewsletterPublishedInternalMessage(input = {}) {
  const title = String(input.title ?? '').trim()
  return title ? `새 소식지: ${title}` : '새로운 소식지가 등록되었습니다.'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   notificationId: number | null
 *   recipientUserId: string
 *   gaId: number
 *   newsletterId: string
 *   newsChannel?: string | null
 *   boardSlug?: string | null
 *   title?: string | null
 * }} input
 */
export async function enqueueNewsletterPublishedPush(db, input) {
  const recipientUserId = String(input.recipientUserId ?? '').trim()
  const newsletterId = String(input.newsletterId ?? '').trim()
  const gaId = Number(input.gaId)
  if (!recipientUserId || !newsletterId) {
    return null
  }
  if (!Number.isInteger(gaId) || gaId < 1) {
    return null
  }

  const settings = await getUserNotificationSettings(db, recipientUserId, gaId).catch(() => null)
  if (!shouldDeliverAppPush(settings, 'work')) {
    return null
  }

  const { title, body } = buildNewsletterPublishedPushCopy({ title: input.title })
  const dedupeKey = `newsletter-published:${newsletterId}:${recipientUserId}`
  const notificationId =
    input.notificationId != null && Number.isInteger(Number(input.notificationId))
      ? Number(input.notificationId)
      : null
  const data = buildPushDataPayload({
    type: NEWSLETTER_PUBLISHED_EVENT,
    notificationId,
    dedupeKey,
    target: {
      type: NOTIFICATION_TARGET_TYPES.NEWSLETTER,
      newsletterId,
      newsChannel: input.newsChannel,
      boardSlug: input.boardSlug,
    },
  })

  return enqueuePushOutbox(db, {
    gaId,
    notificationId,
    recipientUserId,
    eventType: NEWSLETTER_PUBLISHED_EVENT,
    dedupeKey,
    payload: {
      title,
      body,
      data,
    },
  })
}
