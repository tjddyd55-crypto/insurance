/**
 * 고객 Excel full-profile — 다중 시트 SSOT (기본정보 + 1:N 연관 시트)
 */

import type { CustomerExcelColumnDef, CustomerExcelColumnKey } from './customerExcelUploadColumnSsot'

export const CUSTOMER_EXCEL_SHEET_BASIC = '고객기본정보'
/** @deprecated 하위 호환 */
export const CUSTOMER_EXCEL_SHEET_BASIC_LEGACY = '고객데이터'
export const CUSTOMER_EXCEL_SHEET_CARS = '자동차'
export const CUSTOMER_EXCEL_SHEET_SPECIAL_DATES = '알림일'
export const CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS = '추가정보'
export const CUSTOMER_EXCEL_SHEET_FIRE = '화재보험'
export const CUSTOMER_EXCEL_SHEET_GUIDE = '입력안내'

export const CUSTOMER_EXCEL_IMPORT_KEY_LABEL = '고객번호'
export const CUSTOMER_EXCEL_IMPORT_KEY_HEADER = 'importKey'

export type CustomerExcelCarRow = {
  importKey: string
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
  carType: string
  memo: string
  isPrimary: boolean
}

export type CustomerExcelSpecialDateRow = {
  importKey: string
  purposeTypeRaw: string
  title: string
  dateValue: string
  memo: string
}

export type CustomerExcelCustomFieldRow = {
  importKey: string
  label: string
  value: string
}

export type CustomerExcelFireLocationRow = {
  importKey: string
  address: string
  memo: string
}

export type CustomerExcelRelatedSheets = {
  cars: CustomerExcelCarRow[]
  specialDates: CustomerExcelSpecialDateRow[]
  customFields: CustomerExcelCustomFieldRow[]
  fireLocations: CustomerExcelFireLocationRow[]
}

export type CustomerExcelCarSheetColumnKey =
  | 'importKey'
  | 'carNumber'
  | 'carModel'
  | 'carYear'
  | 'renewalDate'
  | 'carType'
  | 'memo'
  | 'isPrimary'

export const CUSTOMER_EXCEL_CAR_SHEET_COLUMNS: Array<{ key: CustomerExcelCarSheetColumnKey; labelKo: string }> = [
  { key: 'importKey', labelKo: CUSTOMER_EXCEL_IMPORT_KEY_LABEL },
  { key: 'carNumber', labelKo: '차량번호' },
  { key: 'carModel', labelKo: '차종(차명)' },
  { key: 'carYear', labelKo: '연식' },
  { key: 'renewalDate', labelKo: '갱신일' },
  { key: 'carType', labelKo: '자동차종류' },
  { key: 'memo', labelKo: '차량메모' },
  { key: 'isPrimary', labelKo: '대표차량(Y/N)' },
]

export const CUSTOMER_EXCEL_SPECIAL_DATE_SHEET_COLUMNS = [
  { key: 'importKey', labelKo: CUSTOMER_EXCEL_IMPORT_KEY_LABEL },
  { key: 'purposeTypeRaw', labelKo: '알림유형' },
  { key: 'title', labelKo: '알림이름' },
  { key: 'dateValue', labelKo: '날짜' },
  { key: 'memo', labelKo: '메모' },
] as const

export const CUSTOMER_EXCEL_CUSTOM_FIELD_SHEET_COLUMNS = [
  { key: 'importKey', labelKo: CUSTOMER_EXCEL_IMPORT_KEY_LABEL },
  { key: 'label', labelKo: '라벨' },
  { key: 'value', labelKo: '입력값' },
] as const

export const CUSTOMER_EXCEL_FIRE_SHEET_COLUMNS = [
  { key: 'importKey', labelKo: CUSTOMER_EXCEL_IMPORT_KEY_LABEL },
  { key: 'address', labelKo: '소재지주소' },
  { key: 'memo', labelKo: '메모' },
] as const

/** 기본정보 시트에 포함할 전체 1:1 컬럼 순서 (샘플·신규 양식) */
export function buildFullProfileBasicColumnDefs(
  basicColumns: CustomerExcelColumnDef[],
): CustomerExcelColumnDef[] {
  const importCol: CustomerExcelColumnDef = {
    key: 'importKey' as CustomerExcelColumnKey,
    labelKo: CUSTOMER_EXCEL_IMPORT_KEY_LABEL,
    description: 'Excel 내부 연결용 (C001 등). 다중 시트 연결 시 필수. 비우면 자동 부여.',
  }
  const withoutLegacyCars = basicColumns.filter(
    (c) => !['carNumber', 'carModel', 'carYear', 'renewalDate', 'carType'].includes(c.key),
  )
  const hasImport = withoutLegacyCars.some((c) => c.key === 'importKey')
  return hasImport ? withoutLegacyCars : [importCol, ...withoutLegacyCars]
}
