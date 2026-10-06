import { describe, expect, it } from 'vitest'
import { buildKakaoCustomerCopyText } from './customerText'

describe('buildKakaoCustomerCopyText', () => {
  it('includes hyphenated phone like UI display', () => {
    const text = buildKakaoCustomerCopyText({
      name: '테스트',
      phone: '01012345678',
    })
    expect(text).toContain('핸드폰번호: 010-1234-5678')
  })
})
