import { describe, expect, it } from 'vitest'
import { formatAddressForSave, parseAddressFromStored } from './addressSearchUtils'

describe('addressSearchUtils', () => {
  it('round-trips zip and base address through parseAddressFromStored', () => {
    const saved = formatAddressForSave({
      zonecode: '06234',
      baseAddress: '서울 강남구 테헤란로 123',
      detailAddress: '10층',
    })
    expect(saved).toBe('(06234) 서울 강남구 테헤란로 123 10층')
    const parsed = parseAddressFromStored(saved)
    expect(parsed.zonecode).toBe('06234')
    expect(parsed.baseAddress).toBe('서울 강남구 테헤란로 123 10층')
  })

  it('keeps plain address when zip prefix is absent', () => {
    expect(parseAddressFromStored('부산 해운대구')).toEqual({
      zonecode: '',
      baseAddress: '부산 해운대구',
      detailAddress: '',
    })
  })
})
