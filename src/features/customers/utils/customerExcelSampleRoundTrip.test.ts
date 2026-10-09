import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO } from '../config/customerExcelUploadColumnSsot'
import {
  buildCustomerExcelSampleSheetAoA,
  mergeRowsForImport,
  parseCustomerExcelArrayBuffer,
  transformRow,
} from './customerExcelUpload'

describe('customer excel sample round-trip', () => {
  it('sample headers use 남/여 and import succeeds', async () => {
    const aoa = buildCustomerExcelSampleSheetAoA()
    expect(aoa[0]).toEqual([...CUSTOMER_EXCEL_SAMPLE_HEADER_LABELS_KO])
    expect(aoa[1]?.includes('남')).toBe(true)
    expect(aoa[2]?.includes('여')).toBe(true)
    expect(aoa[1]?.includes('male')).toBe(false)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '고객기본정보')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const parsed = parseCustomerExcelArrayBuffer(buf)
    const payloads = mergeRowsForImport(parsed)
      .map((row) => transformRow(row))
      .filter((p): p is NonNullable<typeof p> => p != null)
    expect(payloads.length).toBeGreaterThanOrEqual(2)
    expect(payloads[0]?.gender).toBe('male')
    expect(payloads[1]?.gender).toBe('female')
    expect(payloads[0]?.businessInfo?.businessNumber).toContain('123')
  })
})
