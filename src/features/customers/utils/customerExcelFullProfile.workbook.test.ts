import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_EXCEL_SHEET_BASIC,
  CUSTOMER_EXCEL_SHEET_CARS,
  CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS,
  CUSTOMER_EXCEL_SHEET_FIRE,
  CUSTOMER_EXCEL_SHEET_GUIDE,
  CUSTOMER_EXCEL_SHEET_SPECIAL_DATES,
} from '../config/customerExcelFullProfileSsot'
import { CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO } from '../config/customerExcelUploadColumnSsot'
import {
  buildCustomerExcelSampleSheetAoA,
  downloadCustomerUploadSampleXlsx,
  parseCustomerExcelWorkbook,
  prepareCustomerExcelImport,
} from './customerExcelUpload'

describe('customer excel full profile workbook', () => {
  it('sample aoa includes all basic SSOT headers and gender 남/여', () => {
    const aoa = buildCustomerExcelSampleSheetAoA()
    expect(aoa[0]).toEqual([...CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO])
    expect(aoa[0]?.includes('고객번호')).toBe(true)
    expect(aoa[0]?.includes('수술치료병력')).toBe(true)
    expect(aoa[0]?.includes('약복용병력')).toBe(true)
    expect(aoa[1]?.includes('남')).toBe(true)
    expect(aoa[2]?.includes('여')).toBe(true)
    expect(aoa[1]?.includes('C001')).toBe(true)
  })

  it('download workbook contains all required sheets', () => {
    const wb = XLSX.utils.book_new()
    const basicAoA = buildCustomerExcelSampleSheetAoA()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(basicAoA), CUSTOMER_EXCEL_SHEET_BASIC)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a']]), CUSTOMER_EXCEL_SHEET_CARS)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['b']]), CUSTOMER_EXCEL_SHEET_SPECIAL_DATES)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['c']]), CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['d']]), CUSTOMER_EXCEL_SHEET_FIRE)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['e']]), CUSTOMER_EXCEL_SHEET_GUIDE)
    expect(wb.SheetNames).toEqual([
      CUSTOMER_EXCEL_SHEET_BASIC,
      CUSTOMER_EXCEL_SHEET_CARS,
      CUSTOMER_EXCEL_SHEET_SPECIAL_DATES,
      CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS,
      CUSTOMER_EXCEL_SHEET_FIRE,
      CUSTOMER_EXCEL_SHEET_GUIDE,
    ])
    expect(typeof downloadCustomerUploadSampleXlsx).toBe('function')
  })

  it('parses multi-sheet workbook and counts related rows for C001', async () => {
    const buf = buildFullProfileTestWorkbookBuffer()
    const { related } = parseCustomerExcelWorkbook(buf)
    expect(related.cars.filter((r) => r.importKey === 'C001').length).toBe(2)
    expect(related.specialDates.filter((r) => r.importKey === 'C001').length).toBe(2)
    expect(related.customFields.filter((r) => r.importKey === 'C001').length).toBe(2)
    expect(related.fireLocations.filter((r) => r.importKey === 'C001').length).toBe(2)

    const file = new File([buf], 'full-profile-test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const prep = await prepareCustomerExcelImport(file)
    expect(prep.stats.uploadReadyCount).toBe(2)
    expect(prep.stats.relatedCarRows).toBe(2)
    expect(prep.stats.relatedSpecialDateRows).toBe(2)
    expect(prep.importBundles.some((b) => b.importKey === 'C001')).toBe(true)
  })
})

function buildFullProfileTestWorkbookBuffer(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const basic = buildCustomerExcelSampleSheetAoA()
  basic[1] = basic[1]!.map((v, i) => {
    const h = basic[0]![i]
    if (h === '이름') return '테스트풀고객'
    if (h === '휴대폰') return '01077009901'
    if (h === '생년월일') return '1980-01-01'
    if (h === '성별') return '남'
    if (h === '키') return '175'
    if (h === '몸무게') return '72'
    if (h === '수술치료병력') return 'DEV 수술 이력'
    if (h === '약복용병력') return 'DEV 약복용'
    if (h === '보험가입내역') return 'DEV 보험'
    if (h === '계좌번호') return '110-000-111'
    if (h === '운전여부') return 'Y'
    return v
  })
  basic[2] = basic[2]!.map((v, i) => {
    const h = basic[0]![i]
    if (h === '이름') return '테스트최소여'
    if (h === '휴대폰') return '01088009902'
    if (h === '생년월일') return '1985-01-01'
    if (h === '성별') return '여'
    return v
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(basic), CUSTOMER_EXCEL_SHEET_BASIC)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '차량번호', '차종(차명)', '연식', '갱신일', '자동차종류', '차량메모', '대표차량(Y/N)'],
      ['C001', '11가1111', '아반떼', '2019', '2026-01-01', '승용', '차1', 'Y'],
      ['C001', '22나2222', '카니발', '2017', '2025-06-01', '승합', '차2', 'N'],
    ]),
    CUSTOMER_EXCEL_SHEET_CARS,
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '알림유형', '알림이름', '날짜', '메모'],
      ['C001', '축하', '생일', '1980-01-01', '메모1'],
      ['C001', '안내', '정기안내', '2026-12-01', '메모2'],
    ]),
    CUSTOMER_EXCEL_SHEET_SPECIAL_DATES,
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '라벨', '입력값'],
      ['C001', 'VIP', '우수'],
      ['C001', '지역', '서울'],
    ]),
    CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS,
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '소재지주소', '메모'],
      ['C001', '서울시 강남구 1', '화재1'],
      ['C001', '경기도 성남시 2', '화재2'],
    ]),
    CUSTOMER_EXCEL_SHEET_FIRE,
  )
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return out
}
