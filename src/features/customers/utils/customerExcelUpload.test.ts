import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SaveCustomerPayload } from '../api/customersApi'
import type { CustomerExcelParsedRow } from './customerExcelUpload'
import {
  getCustomerExcelRowMergeKey,
  mergeRowsForImport,
  transformRow,
  uploadCustomers,
} from './customerExcelUpload'

const { saveCustomerMock } = vi.hoisted(() => ({
  saveCustomerMock: vi.fn<(_token: string, _payload: SaveCustomerPayload) => Promise<void>>(),
}))

vi.mock('../api/customersApi', () => ({
  saveCustomer: saveCustomerMock,
}))

const panelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/CustomerExcelImportPanel.tsx'),
  'utf8',
)

function makeParsedRow(overrides: Partial<CustomerExcelParsedRow> = {}): CustomerExcelParsedRow {
  return {
    name: '홍길동',
    ssn: '8001011234567',
    genderRaw: 'male',
    phone: '01012345678',
    address: '',
    height: '',
    weight: '',
    job: '',
    isDriver: null,
    carType: '',
    medical: '',
    carNumber: '',
    carModel: '',
    carYear: '',
    renewalDate: '',
    insuranceHistory: '',
    memoRaw: '',
    ...overrides,
  }
}

function makePayload(index: number, withSsn = true): SaveCustomerPayload {
  const suffix = String(index).padStart(6, '0')
  return {
    name: `고객${index}`,
    ssn: withSsn ? `9001011${suffix.slice(-6)}` : '',
    gender: 'male',
    phone: `010${suffix.slice(-8)}`,
    address: '',
    height: '',
    weight: '',
    job: '',
    driving: '',
    carType: '',
    carNumber: '',
    carModel: '',
    carYear: '',
    renewalDate: '',
    medical: '',
    insuranceHistory: '',
    notes: [],
  }
}

describe('customerExcelUpload import policy', () => {
  beforeEach(() => {
    saveCustomerMock.mockReset()
    saveCustomerMock.mockResolvedValue(undefined)
  })

  it('does not export a user-facing max batch constant', async () => {
    const mod = await import('./customerExcelUpload')
    expect(mod).not.toHaveProperty('CUSTOMER_EXCEL_UPLOAD_MAX_BATCH')
  })

  it('CustomerExcelImportPanel does not block uploads over 300 rows', () => {
    expect(panelSource).not.toContain('CUSTOMER_EXCEL_UPLOAD_MAX_BATCH')
    expect(panelSource).not.toMatch(/300건/)
    expect(panelSource).not.toMatch(/나누어 업로드/)
  })

  it('transformRow accepts name + phone + ssn', () => {
    const payload = transformRow(makeParsedRow())
    expect(payload).not.toBeNull()
    expect(payload?.name).toBe('홍길동')
    expect(payload?.ssn).toBe('8001011234567')
    expect(payload?.phone).toBe('01012345678')
  })

  it('transformRow accepts name + phone without ssn', () => {
    const payload = transformRow(makeParsedRow({ ssn: '' }))
    expect(payload).not.toBeNull()
    expect(payload?.ssn).toBe('')
    expect(payload?.phone).toBe('01012345678')
  })

  it('transformRow rejects missing name', () => {
    expect(transformRow(makeParsedRow({ name: '  ' }))).toBeNull()
  })

  it('transformRow rejects missing phone', () => {
    expect(transformRow(makeParsedRow({ phone: '' }))).toBeNull()
    expect(transformRow(makeParsedRow({ phone: '010' }))).toBeNull()
  })

  it('merge key prefers ssn when present', () => {
    expect(getCustomerExcelRowMergeKey(makeParsedRow())).toBe('ssn:8001011234567')
  })

  it('merge key uses name + phone when ssn absent', () => {
    expect(getCustomerExcelRowMergeKey(makeParsedRow({ ssn: '' }))).toBe('phone:01012345678:홍길동')
  })

  it('mergeRowsForImport merges duplicate phone rows without ssn', () => {
    const merged = mergeRowsForImport([
      makeParsedRow({ ssn: '', memoRaw: '첫 메모' }),
      makeParsedRow({ ssn: '', address: '서울', memoRaw: '둘째 메모' }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.address).toBe('서울')
    expect(merged[0]?.memoRaw).toContain('첫 메모')
  })

  it.each([299, 300, 301, 1000])('uploadCustomers processes all %i rows without row cap', async (count) => {
    const payloads = Array.from({ length: count }, (_, i) => makePayload(i + 1, i % 2 === 0))
    const progress: Array<{ done: number; total: number }> = []

    const result = await uploadCustomers('token', payloads, (done, total) => {
      progress.push({ done, total })
    })

    expect(saveCustomerMock).toHaveBeenCalledTimes(count)
    expect(result.total).toBe(count)
    expect(result.success).toBe(count)
    expect(result.failed).toBe(0)
    expect(progress.at(-1)).toEqual({ done: count, total: count })
  })

  it('uploadCustomers sends empty ssn when omitted', async () => {
    await uploadCustomers('token', [makePayload(1, false)])
    expect(saveCustomerMock).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ name: '고객1', ssn: '', phone: expect.any(String) }),
    )
  })
})
