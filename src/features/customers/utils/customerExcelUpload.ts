import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

import { resolveCustomerGenderForImport as resolveCustomerGenderForImportShared } from '@insurance-shared/customerGenderNormalize.js'
import { formatAddressForSave } from '../../../components/form'
import type { SaveCustomerPayload } from '../api/customersApi'
import { saveCustomer } from '../api/customersApi'
import {
  CUSTOMER_EXCEL_PRIMARY_COLUMNS,
  CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO,
  CUSTOMER_EXCEL_SAMPLE_HEADERS,
  CUSTOMER_EXCEL_UPLOAD_HEADERS,
  CUSTOMER_EXCEL_UPLOAD_HEADER_LABELS_KO,
  buildHeaderLabelToKeyMap,
  type CustomerExcelColumnKey,
} from '../config/customerExcelUploadColumnSsot'
import type { CustomerNote } from '../domain/types'
import { normalizeCustomerNotesBag } from '../domain/types'
import { isCustomerBusinessInfoFormEmpty } from '../domain/customerBusinessInfo'
import {
  normalizeNameForCustomerDedupe,
  normalizePhoneForCustomerDedupe,
} from './customerSearchDedupe'

export { CUSTOMER_EXCEL_UPLOAD_HEADERS } from '../config/customerExcelUploadColumnSsot'

const SHEET_DATA = '고객데이터'
const SHEET_DESC = '입력안내'
const SAMPLE_FILENAME = 'customer-upload-sample.xlsx'

const HEADER_LABEL_TO_KEY = buildHeaderLabelToKeyMap()

/** 한국 주민등록번호 본문 13자리 (있을 때만 검증·병합 키로 사용) */
export const RRN_NORMALIZED_LENGTH = 13

/** 업로드 필수값 미충족 안내 */
export const CUSTOMER_EXCEL_UPLOAD_REQUIRED_FIELD_MESSAGE =
  '이름은 필수이며, 연락처 또는 주민번호 중 하나는 필요합니다.'

/** 유효 연락처 최소 자릿수(숫자만) */
export const CUSTOMER_EXCEL_UPLOAD_MIN_PHONE_DIGITS = 10

/** 숫자만 추출. 비정상·누락 시 병합 키로 쓰지 않도록 길이 검증은 호출부에서 한다. */
export function normalizeSsn(ssn: string): string {
  return String(ssn ?? '')
    .replace(/\D/g, '')
    .trim()
}

export type CustomerExcelParsedRow = {
  name: string
  phone: string
  ssn: string
  birthDate: string
  genderRaw: string
  address: string
  addressDetail: string
  job: string
  memoRaw: string
  businessRepresentativeName: string
  businessNumber: string
  businessAddress: string
  businessAddressDetail: string
  businessMemo: string
  carrier: string
  height: string
  weight: string
  isDriver: boolean | null
  carType: string
  medical: string
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
  insuranceHistory: string
  inflowSource: string
  referrerName: string
}

export type CustomerUploadFailure = {
  name: string
  ssn: string
  phone: string
  message: string
}

export type CustomerUploadBatchResult = {
  total: number
  success: number
  failed: number
  failures: CustomerUploadFailure[]
  /** API 오류 난 요청 본문 — 재업로드·JSON/엑셀 저장용 */
  failedPayloads: SaveCustomerPayload[]
}

/** 업로드에서 제외된 행 */
export type PreparedExcludedRow = {
  /** 엑셀 시트 행 번호(1부터, 헤더=1). 병합 후 제외 등 알 수 없으면 0 */
  excelRow: number
  category: 'invalid_ssn' | 'missing_name' | 'missing_phone' | 'other'
  reason: string
  values: Record<string, string>
}

export type CustomerExcelPrepareResult = {
  payloads: SaveCustomerPayload[]
  excludedRows: PreparedExcludedRow[]
  stats: {
    /** 시트에서 읽은 데이터 행 수(헤더 제외) */
    totalSheetRows: number
    /** 주민번호가 입력됐지만 13자리가 아닌 경우 */
    skippedInvalidSsnCount: number
    /** 이름·연락처 누락 등 */
    skippedOtherCount: number
    /** 같은 병합 키(주민번호 또는 이름+연락처)로 묶인 추가 행 수 */
    mergedAbsorbedRowCount: number
    /** 병합 키가 2행 이상 등장한 고유 그룹 수 */
    duplicateMergeGroupCount: number
    /** API 전송 예정 건수 */
    uploadReadyCount: number
  }
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
  const rawParts = raw
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const parts: string[] = []
  for (const p of rawParts) {
    if (seen.has(p)) {
      continue
    }
    seen.add(p)
    parts.push(p)
  }
  return parts.map((content) => ({
    id: newNoteId(),
    content,
    createdAt,
  }))
}

