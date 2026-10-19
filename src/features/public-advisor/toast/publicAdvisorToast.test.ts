import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PUBLIC_ADVISOR_TOAST_MS,
  getPublicAdvisorToast,
  resetPublicAdvisorToast,
  showPublicAdvisorToast,
} from './publicAdvisorToast'

afterEach(() => {
  resetPublicAdvisorToast()
  vi.useRealTimers()
})

describe('publicAdvisorToast', () => {
  it('shows one message and clears it after the shared timeout', () => {
    vi.useFakeTimers()
    showPublicAdvisorToast('복사되었습니다.')
    expect(getPublicAdvisorToast()).toBe('복사되었습니다.')
    showPublicAdvisorToast('상담 신청이 접수되었습니다.')
    expect(getPublicAdvisorToast()).toBe('상담 신청이 접수되었습니다.')
    vi.advanceTimersByTime(PUBLIC_ADVISOR_TOAST_MS - 1)
    expect(getPublicAdvisorToast()).toBe('상담 신청이 접수되었습니다.')
    vi.advanceTimersByTime(1)
    expect(getPublicAdvisorToast()).toBe('')
  })
})
