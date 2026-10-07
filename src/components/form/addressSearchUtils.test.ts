import { describe, expect, it } from 'vitest'

import { formatAddressForSave } from './addressSearchUtils'

describe('formatAddressForSave', () => {
  it('우편번호 + 기본 + 상세 모두 있으면 단일 공백으로 합쳐진다', () => {
    const out = formatAddressForSave({
      zonecode: '06236',
      baseAddress: '서울특별시 강남구 테헤란로 123',
      detailAddress: '101동 1234호',
    })
    expect(out).toBe('(06236) 서울특별시 강남구 테헤란로 123 101동 1234호')
  })

  it('우편번호만 빠지면 괄호 블록이 생략된다', () => {
    const out = formatAddressForSave({
      zonecode: '',
      baseAddress: '서울특별시 강남구 테헤란로 123',
      detailAddress: '101동',
    })
    expect(out).toBe('서울특별시 강남구 테헤란로 123 101동')
  })

  it('상세주소가 없으면 끝에 공백이 남지 않는다', () => {
    const out = formatAddressForSave({
      zonecode: '06236',
      baseAddress: '서울특별시 강남구 테헤란로 123',
      detailAddress: '',
    })
    expect(out).toBe('(06236) 서울특별시 강남구 테헤란로 123')
  })

  it('전부 공백만 있으면 빈 문자열을 반환한다', () => {
    const out = formatAddressForSave({
      zonecode: '   ',
      baseAddress: '  ',
      detailAddress: '',
    })
    expect(out).toBe('')
  })

  it('각 조각의 앞뒤 공백은 trim 된다', () => {
    const out = formatAddressForSave({
      zonecode: '  06236 ',
      baseAddress: '  서울특별시 강남구 테헤란로 123 ',
      detailAddress: ' 101동  ',
    })
    expect(out).toBe('(06236) 서울특별시 강남구 테헤란로 123 101동')
  })
})
