import { describe, expect, it } from 'vitest'
import {
  detectGaExcelHeaderRow,
  normalizeGaHeaderName,
  parseGaExcelMatrix,
} from './gaCustomerExcelParse'

const TITLE_ROW_SAMPLE = [
  ['[ 보유계약 LIST ]'],
  [
    '증권번호',
    '차량번호',
    '차명',
    '원수사',
    '상품명',
    '상품구분',
    '상품분류',
    '모집인',
    '계약일자',
    '계약자',
    '피보험자',
    '보험료',
    '갱신후보험료',
    '원수사환산',
    '영진환산',
    '월초대비환산율',
    '유지환산',
    '2차환산',
    '3차환산',
    '수수료',
    '납입방법',
    '납입기간',
    '보험기간',
    '개시일자',
    '만기일자',
    '이체일자',
    '상태',
    '소멸일자',
    '납회',
    '납월',
  ],
  [
    '209061090',
    '',
    '',
    '한화생명',
    'H종신(일반)(5년납)',
    '생보장기',
    '종신',
    '박성용',
    '20251110',
    '김은호',
    '김은호',
    '500000',
    '500000',
    '275000',
    '352000',
    '70.4',
    '352000',
    '0',
    '0',
    '704000',
    '월납',
    '5년납',
    '종신',
    '20251110',
    '20301110',
    '20251125',
    '유지',
    '',
    '1',
    '202606',
  ],
]

const HEADER_FIRST_ROW_SAMPLE = [
  ['원수사', '상품명', '계약일자', '계약자', '피보험자', '보험료', '상태', '납월'],
  ['한화생명', '상품명', '20251110', '김은호', '김은호', '500000', '유지', '202606'],
]

describe('detectGaExcelHeaderRow', () => {
  it('제목 행 다음 줄을 헤더로 감지한다', () => {
    expect(detectGaExcelHeaderRow(TITLE_ROW_SAMPLE)).toBe(1)
  })

  it('1행부터 헤더인 기존 파일은 0행을 헤더로 유지한다', () => {
    expect(detectGaExcelHeaderRow(HEADER_FIRST_ROW_SAMPLE)).toBe(0)
  })
})

describe('parseGaExcelMatrix', () => {
  it('제목 행을 skip하고 실제 헤더·데이터를 파싱한다', () => {
    const parsed = parseGaExcelMatrix(TITLE_ROW_SAMPLE)
    expect(parsed.headerRowIndex).toBe(1)
    expect(parsed.columns.map((column) => column.header)).toEqual(
      expect.arrayContaining(['원수사', '상품명', '계약일자', '보험료', '납월']),
    )
    expect(parsed.dataRows[0]?.cells.col_0).toBe('209061090')
    expect(parsed.dataRows[0]?.cells.col_3).toBe('한화생명')
    expect(parsed.dataRows).toHaveLength(1)
  })

  it('1행 헤더 파일도 기존처럼 파싱한다', () => {
    const parsed = parseGaExcelMatrix(HEADER_FIRST_ROW_SAMPLE)
    expect(parsed.headerRowIndex).toBe(0)
    expect(parsed.columns.map((column) => column.header)).toEqual([
      '원수사',
      '상품명',
      '계약일자',
      '계약자',
      '피보험자',
      '보험료',
      '상태',
      '납월',
    ])
    expect(parsed.dataRows[0]?.cells.col_0).toBe('한화생명')
    expect(parsed.dataRows).toHaveLength(1)
  })
})

describe('normalizeGaHeaderName', () => {
  it('공백을 제거해 헤더명을 비교 가능하게 만든다', () => {
    expect(normalizeGaHeaderName(' 계약 일자 ')).toBe('계약일자')
  })
})
