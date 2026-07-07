import { describe, expect, it } from 'vitest'
import { buildAddResultMessage, summarizeSelectedRecipients } from './smsRecipientEligibility'
import { mergeCustomerIdsForGroup, mergeSmsRecipientSelections } from './smsRecipientSelection'

describe('smsRecipientSelection', () => {
  it('merges without duplicate customer ids', () => {
    const base = {
      customerId: 10,
      name: 'Kim',
      gender: 'male' as const,
      genderLabel: '남자',
      birthDate: '1963-03-10',
      phone: '01011111111',
      phoneDisplay: '010-1111-1111',
      insuranceAge: 62,
      sangnyeongDday: 18,
      sangnyeongLabel: '상령일 D-18',
      canSend: true,
      blockedReason: null,
    }
    const { recipients, result } = mergeSmsRecipientSelections(
      [base],
      [base, { ...base, customerId: 11, phone: '01022222222', phoneDisplay: '010-2222-2222' }],
    )
    expect(recipients).toHaveLength(2)
    expect(result.addedCount).toBe(1)
    expect(result.skipped.already_added).toBe(1)
  })

  it('merges customer ids for group without duplicates', () => {
    const merged = mergeCustomerIdsForGroup([1, 2, 3], [3, 4, 5])
    expect(merged.mergedIds).toEqual([1, 2, 3, 4, 5])
    expect(merged.addedCount).toBe(2)
    expect(merged.alreadyInGroup).toBe(1)
  })
})

describe('smsRecipientEligibility', () => {
  it('summarizes sendable and excluded counts', () => {
    const summary = summarizeSelectedRecipients([
      {
        customerId: 1,
        name: 'A',
        gender: 'male',
        genderLabel: '남자',
        birthDate: null,
        phone: '010',
        phoneDisplay: '010',
        insuranceAge: 40,
        sangnyeongDday: 1,
        sangnyeongLabel: 'D-1',
        canSend: true,
        blockedReason: null,
      },
      {
        customerId: 2,
        name: 'B',
        gender: 'female',
        genderLabel: '여자',
        birthDate: null,
        phone: null,
        phoneDisplay: '-',
        insuranceAge: 50,
        sangnyeongDday: null,
        sangnyeongLabel: '-',
        canSend: false,
        blockedReason: 'no_phone',
      },
    ])
    expect(summary.total).toBe(2)
    expect(summary.sendable).toBe(1)
    expect(summary.excluded).toBe(1)
  })

  it('builds add result message', () => {
    expect(buildAddResultMessage(3, { already_added: 2, duplicate_phone: 1 })).toContain('3명이 추가')
  })
})
