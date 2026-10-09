import * as XLSX from 'xlsx'

import {
  CUSTOMER_EXCEL_CAR_SHEET_COLUMNS,
  CUSTOMER_EXCEL_CUSTOM_FIELD_SHEET_COLUMNS,
  CUSTOMER_EXCEL_FIRE_SHEET_COLUMNS,
  CUSTOMER_EXCEL_SHEET_BASIC,
  CUSTOMER_EXCEL_SHEET_BASIC_LEGACY,
  CUSTOMER_EXCEL_SHEET_CARS,
  CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS,
  CUSTOMER_EXCEL_SHEET_FIRE,
  CUSTOMER_EXCEL_SHEET_GUIDE,
  CUSTOMER_EXCEL_SHEET_SPECIAL_DATES,
  CUSTOMER_EXCEL_SPECIAL_DATE_SHEET_COLUMNS,
  type CustomerExcelCarRow,
  type CustomerExcelCustomFieldRow,
  type CustomerExcelFireLocationRow,
  type CustomerExcelRelatedSheets,
  type CustomerExcelSpecialDateRow,
} from '../config/customerExcelFullProfileSsot'
import {
  CUSTOMER_EXCEL_FULL_BASIC_COLUMNS,
  CUSTOMER_EXCEL_PRIMARY_COLUMNS,
  buildHeaderLabelToKeyMap,
  type CustomerExcelColumnKey,
} from '../config/customerExcelUploadColumnSsot'

const HEADER_LABEL_TO_KEY = buildHeaderLabelToKeyMap()

export function cellToExcelString(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }
  return String(value)
}

function parseYesNoPrimary(raw: unknown): boolean {
  const s = cellToExcelString(raw).trim().toUpperCase()
  if (['Y', 'YES', 'TRUE', '예', '1'].includes(s)) {
    return true
  }
  return false
}

type GenericSheetRow = Record<string, string>

function resolveHeaderKeys(
  row: unknown[] | undefined,
  allowedKeys: readonly string[],
  extraLabelMap?: Record<string, string>,
): string[] {
  if (!Array.isArray(row)) {
    return []
  }
  const normalizeHeader = (value: unknown): string =>
    cellToExcelString(value).trim().replace(/\s+/g, '').toLowerCase()
  const allowed = new Set(allowedKeys)
  return row.map((cell) => {
    const raw = cellToExcelString(cell).trim()
    if (!raw) {
      return ''
    }
    const normalized = normalizeHeader(raw)
    const keyMatch = allowedKeys.find((k) => normalizeHeader(k) === normalized)
    if (keyMatch) {
      return keyMatch
    }
    const byLabel = HEADER_LABEL_TO_KEY[raw] ?? extraLabelMap?.[raw]
    if (byLabel && allowed.has(byLabel)) {
      return byLabel
    }
    return ''
  })
}

function sheetToRows2d(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
}

function parseKeyedSheet(
  rows2d: unknown[][],
  allowedKeys: readonly string[],
  mapRow: (rec: GenericSheetRow) => unknown | null,
): unknown[] {
  if (rows2d.length === 0) {
    return []
  }
  const firstKeys = resolveHeaderKeys(rows2d[0] as unknown[], allowedKeys)
  const hasImport = firstKeys.includes('importKey')
  const secondKeys = resolveHeaderKeys(rows2d[1] as unknown[] | undefined, allowedKeys)
  const useSecond = !hasImport && secondKeys.includes('importKey')
  const headerKeys = useSecond ? secondKeys : firstKeys
  const dataStart = useSecond ? 2 : 1
  const out: unknown[] = []
  for (const line of rows2d.slice(dataStart)) {
    const rec: GenericSheetRow = {}
    headerKeys.forEach((key, idx) => {
      if (!key) {
        return
      }
      rec[key] = cellToExcelString(Array.isArray(line) ? line[idx] : '')
    })
    const mapped = mapRow(rec)
    if (mapped) {
      out.push(mapped)
    }
  }
  return out
}

export function resolveBasicInfoSheetName(wb: XLSX.WorkBook): string | null {
  if (wb.SheetNames.includes(CUSTOMER_EXCEL_SHEET_BASIC)) {
    return CUSTOMER_EXCEL_SHEET_BASIC
  }
  if (wb.SheetNames.includes(CUSTOMER_EXCEL_SHEET_BASIC_LEGACY)) {
    return CUSTOMER_EXCEL_SHEET_BASIC_LEGACY
  }
  const first = wb.SheetNames[0]
  return first ?? null
}

