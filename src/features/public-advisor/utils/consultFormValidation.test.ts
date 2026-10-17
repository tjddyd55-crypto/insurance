import { describe, expect, it } from 'vitest'

import { ApiError, resolveApiErrorMessage } from '../../../lib/apiClient'
import { formatKrPhoneInputLive } from './formatKrPhoneNumber'
import {
  CONSULT_PHONE_INVALID_MESSAGE,
  CONSULT_SUBMIT_GENERIC_MESSAGE,
  classifyConsultSubmitError,
  consultPhoneFieldError,
  isConsultDraftValid,
  visibleConsultFieldErrors,
} from './consultFormValidation'

const validDraft = {
  name: 'QA테스트',
  phone: '010-2222-1511',
  message: '라운드 검증 문의',
  contactChannel: 'phone',
  privacyConsent: true,
}

describe('consult phone SSOT', () => {
  it('accepts a formatted mobile and raw digits after the live formatter', () => {
    expect(formatKrPhoneInputLive('01022221511')).toBe('010-2222-1511')
    expect(consultPhoneFieldError('010-2222-1511')).toBeNull()
    expect(consultPhoneFieldError(formatKrPhoneInputLive('01022221511'))).toBeNull()
  })

  it('rejects short and non-mobile numbers with the consult copy', () => {
    expect(consultPhoneFieldError('444-4')).toBe(CONSULT_PHONE_INVALID_MESSAGE)
    expect(consultPhoneFieldError('010-12')).toBe(CONSULT_PHONE_INVALID_MESSAGE)
  })
})

describe('visibleConsultFieldErrors', () => {
  it('keeps an empty draft quiet and invalid', () => {
    const empty = { name: '', phone: '', message: '', contactChannel: 'phone', privacyConsent: false }
    expect(visibleConsultFieldErrors(empty)).toEqual({})
    expect(isConsultDraftValid(empty)).toBe(false)
  })

  it('shows a phone error without requiring the other fields', () => {
    const draft = { ...validDraft, phone: '444-4', privacyConsent: false, name: '', message: '' }
    expect(visibleConsultFieldErrors(draft).phone).toBe(CONSULT_PHONE_INVALID_MESSAGE)
    expect(isConsultDraftValid(draft)).toBe(false)
  })

  it('shows name, message, and privacy next to the field that failed', () => {
    expect(visibleConsultFieldErrors({ ...validDraft, name: '김' }).name).toMatch(/2자/)
    expect(visibleConsultFieldErrors({ ...validDraft, message: '짧음' }).message).toMatch(/5자/)
    expect(visibleConsultFieldErrors({ ...validDraft, privacyConsent: false }).privacy).toMatch(/동의/)
    expect(isConsultDraftValid(validDraft)).toBe(true)
  })
})

describe('classifyConsultSubmitError', () => {
  it('keeps server messages for 400, 403, 404, and 429', () => {
    expect(classifyConsultSubmitError(new ApiError('올바른 휴대폰 번호를 입력해 주세요.', 400))).toEqual({
      kind: 'business',
      message: '올바른 휴대폰 번호를 입력해 주세요.',
    })
    expect(classifyConsultSubmitError(new ApiError('상담 신청을 받지 않는 프로필입니다.', 403)).kind).toBe('business')
    expect(classifyConsultSubmitError(new ApiError('프로필을 찾을 수 없습니다.', 404)).message).toBe(
      '프로필을 찾을 수 없습니다.',
    )
    expect(classifyConsultSubmitError(new ApiError('잠시 후 다시 시도해 주세요.', 429)).kind).toBe('business')
  })

  it('keeps a 500 message and uses the consult generic when the server sent none', () => {
    expect(classifyConsultSubmitError(new ApiError('저장에 실패했습니다.', 500))).toEqual({
      kind: 'system',
      message: '저장에 실패했습니다.',
    })
    expect(classifyConsultSubmitError(new ApiError(resolveApiErrorMessage(500, {}), 500)).message).toBe(
      CONSULT_SUBMIT_GENERIC_MESSAGE,
    )
    expect(classifyConsultSubmitError(new ApiError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 0)).kind).toBe(
      'system',
    )
  })
})

describe('resolveApiErrorMessage', () => {
  it('prefers the server message over the generic fallback', () => {
    expect(resolveApiErrorMessage(400, { message: '올바른 휴대폰 번호를 입력해 주세요.' })).toBe(
      '올바른 휴대폰 번호를 입력해 주세요.',
    )
    expect(resolveApiErrorMessage(429, { message: '잠시 후 다시 시도해 주세요.' })).toBe('잠시 후 다시 시도해 주세요.')
    expect(resolveApiErrorMessage(500, {})).toBe('요청 처리에 실패했습니다.')
    expect(resolveApiErrorMessage(429, {})).toBe('요청이 많습니다. 잠시 후 다시 시도해 주세요.')
  })
})
