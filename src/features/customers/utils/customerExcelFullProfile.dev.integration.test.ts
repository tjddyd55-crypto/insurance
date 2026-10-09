import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_EXCEL_SHEET_BASIC,
  CUSTOMER_EXCEL_SHEET_CARS,
  CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS,
  CUSTOMER_EXCEL_SHEET_FIRE,
  CUSTOMER_EXCEL_SHEET_SPECIAL_DATES,
} from '../config/customerExcelFullProfileSsot'
import { buildCustomerExcelSampleSheetAoA, prepareCustomerExcelImport, uploadCustomers } from './customerExcelUpload'

const DEV_BASE = String(process.env.DEV_EXCEL_INTEGRATION_BASE ?? 'https://insurance-dev.up.railway.app').replace(
  /\/$/,
  '',
)
const DEV_USER = String(process.env.DEV_EXCEL_INTEGRATION_USER ?? '').trim()
const DEV_PASS = String(process.env.DEV_EXCEL_INTEGRATION_PASSWORD ?? '').trim()
const enabled = process.env.DEV_EXCEL_INTEGRATION === '1' && DEV_USER && DEV_PASS

function buildDevWorkbookBuffer(suffix: string): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const basic = buildCustomerExcelSampleSheetAoA()
  basic[1] = basic[1]!.map((v, i) => {
    const h = basic[0]![i]
    if (h === '이름') return `테스트풀고객${suffix}`
    if (h === '휴대폰') return `01077${suffix}`
    if (h === '생년월일') return '1980-01-01'
    if (h === '성별') return '남'
    if (h === '키') return '175'
    if (h === '몸무게') return '72'
    if (h === '수술치료병력') return 'DEV surgery'
    if (h === '약복용병력') return 'DEV meds'
    if (h === '보험가입내역') return 'DEV ins'
    if (h === '계좌번호') return '110-000'
    if (h === '운전여부') return 'Y'
    return v
  })
  basic[2] = basic[2]!.map((v, i) => {
    const h = basic[0]![i]
    if (h === '이름') return `테스트최소여${suffix}`
    if (h === '휴대폰') return `01088${suffix}`
    if (h === '생년월일') return '1985-01-01'
    if (h === '성별') return '여'
    return v
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(basic), CUSTOMER_EXCEL_SHEET_BASIC)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '차량번호', '차종(차명)', '연식', '갱신일', '자동차종류', '차량메모', '대표차량(Y/N)'],
      ['C001', '11가1111', 'A', '2019', '2026-01-01', '승용', 'c1', 'Y'],
      ['C001', '22나2222', 'B', '2018', '2025-01-01', '승합', 'c2', 'N'],
    ]),
    CUSTOMER_EXCEL_SHEET_CARS,
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '알림유형', '알림이름', '날짜', '메모'],
      ['C001', '축하', '생일', '1980-01-01', 'sd1'],
      ['C001', '안내', '안내', '2026-12-01', 'sd2'],
    ]),
    CUSTOMER_EXCEL_SHEET_SPECIAL_DATES,
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '라벨', '입력값'],
      ['C001', 'VIP', 'v1'],
      ['C001', 'REGION', 'v2'],
    ]),
    CUSTOMER_EXCEL_SHEET_CUSTOM_FIELDS,
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['고객번호', '소재지주소', '메모'],
      ['C001', 'addr fire 1', 'f1'],
      ['C001', 'addr fire 2', 'f2'],
    ]),
    CUSTOMER_EXCEL_SHEET_FIRE,
  )
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

describe.skipIf(!enabled)('DEV excel full profile integration', () => {
  it(
    'prepare + uploadCustomers against DEV',
    async () => {
      const suffix = String(Date.now()).slice(-6)
      const loginRes = await fetch(`${DEV_BASE}/backend/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: DEV_USER, password: DEV_PASS }),
      })
      const loginJson = await loginRes.json()
      expect(loginRes.ok).toBe(true)
      const token = String(loginJson.token ?? '')
      expect(token.length).toBeGreaterThan(10)

      const buf = buildDevWorkbookBuffer(suffix)
      const file = new File([buf], 'dev-full-profile.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const prep = await prepareCustomerExcelImport(file)
      expect(prep.stats.uploadReadyCount).toBe(2)
      expect(prep.stats.relatedCarRows).toBe(2)
      expect(prep.stats.relatedSpecialDateRows).toBe(2)
      expect(prep.stats.relatedCustomFieldRows).toBe(2)
      expect(prep.stats.relatedFireRows).toBe(2)

      const batch = await uploadCustomers(
        token,
        prep.payloads,
        undefined,
        { importBundles: prep.importBundles, relatedSheets: prep.relatedSheets },
      )
      expect(batch.success).toBe(2)
      expect(batch.relatedFailures.length).toBe(0)
    },
    120_000,
  )
})
