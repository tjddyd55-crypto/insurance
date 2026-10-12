import { describe, expect, it } from 'vitest'
import { customerMatchesNamePhoneKeyword as m } from './customerKeywordMatch'

const kim = { name: '김지웅', phone: '010-1234-5678' }
const tae = { name: '김철수', phone: '010-9999-0000' }

describe('customerMatchesNamePhoneKeyword', () => {
  it('이름 부분일치 (공백/대소문자 무시)', () => {
    for (const q of ['김', '김지', '지웅', '김지웅', '김 지웅']) expect(m(kim, q)).toBe(true)
    expect(m({ name: 'John Kim', phone: '' }, 'johnkim')).toBe(true)
    expect(m(kim, '박')).toBe(false)
  })
  it('전화번호 숫자 정규화', () => {
    for (const q of ['010', '0101234', '010-1234', '1234', '5678', '010 1234 5678']) expect(m(kim, q)).toBe(true)
    expect(m(kim, '4321')).toBe(false)
  })
  it('숫자 없는 검색어는 전화번호 비교 안 함 (전원 매칭 버그 방지)', () => {
    expect(m(tae, '태')).toBe(false)
  })
  it('고객코드/주소/메모는 검색 대상 아님', () => {
    const c = { name: '홍길동', phone: '', customerCode: 'C-777', address: '태안', memo: 'vip' } as never
    expect(m(c, 'C-777')).toBe(false)
    expect(m(c, '777')).toBe(false)
    expect(m(c, '태안')).toBe(false)
    expect(m(c, 'vip')).toBe(false)
  })
})
