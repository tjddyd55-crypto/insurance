import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

import type { CustomerNote } from '../domain/types'
import type { SaveCustomerPayload } from '../api/customersApi'
import { saveCustomer } from '../api/customersApi'

/** 샘플·업로드 공통 헤더 순서 (1행) */
export const CUSTOMER_EXCEL_UPLOAD_HEADERS = [
  'name',
  'ssn',
  'gender',
  'phone',
  'address',
  'height',
  'weight',
  'job',
  'isDriver',
  'carType',
  'medical',
  'carNumber',
  'carModel',
  'carYear',
  'renewalDate',
  'memo',
] as const

const SHEET_DATA = '고객데이터'
const SHEET_DESC = '컬럼설명'
const SAMPLE_FILENAME = 'customer-upload-sample.xlsx'

export type CustomerExcelParsedRow = {
  name: string
  ssn: string
  genderRaw: string
  phone: string
  address: string
  height: string
  weight: string
  job: string
  isDriver: boolean | null
  carType: string
  medical: string
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
  memoRaw: string
}

export type CustomerUploadFailure = {
  name: string
  ssn: string
  message: string
}

export type CustomerUploadBatchResult = {
  total: number
  success: number
  failed: number
  failures: CustomerUploadFailure[]
}

function cellToString(value: unknown): string {
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

function newNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 메모: "/" 분리 → notes (서버 검증용 id 포함) */
export function memoToNotes(memoRaw: string, createdAt: string): CustomerNote[] {
  const raw = cellToString(memoRaw).trim()
  if (!raw) {
    return []
  }
  const parts = raw
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.map((content) => ({
    id: newNoteId(),
    content,
    createdAt,
  }))
}

export function parseGender(value: unknown): '' | 'male' | 'female' {
  const s = cellToString(value).trim().toLowerCase()
  if (s === 'male' || s === 'female') {
    return s
  }
  return ''
}

/** 스펙: "TRUE" / "FALSE" 만 인정, 그 외 null. 엑셀 불리언·대소문자 허용. */
export function parseIsDriverCell(value: unknown): boolean | null {
  if (value === true) {
    return true
  }
  if (value === false) {
    return false
  }
  const s = cellToString(value).trim().toUpperCase()
  if (s === 'TRUE') {
    return true
  }
  if (s === 'FALSE') {
    return false
  }
  return null
}

function drivingFromIsDriver(isDriver: boolean | null): string {
  if (isDriver === true) {
    return '운전함'
  }
  if (isDriver === false) {
    return '운전 안함'
  }
  return ''
}

function firstNonEmpty(a: string, b: string): string {
  const ta = a.trim()
  if (ta) {
    return ta
  }
  return b.trim()
}

function mergeMemoParts(a: string, b: string): string {
  const ta = a.trim()
  const tb = b.trim()
  if (!ta) {
    return tb
  }
  if (!tb) {
    return ta
  }
  return `${ta} / ${tb}`
}

function mergeIsDriver(a: boolean | null, b: boolean | null): boolean | null {
  if (a !== null && b !== null) {
    return b
  }
  return a !== null ? a : b
}

function normalizeSsnKey(ssn: string): string {
  return ssn.replace(/\D/g, '')
}

export function parseExcel(file: File): Promise<CustomerExcelParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
    reader.onload = () => {
      try {
        const buf = reader.result
        if (!(buf instanceof ArrayBuffer)) {
          reject(new Error('파일 형식이 올바르지 않습니다.'))
          return
        }
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[SHEET_DATA]
        if (!sheet) {
          reject(new Error(`「${SHEET_DATA}」시트를 찾을 수 없습니다.`))
          return
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })
        const parsed: CustomerExcelParsedRow[] = []
        for (const row of rows) {
          parsed.push({
            name: cellToString(row.name).trim(),
            ssn: cellToString(row.ssn).trim(),
            genderRaw: cellToString(row.gender),
            phone: cellToString(row.phone),
            address: cellToString(row.address),
            height: cellToString(row.height),
            weight: cellToString(row.weight),
            job: cellToString(row.job),
            isDriver: parseIsDriverCell(row.isDriver),
            carType: cellToString(row.carType),
            medical: cellToString(row.medical),
            carNumber: cellToString(row.carNumber),
            carModel: cellToString(row.carModel),
            carYear: cellToString(row.carYear),
            renewalDate: cellToString(row.renewalDate),
            memoRaw: cellToString(row.memo),
          })
        }
        resolve(parsed)
      } catch (e) {
        reject(e instanceof Error ? e : new Error('엑셀 파싱에 실패했습니다.'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function mergeRowsBySsn(rows: CustomerExcelParsedRow[]): CustomerExcelParsedRow[] {
  const map = new Map<string, CustomerExcelParsedRow>()
  for (const row of rows) {
    const key = normalizeSsnKey(row.ssn)
    if (!key) {
      continue
    }
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...row })
      continue
    }
    const merged: CustomerExcelParsedRow = {
      name: firstNonEmpty(prev.name, row.name),
      ssn: firstNonEmpty(prev.ssn, row.ssn),
      genderRaw: firstNonEmpty(prev.genderRaw, row.genderRaw),
      phone: firstNonEmpty(prev.phone, row.phone),
      address: firstNonEmpty(prev.address, row.address),
      height: firstNonEmpty(prev.height, row.height),
      weight: firstNonEmpty(prev.weight, row.weight),
      job: firstNonEmpty(prev.job, row.job),
      isDriver: mergeIsDriver(prev.isDriver, row.isDriver),
      carType: firstNonEmpty(prev.carType, row.carType),
      medical: firstNonEmpty(prev.medical, row.medical),
      carNumber: firstNonEmpty(prev.carNumber, row.carNumber),
      carModel: firstNonEmpty(prev.carModel, row.carModel),
      carYear: firstNonEmpty(prev.carYear, row.carYear),
      renewalDate: firstNonEmpty(prev.renewalDate, row.renewalDate),
      memoRaw: mergeMemoParts(prev.memoRaw, row.memoRaw),
    }
    map.set(key, merged)
  }
  return [...map.values()]
}

/** 필수(name, ssn) 없으면 null */
export function transformRow(row: CustomerExcelParsedRow): SaveCustomerPayload | null {
  const name = row.name.trim()
  const ssn = row.ssn.trim()
  if (!name || !ssn) {
    return null
  }
  const gender = parseGender(row.genderRaw)
  const isDriver = row.isDriver
  const createdAt = new Date().toISOString()
  const notes = memoToNotes(row.memoRaw, createdAt)
  const carTypeTrim = row.carType.trim()
  return {
    name,
    ssn,
    gender: gender === '' ? '' : gender,
    phone: row.phone.trim(),
    carrier: '',
    address: row.address.trim(),
    height: row.height.trim(),
    weight: row.weight.trim(),
    job: row.job.trim(),
    isDriver,
    carType: isDriver === true ? carTypeTrim : '',
    medical: row.medical.trim(),
    carNumber: row.carNumber.trim(),
    carModel: row.carModel.trim(),
    carYear: row.carYear.trim(),
    renewalDate: row.renewalDate.trim(),
    driving: drivingFromIsDriver(isDriver),
    notes,
  }
}

export function downloadCustomerUploadSampleXlsx(): void {
  const headers = [...CUSTOMER_EXCEL_UPLOAD_HEADERS]
  const row1 = [
    '홍길동',
    '8401011234567',
    'male',
    '01012341234',
    '서울 광진구',
    '175',
    '70',
    '자영업',
    'TRUE',
    '',
    '',
    '',
    '',
    '',
    '',
    '지인 소개 / VIP 고객',
  ]
  const row2 = [
    '김영희',
    '9002022234567',
    'female',
    '01056785678',
    '서울 강남구',
    '160',
    '50',
    '회사원',
    'FALSE',
    '',
    '',
    '',
    '',
    '',
    '',
    '보험 상담 필요',
  ]
  const descHeader = ['컬럼명', '설명']
  const descRows = [
    ['gender', 'male / female'],
    ['isDriver', 'TRUE / FALSE'],
    ['memo', '"/" 기준으로 notes 배열로 변환됨'],
  ]
  const sheet1 = XLSX.utils.aoa_to_sheet([headers, row1, row2])
  sheet1['!cols'] = headers.map(() => ({ wch: 14 }))
  const sheet2 = XLSX.utils.aoa_to_sheet([descHeader, ...descRows])
  sheet2['!cols'] = [{ wch: 18 }, { wch: 44 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet1, SHEET_DATA)
  XLSX.utils.book_append_sheet(wb, sheet2, SHEET_DESC)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
  saveAs(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    SAMPLE_FILENAME,
  )
}

/**
 * 변환·중복 제거 후 순차 POST. onProgress: (done, total) — done은 시도 완료 건수.
 */
export async function uploadCustomers(
  token: string,
  payloads: SaveCustomerPayload[],
  onProgress?: (done: number, total: number) => void,
): Promise<CustomerUploadBatchResult> {
  const failures: CustomerUploadFailure[] = []
  let success = 0
  const total = payloads.length
  let done = 0

  for (const payload of payloads) {
    try {
      await saveCustomer(token, payload)
      success += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.'
      failures.push({
        name: payload.name,
        ssn: String(payload.ssn ?? ''),
        message,
      })
    } finally {
      done += 1
      onProgress?.(done, total)
    }
  }

  return {
    total,
    success,
    failed: failures.length,
    failures,
  }
}

/** 파싱 → 주민번호 병합 → 페이로드 (스킵 행 제외) */
export async function parseExcelToPayloads(file: File): Promise<SaveCustomerPayload[]> {
  const raw = await parseExcel(file)
  const merged = mergeRowsBySsn(raw)
  const out: SaveCustomerPayload[] = []
  for (const row of merged) {
    const p = transformRow(row)
    if (p) {
      out.push(p)
    }
  }
  return out
}
