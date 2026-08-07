import { describe, expect, it } from 'vitest'
import { normalizeCustomerMutationResponse } from './customersApi'

describe('normalizeCustomerMutationResponse', () => {
  it('rejects lenient success:false envelope', () => {
    expect(() =>
      normalizeCustomerMutationResponse({
        success: false,
        message: '서버 오류 (자동 복구됨)',
        data: [],
      }),
    ).toThrow(/서버 오류|고객을 저장하지 못했습니다/)
  })

  it('rejects empty array from safeApiResponse unwrap', () => {
    expect(() => normalizeCustomerMutationResponse([])).toThrow(/고객을 저장하지 못했습니다/)
  })

  it('accepts success envelope with customer data', () => {
    const data = normalizeCustomerMutationResponse({
      success: true,
      data: { id: 12, name: '테스트' },
    })
    expect(data).toEqual({ id: 12, name: '테스트' })
  })
})