export function parseRelatedSheetsFromWorkbook(wb: XLSX.WorkBook): CustomerExcelRelatedSheets {
  const carsSheet = wb.Sheets[CUSTOMER_EXCEL_SHEET_CARS]
  const sdSheet = wb.Sheets[CUSTOMER_EXCEL_SHEET_SPECIAL_DATES]
  const cfSheet = wb.Sheets[CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS]
  const fireSheet = wb.Sheets[CUSTOMER_EXCEL_SHEET_FIRE]

  const carKeys = CUSTOMER_EXCEL_CAR_SHEET_COLUMNS.map((c) => c.key)
  const cars = carsSheet
    ? (parseKeyedSheet(sheetToRows2d(carsSheet), carKeys, (rec) => {
        const importKey = rec.importKey.trim()
        if (!importKey) {
          return null
        }
        const row: CustomerExcelCarRow = {
          importKey,
          carNumber: rec.carNumber?.trim() ?? '',
          carModel: rec.carModel?.trim() ?? '',
          carYear: rec.carYear?.trim() ?? '',
          renewalDate: rec.renewalDate?.trim() ?? '',
          carType: rec.carType?.trim() ?? '',
          memo: rec.memo?.trim() ?? '',
          isPrimary: parseYesNoPrimary(rec.isPrimary),
        }
        const hasAny =
          row.carNumber || row.carModel || row.carYear || row.renewalDate || row.carType || row.memo
        return hasAny ? row : null
      }) as CustomerExcelCarRow[])
    : []

  const sdKeys = CUSTOMER_EXCEL_SPECIAL_DATE_SHEET_COLUMNS.map((c) => c.key)
  const specialDates = sdSheet
    ? (parseKeyedSheet(sheetToRows2d(sdSheet), sdKeys, (rec) => {
        const importKey = rec.importKey.trim()
        if (!importKey) {
          return null
        }
        const title = rec.title?.trim() ?? ''
        const dateValue = rec.dateValue?.trim() ?? ''
        if (!title && !dateValue) {
          return null
        }
        return {
          importKey,
          purposeTypeRaw: rec.purposeTypeRaw?.trim() ?? '',
          title,
          dateValue,
          memo: rec.memo?.trim() ?? '',
        } satisfies CustomerExcelSpecialDateRow
      }) as CustomerExcelSpecialDateRow[])
    : []

  const cfKeys = CUSTOMER_EXCEL_CUSTOM_FIELD_SHEET_COLUMNS.map((c) => c.key)
  const customFields = cfSheet
    ? (parseKeyedSheet(sheetToRows2d(cfSheet), cfKeys, (rec) => {
        const importKey = rec.importKey.trim()
        const label = rec.label?.trim() ?? ''
        if (!importKey || !label) {
          return null
        }
        return {
          importKey,
          label,
          value: rec.value?.trim() ?? '',
        } satisfies CustomerExcelCustomFieldRow
      }) as CustomerExcelCustomFieldRow[])
    : []

  const fireKeys = CUSTOMER_EXCEL_FIRE_SHEET_COLUMNS.map((c) => c.key)
  const fireLocations = fireSheet
    ? (parseKeyedSheet(sheetToRows2d(fireSheet), fireKeys, (rec) => {
        const importKey = rec.importKey.trim()
        const address = rec.address?.trim() ?? ''
        if (!importKey || !address) {
          return null
        }
        return {
          importKey,
          address,
          memo: rec.memo?.trim() ?? '',
        } satisfies CustomerExcelFireLocationRow
      }) as CustomerExcelFireLocationRow[])
    : []

  return { cars, specialDates, customFields, fireLocations }
}

/** 텍스트로 강제할 컬럼 인덱스(0-based) — 앞자리 0 보존 */
const TEXT_COLUMN_KEYS_BASIC = new Set<CustomerExcelColumnKey>([
  'importKey',
  'phone',
  'ssn',
  'businessNumber',
])

export function applyWorksheetPresentation(
  ws: XLSX.WorkSheet,
  headerKeys: string[],
  rowCount: number,
  colWidths: number[],
): void {
  ws['!cols'] = colWidths.map((w) => ({ wch: w }))
  const textCols = headerKeys
    .map((k, idx) => (TEXT_COLUMN_KEYS_BASIC.has(k as CustomerExcelColumnKey) ? idx : -1))
    .filter((i) => i >= 0)
  for (let r = 1; r < rowCount; r += 1) {
    for (const c of textCols) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell || cell.v == null || cell.v === '') {
        continue
      }
      cell.t = 's'
      cell.v = String(cell.v)
      cell.z = '@'
    }
  }
  const lastCol = Math.max(0, headerKeys.length - 1)
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }),
  }
  ws['!views'] = [{ state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: true }]
  for (let c = 0; c <= lastCol; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const cell = ws[addr]
    if (cell) {
      cell.s = { font: { bold: true } }
    }
  }
}

export function buildGuideSheetAoA(): string[][] {
  const lines: string[][] = [
    ['항목', '안내'],
    ['빈칸', '입력하지 않아도 됩니다. 빈칸은 무시됩니다.'],
    ['주민번호 없음', '생년월일 + 성별(남/여)만으로 등록할 수 있습니다.'],
    ['성별', '남 / 여 로 입력하면 됩니다. (남자·여자·male·female·M·F도 가능)'],
    ['고객번호', '다중 시트 연결용입니다. 기본정보·자동차·알림일 등에서 같은 번호를 사용합니다.'],
    ['자동차', '「자동차」 시트에 고객번호별로 여러 행 입력 가능합니다.'],
    ['알림일', '「알림일」 시트 — 유형: 축하·감사·안내·점검 또는 CELEBRATION 등 영문 코드'],
    ['추가정보', '「추가정보」 시트 — 라벨·입력값 (고객 상세 추가 정보)'],
    ['화재보험', '「화재보험」 시트 — 소재지 주소·메모'],
    ['날짜', 'YYYY-MM-DD 권장'],
    ['휴대폰·주민·사업자번호', '앞자리 0이 사라지지 않도록 셀 서식을 텍스트로 두세요.'],
  ]
  for (const col of CUSTOMER_EXCEL_PRIMARY_COLUMNS) {
    lines.push([col.labelKo, col.description])
  }
  return lines
}

export function basicColumnWidths(): number[] {
  return CUSTOMER_EXCEL_FULL_BASIC_COLUMNS.map((c) => {
    if (c.key === 'memo' || c.key === 'treatmentHistoryNote' || c.key === 'medicationHistoryNote') {
      return 28
    }
    if (c.key === 'address' || c.key === 'businessAddress') {
      return 22
    }
    return Math.min(24, Math.max(12, c.labelKo.length + 4))
  })
}

export { CUSTOMER_EXCEL_SHEET_GUIDE }
