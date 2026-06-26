import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SaveCustomerPayload } from '../api/customersApi'
import { uploadCustomers } from './customerExcelUpload'

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

function makePayload(index: number): SaveCustomerPayload {
  const suffix = String(index).padStart(6, '0')
  return {
    name: `고객${index}`,
    ssn: `9001011${suffix.slice(-6)}`,
    gender: 'male',
    phone: '',
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

describe('customerExcelUpload row limit removal', () => {
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

  it.each([299, 300, 301, 1000])('uploadCustomers processes all %i rows without row cap', async (count) => {
    const payloads = Array.from({ length: count }, (_, i) => makePayload(i + 1))
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
})
