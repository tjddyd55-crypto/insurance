import { ApiError } from '../../../lib/apiClient'
import { normalizeKrMobile, validateKrMobileDigits } from '../../../lib/phoneNormalize'

export const CONSULT_PHONE_INVALID_MESSAGE = '올바른 휴대폰 번호를 입력해 주세요.'
export const CONSULT_PHONE_REQUIRED_MESSAGE = '휴대폰 번호를 입력해 주세요.'
export const CONSULT_NAME_MESSAGE = '이름을 2자 이상 입력해 주세요.'
export const CONSULT_MESSAGE_MESSAGE = '문의 내용을 5자 이상 입력해 주세요.'
export const CONSULT_CHANNEL_MESSAGE = '연락 희망 방식을 선택해 주세요.'
export const CONSULT_PRIVACY_MESSAGE = '개인정보 제공 동의가 필요합니다.'
export const CONSULT_SUBMIT_GENERIC_MESSAGE = '상담 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.'

const API_GENERIC_MESSAGE = '요청 처리에 실패했습니다.'
const API_NETWORK_MESSAGE = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
const CONTACT_CHANNELS = ['phone', 'sms', 'kakao'] as const

export type ConsultContactChannel = (typeof CONTACT_CHANNELS)[number]

export type ConsultDraft = {
  name: string
  phone: string
  message: string
  contactChannel: string
  privacyConsent: boolean
}

export type ConsultFieldErrors = {
  name?: string
  phone?: string
  message?: string
  contactChannel?: string
  privacy?: string
}

export type ConsultSubmitError = {
  kind: 'business' | 'system'
  message: string
}

/** 서버 `validateKrMobileDigits`와 같은 숫자 규칙. 화면 문구만 상담 폼용으로 맞춘다. */
export function consultPhoneFieldError(raw: string): string | null {
  const digits = normalizeKrMobile(raw)
  if (!digits) return CONSULT_PHONE_REQUIRED_MESSAGE
  if (validateKrMobileDigits(digits)) return CONSULT_PHONE_INVALID_MESSAGE
  return null
}

export function consultFieldErrors(draft: ConsultDraft): ConsultFieldErrors {
  const errors: ConsultFieldErrors = {}
  if (draft.name.trim().length < 2) errors.name = CONSULT_NAME_MESSAGE
  const phoneError = consultPhoneFieldError(draft.phone)
  if (phoneError) errors.phone = phoneError
  if (draft.message.trim().length < 5) errors.message = CONSULT_MESSAGE_MESSAGE
  if (!CONTACT_CHANNELS.includes(draft.contactChannel as ConsultContactChannel)) {
    errors.contactChannel = CONSULT_CHANNEL_MESSAGE
  }
  if (!draft.privacyConsent) errors.privacy = CONSULT_PRIVACY_MESSAGE
  return errors
}

export function isConsultDraftValid(draft: ConsultDraft): boolean {
  return Object.keys(consultFieldErrors(draft)).length === 0
}

/**
 * 빈 필드는 조용히 두고, 값을 넣었는데 규칙에 안 맞으면 그 필드 아래에 바로 보여 준다.
 * 나머지 항목이 모두 유효하고 동의만 빠졌을 때 동의 행 오류를 보여 준다.
 */
export function visibleConsultFieldErrors(draft: ConsultDraft): ConsultFieldErrors {
  const all = consultFieldErrors(draft)
  const visible: ConsultFieldErrors = {}
  if (draft.name.trim().length > 0 && all.name) visible.name = all.name
  if (normalizeKrMobile(draft.phone).length > 0 && all.phone) visible.phone = all.phone
  if (draft.message.trim().length > 0 && all.message) visible.message = all.message
  if (all.contactChannel) visible.contactChannel = all.contactChannel
  const readyExceptPrivacy = !all.name && !all.phone && !all.message && !all.contactChannel
  if (all.privacy && readyExceptPrivacy) visible.privacy = all.privacy
  return visible
}

export function classifyConsultSubmitError(error: unknown): ConsultSubmitError {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 429) {
      return { kind: 'business', message: error.message }
    }
    const unnamed =
      !error.message || error.message === API_GENERIC_MESSAGE || error.message === API_NETWORK_MESSAGE
    return {
      kind: 'system',
      message: unnamed ? CONSULT_SUBMIT_GENERIC_MESSAGE : error.message,
    }
  }
  return { kind: 'system', message: CONSULT_SUBMIT_GENERIC_MESSAGE }
}
