import type { SmsScheduledFormState } from '../types/smsScheduled.types'
import { computeNextRunAtPreview } from './smsScheduledSummary'

export type SmsScheduledValidationResult = {
  valid: boolean
  missing: string[]
}

export type SmsScheduledSaveContext = {
  form: SmsScheduledFormState
  /** Send 화면은 form 밖 selectedGroupId 를 쓸 수 있음 */
  recipientGroupId?: string
  sendableCount?: number | null
  groupMembersLoading?: boolean
  smsModuleEnabled?: boolean
}

export type SmsScheduledSaveValidation = {
  canSave: boolean
  disabledReason: string | null
  missing: string[]
}

const FIELD_LABELS = {
  name: '예약명',
  scheduleType: '예약 주기',
  sendTime: '발송 시간',
  recipientGroupId: '연락처 그룹',
  messageBody: '문자내용',
  sendDate: '발송 날짜',
  weekdays: '요일',
  monthDay: '매월 일자',
} as const

const DISABLED_REASON: Record<string, string> = {
  [FIELD_LABELS.name]: '예약명을 입력해 주세요.',
  [FIELD_LABELS.recipientGroupId]: '대상 그룹을 선택해 주세요.',
  [FIELD_LABELS.messageBody]: '메시지 내용을 입력해 주세요.',
  [FIELD_LABELS.sendDate]: '발송 날짜를 선택해 주세요.',
  [FIELD_LABELS.sendTime]: '발송 시간을 선택해 주세요.',
  [FIELD_LABELS.weekdays]: '요일을 선택해 주세요.',
  [FIELD_LABELS.monthDay]: '매월 일자를 선택해 주세요.',
  [FIELD_LABELS.scheduleType]: '예약 주기를 선택해 주세요.',
  sendable: '발송 가능한 대상이 없습니다.',
  loading: '그룹 구성원을 불러오는 중입니다.',
  future: '예약 발송 시간은 현재 시각 이후여야 합니다.',
  module: '문자 모듈이 비활성화되어 있습니다.',
}

function resolveRecipientGroupId(form: SmsScheduledFormState, override?: string): string {
  return (override ?? form.recipientGroupId).trim()
}

export function validateSmsScheduledForm(form: SmsScheduledFormState): SmsScheduledValidationResult {
  const missing: string[] = []

  if (!form.name.trim()) {
    missing.push(FIELD_LABELS.name)
  }
  if (!form.scheduleType) {
    missing.push(FIELD_LABELS.scheduleType)
  }
  if (!form.sendTime.trim()) {
    missing.push(FIELD_LABELS.sendTime)
  }
  if (!form.recipientGroupId.trim()) {
    missing.push(FIELD_LABELS.recipientGroupId)
  }
  if (!form.messageBody.trim()) {
    missing.push(FIELD_LABELS.messageBody)
  }

  if (form.scheduleType === 'once' && !form.sendDate.trim()) {
    missing.push(FIELD_LABELS.sendDate)
  }
  if (form.scheduleType === 'weekly' && form.weekdays.length === 0) {
    missing.push(FIELD_LABELS.weekdays)
  }
  if (form.scheduleType === 'monthly' && !(form.monthDay >= 1 && form.monthDay <= 31)) {
    missing.push(FIELD_LABELS.monthDay)
  }

  return { valid: missing.length === 0, missing }
}

export function validateSmsScheduledSave(context: SmsScheduledSaveContext): SmsScheduledSaveValidation {
  const { form, recipientGroupId, sendableCount, groupMembersLoading, smsModuleEnabled = true } = context
  const missing: string[] = []
  const groupId = resolveRecipientGroupId(form, recipientGroupId)

  if (smsModuleEnabled === false) {
    return { canSave: false, disabledReason: DISABLED_REASON.module, missing: [FIELD_LABELS.scheduleType] }
  }

  if (!form.name.trim()) {
    missing.push(FIELD_LABELS.name)
  }
  if (!form.scheduleType) {
    missing.push(FIELD_LABELS.scheduleType)
  }
  if (!form.sendTime.trim()) {
    missing.push(FIELD_LABELS.sendTime)
  }
  if (!groupId) {
    missing.push(FIELD_LABELS.recipientGroupId)
  }
  if (!form.messageBody.trim()) {
    missing.push(FIELD_LABELS.messageBody)
  }

  if (form.scheduleType === 'once' && !form.sendDate.trim()) {
    missing.push(FIELD_LABELS.sendDate)
  }
  if (form.scheduleType === 'weekly' && form.weekdays.length === 0) {
    missing.push(FIELD_LABELS.weekdays)
  }
  if (form.scheduleType === 'monthly' && !(form.monthDay >= 1 && form.monthDay <= 31)) {
    missing.push(FIELD_LABELS.monthDay)
  }

  if (missing.length > 0) {
    return {
      canSave: false,
      disabledReason: DISABLED_REASON[missing[0]] ?? `${missing[0]}을(를) 입력해 주세요.`,
      missing,
    }
  }

  if (groupMembersLoading) {
    return { canSave: false, disabledReason: DISABLED_REASON.loading, missing: [] }
  }

  if (typeof sendableCount === 'number' && sendableCount <= 0) {
    return { canSave: false, disabledReason: DISABLED_REASON.sendable, missing: [] }
  }

  const nextRunAt = computeNextRunAtPreview({ ...form, enabled: true })
  if (!nextRunAt) {
    return { canSave: false, disabledReason: DISABLED_REASON.future, missing: [] }
  }

  return { canSave: true, disabledReason: null, missing: [] }
}

export function isSmsScheduledFormValid(form: SmsScheduledFormState): boolean {
  return validateSmsScheduledForm(form).valid
}

export function isSmsScheduledSaveValid(context: SmsScheduledSaveContext): boolean {
  return validateSmsScheduledSave(context).canSave
}