export type CustomerExcelGenderResolveResult =
  | { ok: true; gender: '' | 'male' | 'female' }
  | { ok: false; code: 'invalid_gender' | 'gender_ssn_conflict' }

export function resolveGenderForCustomerImport(
  genderRaw: unknown,
  ssn: string,
): '' | 'male' | 'female' {
  const res = resolveCustomerGenderForImportShared(genderRaw, ssn)
  if (!res.ok) {
    return ''
  }
  return res.gender
}

export function resolveGenderForCustomerImportDetailed(
  genderRaw: unknown,
  ssn: string,
): CustomerExcelGenderResolveResult {
  return resolveCustomerGenderForImportShared(genderRaw, ssn)
}

export function customerExcelGenderTransformErrorMessage(
  code: 'invalid_gender' | 'gender_ssn_conflict',
): string {
  if (code === 'gender_ssn_conflict') {
    return '성별과 주민등록번호의 성별 코드가 일치하지 않습니다.'
  }
  return '성별 값을 인식할 수 없습니다. 남/여 등으로 입력해 주세요.'
}

function normalizeBirthDateCell(value: unknown): string {
  const s = cellToString(value).trim()
  if (!s) {
    return ''
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  const digits = s.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
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

/** 뒤 행(b)에 유효한 값이 있으면 우선 (엑셀 하단이 최신인 경우가 많음) */
function pickValue(a: string, b: string): string {
  const tb = String(b ?? '').trim()
  if (tb !== '') {
    return tb
  }
  return String(a ?? '').trim()
}

function memoPartsFromRaw(raw: string): string[] {
  return cellToString(raw)
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
}

/** "/"로 쪼갠 조각을 순서 유지한 채 중복만 제거한 뒤 다시 join (memoToNotes와 호환) */
function mergeMemoPartsUnique(a: string, b: string): string {
  const combined = [...memoPartsFromRaw(a), ...memoPartsFromRaw(b)]
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const p of combined) {
    if (seen.has(p)) {
      continue
    }
    seen.add(p)
    ordered.push(p)
  }
  return ordered.join(' / ')
}

function mergeIsDriver(a: boolean | null, b: boolean | null): boolean | null {
  if (a !== null && b !== null) {
    return b
  }
  return a !== null ? a : b
}

function parsedRowToExportRecord(row: CustomerExcelParsedRow): Record<string, string> {
  const d =
    row.isDriver === true ? 'TRUE' : row.isDriver === false ? 'FALSE' : ''
  const rec: Record<string, string> = {
    name: row.name,
    phone: row.phone,
    ssn: row.ssn,
    birthDate: row.birthDate,
    gender: cellToString(row.genderRaw),
    address: row.address,
    addressDetail: row.addressDetail,
    job: row.job,
    memo: row.memoRaw,
    businessRepresentativeName: row.businessRepresentativeName,
    businessNumber: row.businessNumber,
    businessAddress: row.businessAddress,
    businessAddressDetail: row.businessAddressDetail,
    businessMemo: row.businessMemo,
    carrier: row.carrier,
    height: row.height,
    weight: row.weight,
    isDriver: d,
    carType: row.carType,
    medical: row.medical,
    carNumber: row.carNumber,
    carModel: row.carModel,
    carYear: row.carYear,
    renewalDate: row.renewalDate,
    insuranceHistory: row.insuranceHistory,
    inflowSource: row.inflowSource,
    referrerName: row.referrerName,
  }
  return rec
}

function payloadToExportRecord(p: SaveCustomerPayload): Record<string, string> {
  const g = p.gender === null || p.gender === undefined ? '' : String(p.gender)
  const d =
    p.isDriver === true ? 'TRUE' : p.isDriver === false ? 'FALSE' : ''
  const bag = normalizeCustomerNotesBag(p.notes)
  const bi = p.businessInfo
  return {
    name: p.name ?? '',
    phone: p.phone ?? '',
    ssn: String(p.ssn ?? ''),
    birthDate: String(p.birthDate ?? ''),
    gender: g,
    address: p.address ?? '',
    addressDetail: '',
    job: p.job ?? '',
    memo: bag.items.map((n) => n.content).join(' / '),
    businessRepresentativeName: bi?.representativeName ?? '',
    businessNumber: bi?.businessNumber ?? '',
    businessAddress: bi?.businessAddress ?? '',
    businessAddressDetail: '',
    businessMemo: bi?.memo ?? '',
    carrier: p.carrier ?? '',
    height: p.height ?? '',
    weight: p.weight ?? '',
    isDriver: d,
    carType: p.carType ?? '',
    medical: p.medical ?? '',
    carNumber: p.carNumber ?? '',
    carModel: p.carModel ?? '',
    carYear: p.carYear ?? '',
    renewalDate: p.renewalDate ?? '',
    insuranceHistory: bag.insuranceHistory,
    inflowSource: String(p.inflowSource ?? ''),
    referrerName: String(p.referrerName ?? ''),
  }
}

function normalizeOptionalSsn(ssn: string): string {
  const norm = normalizeSsn(ssn)
  return norm.length === RRN_NORMALIZED_LENGTH ? norm : ''
}

export function isInvalidSsnFormat(ssn: string): boolean {
  const norm = normalizeSsn(ssn)
  return norm.length > 0 && norm.length !== RRN_NORMALIZED_LENGTH
}

export function hasValidUploadPhone(phone: string): boolean {
  return normalizePhoneForCustomerDedupe(phone).length >= CUSTOMER_EXCEL_UPLOAD_MIN_PHONE_DIGITS
}

export function hasValidResidentNumber(ssn: string): boolean {
  return normalizeSsn(ssn).length === RRN_NORMALIZED_LENGTH
}

export function satisfiesCustomerExcelUploadRequiredFields(row: {
  name: string
  phone: string
  ssn: string
}): boolean {
  const name = row.name.trim()
  if (!name) {
    return false
  }
  return hasValidUploadPhone(row.phone) || hasValidResidentNumber(row.ssn)
}

/** 주민번호(우선) 또는 이름+연락처 병합 키. 유효하지 않으면 null */
export function getCustomerExcelRowMergeKey(row: CustomerExcelParsedRow): string | null {
  const ssnNorm = normalizeSsn(row.ssn)
  if (ssnNorm.length === RRN_NORMALIZED_LENGTH) {
    return `ssn:${ssnNorm}`
  }
  if (ssnNorm.length > 0) {
    return null
  }
  const phone = normalizePhoneForCustomerDedupe(row.phone)
  const name = normalizeNameForCustomerDedupe(row.name)
  if (!name || phone.length < CUSTOMER_EXCEL_UPLOAD_MIN_PHONE_DIGITS) {
    return null
  }
  return `phone:${phone}:${name}`
}

/** 병합 키 기준 중복 통계 */
function duplicateMergeMetrics(validRows: CustomerExcelParsedRow[]): {
  duplicateMergeGroupCount: number
  mergedAbsorbedRowCount: number
} {
  const byKey = new Map<string, number>()
  for (const r of validRows) {
    const k = getCustomerExcelRowMergeKey(r)
    if (!k) {
      continue
    }
    byKey.set(k, (byKey.get(k) ?? 0) + 1)
  }
  let duplicateMergeGroupCount = 0
  let mergedAbsorbedRowCount = 0
  for (const c of byKey.values()) {
    if (c > 1) {
      duplicateMergeGroupCount += 1
      mergedAbsorbedRowCount += c - 1
    }
  }
  return { duplicateMergeGroupCount, mergedAbsorbedRowCount }
}

export function parseCustomerExcelRowsFromSheetRows(rows2d: unknown[][]): CustomerExcelParsedRow[] {
        if (rows2d.length === 0) {
          return []
        }

        const normalizeHeader = (value: unknown): string =>
          cellToString(value).trim().replace(/\s+/g, '').toLowerCase()

        const resolveHeaderKeys = (row: unknown[] | undefined): string[] => {
          if (!Array.isArray(row)) {
            return []
          }
          return row.map((cell) => {
            const raw = cellToString(cell).trim()
            if (!raw) {
              return ''
            }
            const normalized = normalizeHeader(raw)
            const keyMatch = (CUSTOMER_EXCEL_UPLOAD_HEADERS as readonly string[]).find(
              (k) => normalizeHeader(k) === normalized,
            )
            if (keyMatch) {
              return keyMatch
            }
            const byLabel = HEADER_LABEL_TO_KEY[raw]
            if (byLabel) {
              return byLabel
            }
            return ''
          })
        }

        const hasRequiredKeys = (keys: string[]): boolean => {
          const set = new Set(keys.filter(Boolean))
          return set.has('name') && (set.has('phone') || set.has('ssn'))
        }

        const firstHeaderKeys = resolveHeaderKeys(rows2d[0] as unknown[])
        const secondHeaderKeys = resolveHeaderKeys(rows2d[1] as unknown[] | undefined)
        const useSecondHeader = !hasRequiredKeys(firstHeaderKeys) && hasRequiredKeys(secondHeaderKeys)
        const headerKeys = useSecondHeader ? secondHeaderKeys : firstHeaderKeys
        const dataStartIndex = useSecondHeader ? 2 : 1

        const rows = rows2d.slice(dataStartIndex).map((line) => {
          const rec: Record<string, unknown> = {}
          headerKeys.forEach((key, idx) => {
            if (!key) {
              return
            }
            rec[key] = Array.isArray(line) ? line[idx] : ''
          })
          return rec
        })

        const parsed: CustomerExcelParsedRow[] = []
        for (const row of rows) {
          parsed.push({
            name: cellToString(row.name).trim(),
            phone: cellToString(row.phone),
            ssn: cellToString(row.ssn).trim(),
            birthDate: normalizeBirthDateCell(row.birthDate),
            genderRaw: cellToString(row.gender),
            address: cellToString(row.address),
            addressDetail: cellToString(row.addressDetail),
            job: cellToString(row.job),
            memoRaw: cellToString(row.memo),
            businessRepresentativeName: cellToString(row.businessRepresentativeName),
            businessNumber: cellToString(row.businessNumber),
            businessAddress: cellToString(row.businessAddress),
            businessAddressDetail: cellToString(row.businessAddressDetail),
            businessMemo: cellToString(row.businessMemo),
            carrier: cellToString(row.carrier),
            height: cellToString(row.height),
            weight: cellToString(row.weight),
            isDriver: parseIsDriverCell(row.isDriver),
            carType: cellToString(row.carType),
            medical: cellToString(row.medical),
            carNumber: cellToString(row.carNumber),
            carModel: cellToString(row.carModel),
            carYear: cellToString(row.carYear),
            renewalDate: cellToString(row.renewalDate),
            insuranceHistory: cellToString(row.insuranceHistory),
            inflowSource: cellToString(row.inflowSource),
            referrerName: cellToString(row.referrerName),
          })
        }
        return parsed
}

export function parseCustomerExcelArrayBuffer(buf: ArrayBuffer): CustomerExcelParsedRow[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[SHEET_DATA]
  if (!sheet) {
    throw new Error(`「${SHEET_DATA}」시트를 찾을 수 없습니다.`)
  }
  const rows2d = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
  return parseCustomerExcelRowsFromSheetRows(rows2d)
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
        resolve(parseCustomerExcelArrayBuffer(buf))
      } catch (e) {
        reject(e instanceof Error ? e : new Error('엑셀 파싱에 실패했습니다.'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function mergeRowsForImport(rows: CustomerExcelParsedRow[]): CustomerExcelParsedRow[] {
  const map = new Map<string, CustomerExcelParsedRow>()
  for (const row of rows) {
    const key = getCustomerExcelRowMergeKey(row)
    if (!key) {
      continue
    }
    const rowNorm: CustomerExcelParsedRow = {
      ...row,
      name: row.name.trim(),
      ssn: normalizeOptionalSsn(row.ssn),
      phone: row.phone.trim(),
    }
    const prev = map.get(key)
    if (!prev) {
      map.set(key, rowNorm)
      continue
    }
    const merged: CustomerExcelParsedRow = {
      name: pickValue(prev.name, rowNorm.name),
      phone: pickValue(prev.phone, rowNorm.phone),
      ssn: pickValue(prev.ssn, rowNorm.ssn),
      birthDate: pickValue(prev.birthDate, rowNorm.birthDate),
      genderRaw: pickValue(prev.genderRaw, rowNorm.genderRaw),
      address: pickValue(prev.address, rowNorm.address),
      addressDetail: pickValue(prev.addressDetail, rowNorm.addressDetail),
      job: pickValue(prev.job, rowNorm.job),
      memoRaw: mergeMemoPartsUnique(prev.memoRaw, rowNorm.memoRaw),
      businessRepresentativeName: pickValue(prev.businessRepresentativeName, rowNorm.businessRepresentativeName),
      businessNumber: pickValue(prev.businessNumber, rowNorm.businessNumber),
      businessAddress: pickValue(prev.businessAddress, rowNorm.businessAddress),
      businessAddressDetail: pickValue(prev.businessAddressDetail, rowNorm.businessAddressDetail),
      businessMemo: pickValue(prev.businessMemo, rowNorm.businessMemo),
      carrier: pickValue(prev.carrier, rowNorm.carrier),
      height: pickValue(prev.height, rowNorm.height),
      weight: pickValue(prev.weight, rowNorm.weight),
      isDriver: mergeIsDriver(prev.isDriver, rowNorm.isDriver),
      carType: pickValue(prev.carType, rowNorm.carType),
      medical: pickValue(prev.medical, rowNorm.medical),
      carNumber: pickValue(prev.carNumber, rowNorm.carNumber),
      carModel: pickValue(prev.carModel, rowNorm.carModel),
      carYear: pickValue(prev.carYear, rowNorm.carYear),
      renewalDate: pickValue(prev.renewalDate, rowNorm.renewalDate),
      insuranceHistory: pickValue(prev.insuranceHistory, rowNorm.insuranceHistory),
      inflowSource: pickValue(prev.inflowSource, rowNorm.inflowSource),
      referrerName: pickValue(prev.referrerName, rowNorm.referrerName),
    }
    map.set(key, merged)
  }
  return [...map.values()]
}

/** @deprecated mergeRowsForImport 사용 */
export function mergeRowsBySsn(rows: CustomerExcelParsedRow[]): CustomerExcelParsedRow[] {
  return mergeRowsForImport(rows)
}

export function getCustomerExcelRowTransformError(row: CustomerExcelParsedRow): string | null {
  const name = row.name.trim()
  const ssn = normalizeOptionalSsn(row.ssn)
  const hasPhone = hasValidUploadPhone(row.phone)
  const hasResidentNumber = ssn.length === RRN_NORMALIZED_LENGTH
  if (!name || (!hasPhone && !hasResidentNumber)) {
    return CUSTOMER_EXCEL_UPLOAD_REQUIRED_FIELD_MESSAGE
  }
  const genderRes = resolveCustomerGenderForImportShared(row.genderRaw, ssn)
  if (!genderRes.ok) {
    return customerExcelGenderTransformErrorMessage(genderRes.code)
  }
  return null
}

/** 필수(name + 연락처 또는 주민번호) 미충족·성별 오류 시 null */
export function transformRow(row: CustomerExcelParsedRow): SaveCustomerPayload | null {
  const transformError = getCustomerExcelRowTransformError(row)
  if (transformError) {
    return null
  }
  const name = row.name.trim()
  const ssn = normalizeOptionalSsn(row.ssn)
  const genderRes = resolveCustomerGenderForImportShared(row.genderRaw, ssn)
  const gender = genderRes.ok ? genderRes.gender : ''
  const isDriver = row.isDriver
  const createdAt = new Date().toISOString()
  const noteItems = memoToNotes(row.memoRaw, createdAt)
  const carTypeTrim = row.carType.trim()
  const insuranceHistory = row.insuranceHistory.trim()
  const businessInfo = {
    representativeName: row.businessRepresentativeName.trim(),
    businessNumber: row.businessNumber.trim(),
    businessAddress: formatAddressForSave({
      zonecode: '',
      baseAddress: row.businessAddress.trim(),
      detailAddress: row.businessAddressDetail.trim(),
    }),
    memo: row.businessMemo.trim(),
  }
  const birthDate = row.birthDate.trim()
  return {
    name,
    ssn,
    gender: gender === '' ? '' : gender,
    phone: row.phone.trim(),
    carrier: row.carrier.trim(),
    address: formatAddressForSave({
      zonecode: '',
      baseAddress: row.address.trim(),
      detailAddress: row.addressDetail.trim(),
    }),
    ...(birthDate ? { birthDate } : {}),
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
    inflowSource: row.inflowSource.trim() || null,
    referrerName: row.referrerName.trim() || null,
    businessInfo: isCustomerBusinessInfoFormEmpty(businessInfo) ? null : businessInfo,
    notes: {
      items: noteItems,
      insuranceHistory,
    },
  }
}

/**
 * 파싱 → 필수값 검증·제외 집계 → 중복 병합 → 업로드용 페이로드.
 * UI 미리보기·제외/실패 다운로드에 사용한다.
 */
export async function prepareCustomerExcelImport(file: File): Promise<CustomerExcelPrepareResult> {
  const parsed = await parseExcel(file)
  const totalSheetRows = parsed.length
  const excludedRows: PreparedExcludedRow[] = []
  const valid: CustomerExcelParsedRow[] = []

  parsed.forEach((row, idx) => {
    const excelRow = idx + 2
    const norm = normalizeSsn(row.ssn)
    if (isInvalidSsnFormat(row.ssn)) {
      excludedRows.push({
        excelRow,
        category: 'invalid_ssn',
        reason: `주민번호 ${norm.length}자리 (13자리 필요)`,
        values: parsedRowToExportRecord(row),
      })
      return
    }
    const name = row.name.trim()
    if (!name) {
      excludedRows.push({
        excelRow,
        category: 'missing_name',
        reason: '이름 없음',
        values: parsedRowToExportRecord(row),
      })
      return
    }
    if (!satisfiesCustomerExcelUploadRequiredFields({ name, phone: row.phone, ssn: row.ssn })) {
      excludedRows.push({
        excelRow,
        category: 'other',
        reason: CUSTOMER_EXCEL_UPLOAD_REQUIRED_FIELD_MESSAGE,
        values: parsedRowToExportRecord(row),
      })
      return
    }
    valid.push({
      ...row,
      name,
      ssn: normalizeOptionalSsn(row.ssn),
      phone: row.phone.trim(),
    })
  })

  const { duplicateMergeGroupCount, mergedAbsorbedRowCount } = duplicateMergeMetrics(valid)
  const merged = mergeRowsForImport(valid)
  const payloads: SaveCustomerPayload[] = []

  for (const m of merged) {
    const p = transformRow(m)
    if (p) {
      payloads.push(p)
    } else {
      const reason = getCustomerExcelRowTransformError(m) ?? CUSTOMER_EXCEL_UPLOAD_REQUIRED_FIELD_MESSAGE
      excludedRows.push({
        excelRow: 0,
        category: 'other',
        reason,
        values: parsedRowToExportRecord(m),
      })
    }
  }

  const skippedInvalidSsnCount = excludedRows.filter((r) => r.category === 'invalid_ssn').length
  const skippedOtherCount = excludedRows.length - skippedInvalidSsnCount

  return {
    payloads,
    excludedRows,
    stats: {
      totalSheetRows,
      skippedInvalidSsnCount,
      skippedOtherCount,
      mergedAbsorbedRowCount,
      duplicateMergeGroupCount,
      uploadReadyCount: payloads.length,
    },
  }
}

/** 테스트·round-trip용 샘플 시트 AOA (한글 헤더 1행 + 예시 2행) */
export function buildCustomerExcelSampleSheetAoA(): string[][] {
  const row1 = CUSTOMER_EXCEL_SAMPLE_HEADERS.map((key) => {
    const samples: Partial<Record<CustomerExcelColumnKey, string>> = {
      name: '홍길동',
      phone: '010-1234-5678',
      ssn: '800101-1234567',
      birthDate: '1980-01-01',
      gender: '남',
      address: '서울특별시 광진구 능동로 120',
      addressDetail: '101동 1001호',
      job: '자영업',
      memo: '지인 소개 / 상담 예약',
      businessRepresentativeName: '홍길동',
      businessNumber: '123-45-67890',
      businessAddress: '서울특별시 광진구',
      businessAddressDetail: '카페 1층',
      businessMemo: '주말 휴무',
    }
    return samples[key] ?? ''
  })
  const row2 = CUSTOMER_EXCEL_SAMPLE_HEADERS.map((key) => {
    const samples: Partial<Record<CustomerExcelColumnKey, string>> = {
      name: '김영희',
      phone: '01098765432',
      birthDate: '1990-02-02',
      gender: '여',
      job: '회사원',
      memo: '보험 상담 예약',
    }
    return samples[key] ?? ''
  })
  return [[...CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO], row1, row2]
}

export function downloadCustomerUploadSampleXlsx(): void {
  const sheet1 = XLSX.utils.aoa_to_sheet(buildCustomerExcelSampleSheetAoA())
  const descHeader = ['컬럼', '설명']
  const descRows: [string, string][] = CUSTOMER_EXCEL_PRIMARY_COLUMNS.map((c) => [c.labelKo, c.description])
  descRows.push([
    '라벨(미지원)',
    '고객 라벨·맞춤 필드는 일괄등록 Excel에서 자동 생성하지 않습니다. 등록 후 화면에서 추가해 주세요.',
  ])
  descRows.push([
    '화재보험 소재지(미지원)',
    '화재보험 소재지는 등록 후 고객 상세에서 추가합니다.',
  ])
  const sheet2 = XLSX.utils.aoa_to_sheet([descHeader, ...descRows])
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
  const failedPayloads: SaveCustomerPayload[] = []
  let success = 0
  const total = payloads.length
  let done = 0

  for (const payload of payloads) {
    try {
      await saveCustomer(token, payload)
      success += 1
    } catch (e: unknown) {
      // 한 건 실패해도 루프는 계속 진행한다.
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.'
      failures.push({
        name: payload.name,
        ssn: String(payload.ssn ?? ''),
        phone: String(payload.phone ?? ''),
        message,
      })
      failedPayloads.push(payload)
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
    failedPayloads,
  }
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 주민번호 오류·이름 누락 등 제외 행 엑셀 저장 */
export function downloadExcludedRowsExcel(
  rows: PreparedExcludedRow[],
  baseFilename = 'customer-upload-excluded',
): void {
  if (rows.length === 0) {
    return
  }
  const headers = ['excelRow', 'category', 'reason', ...CUSTOMER_EXCEL_UPLOAD_HEADERS]
  const dataRows = rows.map((r) => [
    r.excelRow,
    r.category,
    r.reason,
    ...CUSTOMER_EXCEL_UPLOAD_HEADERS.map((h) => r.values[h] ?? ''),
  ])
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  sheet['!cols'] = headers.map(() => ({ wch: 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '제외데이터')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
  saveAs(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${baseFilename}_${todayYmd()}.xlsx`,
  )
}

/** API 저장 실패 건 — 업로드 템플릿 형식 + 오류 메시지 */
export function downloadFailedApiRowsExcel(
  failedPayloads: SaveCustomerPayload[],
  failures: CustomerUploadFailure[],
  baseFilename = 'customer-upload-api-failed',
): void {
  if (failedPayloads.length === 0) {
    return
  }
  const headers = [...CUSTOMER_EXCEL_UPLOAD_HEADERS, 'errorMessage']
  const dataRows = failedPayloads.map((p, i) => {
    const rec = payloadToExportRecord(p)
    const row = CUSTOMER_EXCEL_UPLOAD_HEADERS.map((h) => rec[h] ?? '')
    const msg = failures[i]?.message ?? ''
    return [...row, msg]
  })
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  sheet['!cols'] = headers.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '실패데이터')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
  saveAs(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${baseFilename}_${todayYmd()}.xlsx`,
  )
}

export function downloadFailedPayloadsJson(
  failedPayloads: SaveCustomerPayload[],
  baseFilename = 'customer-upload-api-failed',
): void {
  if (failedPayloads.length === 0) {
    return
  }
  const text = JSON.stringify(failedPayloads, null, 2)
  saveAs(
    new Blob([text], { type: 'application/json;charset=utf-8' }),
    `${baseFilename}_${todayYmd()}.json`,
  )
}

/** 파싱 → 주민번호 병합 → 페이로드 (스킵 행 제외) — prepare 결과의 payloads만 반환 */
export async function parseExcelToPayloads(file: File): Promise<SaveCustomerPayload[]> {
  const prep = await prepareCustomerExcelImport(file)
  return prep.payloads
}
