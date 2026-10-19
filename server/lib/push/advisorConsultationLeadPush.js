import {
  NOTIFICATION_TARGET_TYPES,
  PUSH_EVENT_TYPES,
  buildPushDataPayload,
  normalizeConsultationLeadId,
} from '../notifications/notificationTarget.js'
import { buildAdvisorConsultationLeadNotificationMessage } from '../../notifications/userNotificationTypes.js'
import { getUserNotificationSettings } from '../../services/userNotificationSettingsService.js'
import { enqueuePushOutbox } from './pushOutboxService.js'
import { shouldDeliverAppPush } from './pushPreferenceGate.js'

export const ADVISOR_CONSULTATION_LEAD_EVENT = PUSH_EVENT_TYPES.ADVISOR_CONSULTATION_LEAD

/**
 * 푸시 문구. 알림함 문구(buildAdvisorConsultationLeadNotificationMessage)와 같은 본문을 쓴다.
 * 연락처·문의 내용은 싣지 않는다.
 * @param {{ visitorName?: string | null }} input
 */
export function buildAdvisorConsultationLeadPushCopy(input) {
  return {
    title: '새 상담 신청',
    body: buildAdvisorConsultationLeadNotificationMessage(input?.visitorName),
  }
}

/**
 * 모바일 명함 상담 신청 → 기존 push outbox(FCM) 에 1건 넣는다.
 * 알림 설정(앱 푸시 · 업무 알림)을 따른다. 실패는 호출부에서 삼킨다(상담 신청은 그대로 남는다).
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   notificationId: number | null
 *   recipientUserId: string
 *   gaId: number
 *   leadId: string
 *   visitorName?: string | null
 * }} input
 * @param {{ getSettings?: typeof getUserNotificationSettings, enqueue?: typeof enqueuePushOutbox }} [deps]
 */
export async function enqueueAdvisorConsultationLeadPush(db, input, deps = {}) {
  const getSettings = deps.getSettings ?? getUserNotificationSettings
  const enqueue = deps.enqueue ?? enqueuePushOutbox
  const recipientUserId = String(input?.recipientUserId ?? '').trim()
  const gaId = Number(input?.gaId)
  const leadId = normalizeConsultationLeadId(input?.leadId)
  if (!recipientUserId || !leadId || !Number.isInteger(gaId) || gaId < 1) {
    return null
  }

  const settings = await getSettings(db, recipientUserId, gaId).catch(() => null)
  if (!shouldDeliverAppPush(settings, 'work')) {
    return null
  }

  const notificationId =
    input.notificationId != null && Number.isInteger(Number(input.notificationId))
      ? Number(input.notificationId)
      : null
  const dedupeKey = `advisor-consultation-lead:${leadId}:${recipientUserId}`
  const data = buildPushDataPayload({
    type: ADVISOR_CONSULTATION_LEAD_EVENT,
    notificationId,
    dedupeKey,
    target: { type: NOTIFICATION_TARGET_TYPES.CONSULTATION_LEAD, leadId },
  })

  return enqueue(db, {
    gaId,
    notificationId,
    recipientUserId,
    eventType: ADVISOR_CONSULTATION_LEAD_EVENT,
    dedupeKey,
    payload: { ...buildAdvisorConsultationLeadPushCopy({ visitorName: input.visitorName }), data },
  })
}

/**
 * 상담 신청 저장 뒤에 부르는 안전 래퍼. 어떤 실패도 던지지 않는다(상담 신청 응답·저장에 영향 없음).
 * @param {Parameters<typeof enqueueAdvisorConsultationLeadPush>[0]} db
 * @param {Parameters<typeof enqueueAdvisorConsultationLeadPush>[1]} input
 * @param {Parameters<typeof enqueueAdvisorConsultationLeadPush>[2]} [deps]
 */
export async function enqueueAdvisorConsultationLeadPushSafely(db, input, deps) {
  try {
    return await enqueueAdvisorConsultationLeadPush(db, input, deps)
  } catch (error) {
    const code = String(/** @type {any} */ (error)?.code ?? '') || 'unknown'
    console.warn('[advisor-consultation-lead-push] enqueue failed', { code })
    return null
  }
}
