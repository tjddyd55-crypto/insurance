import { describe, expect, it } from 'vitest'
import { claimRequestMessageText, formatClaimRequesterLine } from './claimRequestDetailFormatters'

describe('formatClaimRequesterLine', () => {
  it('joins name birth and phone', () => {
    expect(
      formatClaimRequesterLine({
        requesterName: '이진선',
        requesterBirthDate: '840413',
        requesterPhone: '01045321660',
      }),
    ).toBe('이진선 · 840413 · 010 4532 1660')
  })

  it('returns null when name missing', () => {
    expect(
      formatClaimRequesterLine({
        requesterName: '',
        requesterBirthDate: '840413',
        requesterPhone: '01045321660',
      }),
    ).toBeNull()
  })
})

describe('claimRequestMessageText', () => {
  it('prefers memo over title', () => {
    expect(claimRequestMessageText({ memo: '치질입니다', title: '제목' })).toBe('치질입니다')
  })

  it('falls back to title', () => {
    expect(claimRequestMessageText({ memo: '', title: '제목' })).toBe('제목')
  })
})
