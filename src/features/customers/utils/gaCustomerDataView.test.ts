import { describe, expect, it } from 'vitest'
import {
  formatGaCellByColumn,
  formatGaDate,
  formatGaPremium,
} from './gaCustomerDataView'

describe('formatGaDate', () => {
  it('8자리 숫자를 YYYY-MM-DD 로 변환한다', () => {
    expect(formatGaDate('20241122')).toBe('2024-11-22')
    expect(formatGaDate('20240628')).toBe('2024-06-28')
    expect(formatGaDate('20230201')).toBe('2023-02-01')
    expect(formatGaDate(20241122)).toBe('2024-11-22')
  })

  it('이미 YYYY-MM-DD 형식이면 그대로 표시한다', () => {
    expect(formatGaDate('2024-11-22')).toBe('2024-11-22')
  })

  it('빈 값·잘못된 값은 억지 변환하지 않고 원본/빈문자를 유지한다', () => {
    expect(formatGaDate('')).toBe('')
    expect(formatGaDate(null)).toBe('')
    expect(formatGaDate('2024')).toBe('2024')
    expect(formatGaDate('상시')).toBe('상시')
  })
})

describe('formatGaPremium', () => {
  it('숫자/숫자문자열에 천 단위 콤마를 적용한다', () => {
    expect(formatGaPremium('780')).toBe('780')
    expect(formatGaPremium('25440')).toBe('25,440')
    expect(formatGaPremium('100000')).toBe('100,000')
    expect(formatGaPremium('504600')).toBe('504,600')
    expect(formatGaPremium('1000000')).toBe('1,000,000')
    expect(formatGaPremium(508380)).toBe('508,380')
  })

  it('이미 콤마가 있어도 normalize 후 재적용한다', () => {
    expect(formatGaPremium('100,000')).toBe('100,000')
    expect(formatGaPremium('1,000,000')).toBe('1,000,000')
  })

  it('빈 값/문자 섞인 값은 원본/빈문자를 유지한다', () => {
    expect(formatGaPremium('')).toBe('')
    expect(formatGaPremium('무료')).toBe('무료')
    expect(formatGaPremium('10만원')).toBe('10만원')
  })
})

describe('formatGaCellByColumn', () => {
  it('계약일자/보험일자 컬럼은 날짜 포맷을 적용한다', () => {
    expect(formatGaCellByColumn('contractDate', '계약일자', '20241122')).toBe('2024-11-22')
    expect(formatGaCellByColumn('col1', '보험일자', '20230201')).toBe('2023-02-01')
  })

  it('보험료 컬럼은 콤마 포맷을 적용한다', () => {
    expect(formatGaCellByColumn('premium', '보험료', '504600')).toBe('504,600')
  })

  it('계약자(사람)는 날짜로 오인하지 않는다', () => {
    expect(formatGaCellByColumn('contractor', '계약자', '홍길동')).toBe('홍길동')
  })

  it('그 외 컬럼은 기존 표시 규칙(빈 값은 - 표시)을 따른다', () => {
    expect(formatGaCellByColumn('status', '상태', '')).toBe('-')
    expect(formatGaCellByColumn('product', '상품명', '무배당건강보험')).toBe('무배당건강보험')
  })
})
