import { describe, expect, it } from 'vitest'
import {
  formatGaCellByColumn,
  formatGaDate,
  formatGaMonth,
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

describe('formatGaMonth', () => {
  it('6자리 숫자를 YYYY-MM 으로 변환한다', () => {
    expect(formatGaMonth('202605')).toBe('2026-05')
    expect(formatGaMonth('202405')).toBe('2024-05')
    expect(formatGaMonth('202402')).toBe('2024-02')
    expect(formatGaMonth(202605)).toBe('2026-05')
  })

  it('이미 YYYY-MM 형식이면 그대로 표시한다', () => {
    expect(formatGaMonth('2026-05')).toBe('2026-05')
  })

  it('빈 값·잘못된 값은 억지 변환하지 않고 원본/빈문자를 유지한다', () => {
    expect(formatGaMonth('')).toBe('')
    expect(formatGaMonth(null)).toBe('')
    expect(formatGaMonth('2026')).toBe('2026')
    expect(formatGaMonth('상시')).toBe('상시')
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

  it('납월 컬럼은 YYYY-MM 포맷을 적용한다', () => {
    expect(formatGaCellByColumn('paymentMonth', '납월', '202605')).toBe('2026-05')
    expect(formatGaCellByColumn('month', '납월', '202402')).toBe('2024-02')
  })

  it('납월 컬럼은 날짜(YYYYMMDD)로 오인해 8자리 처리하지 않는다', () => {
    // 6자리는 월로, 8자리 계약일자는 별도 컬럼에서 날짜로 처리됨을 구분 확인
    expect(formatGaCellByColumn('paymentMonth', '납월', '2026-05')).toBe('2026-05')
  })

  it('계약자(사람)는 날짜로 오인하지 않는다', () => {
    expect(formatGaCellByColumn('contractor', '계약자', '홍길동')).toBe('홍길동')
  })

  it('그 외 컬럼은 기존 표시 규칙(빈 값은 - 표시)을 따른다', () => {
    expect(formatGaCellByColumn('status', '상태', '')).toBe('-')
    expect(formatGaCellByColumn('product', '상품명', '무배당건강보험')).toBe('무배당건강보험')
  })

  it('선택한 날짜/월/금액 컬럼에도 헤더명 기준 포맷을 적용한다', () => {
    expect(formatGaCellByColumn('col_8', '계약일자', '20251110')).toBe('2025-11-10')
    expect(formatGaCellByColumn('col_23', '개시일자', '20251110')).toBe('2025-11-10')
    expect(formatGaCellByColumn('col_24', '만기일자', '20301110')).toBe('2030-11-10')
    expect(formatGaCellByColumn('col_25', '이체일자', '20251125')).toBe('2025-11-25')
    expect(formatGaCellByColumn('col_29', '납월', '202606')).toBe('2026-06')
    expect(formatGaCellByColumn('col_11', '보험료', '500000')).toBe('500,000')
    expect(formatGaCellByColumn('col_12', '갱신후보험료', '500000')).toBe('500,000')
    expect(formatGaCellByColumn('col_19', '수수료', '704000')).toBe('704,000')
    expect(formatGaCellByColumn('col_13', '원수사환산', '275000')).toBe('275,000')
    expect(formatGaCellByColumn('col_14', '영진환산', '352000')).toBe('352,000')
    expect(formatGaCellByColumn('col_16', '유지환산', '352000')).toBe('352,000')
    expect(formatGaCellByColumn('col_15', '월초대비환산율', '70.4')).toBe('70.4')
    expect(formatGaCellByColumn('col_0', '증권번호', '209061090')).toBe('209061090')
    expect(formatGaCellByColumn('col_21', '납입기간', '5년납')).toBe('5년납')
    expect(formatGaCellByColumn('col_22', '보험기간', '종신')).toBe('종신')
  })
})
