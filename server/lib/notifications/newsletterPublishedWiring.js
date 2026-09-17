import { safeQuery } from '../../utils/dbSafeQuery.js'
import { createNewsletterPublishedNotification } from '../../services/userNotificationService.js'
import { enqueueNewsletterPublishedPush } from '../push/newsletterPublishedPush.js'

/**
 * GA 내 소식지 열람 가능한 활성 CRM 사용자.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} gaId
 */
export async function listNewsletterNotificationRecipients(db, gaId) {
  const resolvedGaId = Number(gaId)
  if (!Number.isInteger(resolvedGaId) || resolvedGaId < 1) {
    return []
  }
  const r = await safeQuery(
    db,
    `
    SELECT id
    FROM users
    WHERE ga_id = $1
      AND is_deleted = false
      AND COALESCE(LOWER(status), 'active') NOT IN ('disabled', 'blocked', 'deleted')
      AND COALESCE(LOWER(role), '') NOT IN ('insurer_manager', 'loss_adjuster')
    ORDER BY id ASC
    `,
    [resolvedGaId],
  )
  return r.rows.map((row) => String(row.id)).filter(Boolean)
}

/**
 * 소식지 게시 완료 후 in-app 알림 + push enqueue.
 * 업무 저장은 이미 완료된 상태에서 호출한다. throw 하지 않는다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   gaId: number
 *   newsletterId: string
 *   newsChannel?: string | null
 *   boardSlug?: string | null
 *   title?: string | null
 *   publisherUserId?: string | null
 * }} input
 */
export async function scheduleNewsletterPublishedNotifications(db, input) {
  const gaId = Number(input.gaId)
  const newsletterId = String(input.newsletterId ?? '').trim()
  if (!Number.isInteger(gaId) || gaId < 1 || !newsletterId) {
    return { recipients: 0, notifications: 0, pushes: 0 }
  }

  const publisherUserId = String(input.publisherUserId ?? '').trim()
  const recipients = (await listNewsletterNotificationRecipients(db, gaId)).filter(
    (userId) => userId !== publisherUserId,
  )

  let notifications = 0
  let pushes = 0
  for (const recipientUserId of recipients) {
    try {
      const notificationId = await createNewsletterPublishedNotification(db, safeQuery, {
        recipientUserId,
        gaId,
        newsletterId,
        title: input.title,
      })
      if (notificationId) notifications += 1
      const pushId = await enqueueNewsletterPublishedPush(db, {
        notificationId,
        recipientUserId,
        gaId,
        newsletterId,
        newsChannel: input.newsChannel,
        boardSlug: input.boardSlug,
        title: input.title,
      })
      if (pushId) pushes += 1
    } catch (error) {
      console.error(
        '[newsletter-published-notification] enqueue failed',
        {
          newsletterId,
          recipientUserId,
          message: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }

  return { recipients: recipients.length, notifications, pushes }
}
