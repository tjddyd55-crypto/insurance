import { describe, expect, it, vi, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({
  listCustomerCars: vi.fn(),
  createCustomerCar: vi.fn(),
  updateCustomerCar: vi.fn(),
  deleteCustomerCar: vi.fn(),
}))
vi.mock('../api/customerCarsApi', () => api)

import { customerCarRecordToFormItem, saveCustomerCarsForCustomer } from './customerCarsSaveUtils'
import { createEmptyCustomerCar, isCustomerCarEmpty } from './customerCarFormUtils'

const rec = {
  id: 5,
  customerId: 9,
  carType: '',
  carNumber: '12가3456',
  carModel: '그랜저',
  carYear: '2022',
  renewalDate: '2027-01-02',
  memo: '',
  isPrimary: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
}

describe('자동차 정보 보험회사 (free text)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset()
  })

  it('legacy record without insuranceCompany loads as empty string', () => {
    expect(customerCarRecordToFormItem(rec).insuranceCompany).toBe('')
    expect(customerCarRecordToFormItem({ ...rec, insuranceCompany: '삼성화재' }).insuranceCompany).toBe('삼성화재')
  })

  it('empty car stays empty; insuranceCompany alone makes it non-empty', () => {
    expect(createEmptyCustomerCar().insuranceCompany).toBe('')
    expect(isCustomerCarEmpty(createEmptyCustomerCar())).toBe(true)
    expect(isCustomerCarEmpty({ ...createEmptyCustomerCar(), insuranceCompany: '삼성화재' })).toBe(false)
  })

  it('changing only insuranceCompany triggers a PATCH carrying the trimmed value', async () => {
    api.listCustomerCars.mockResolvedValue([{ ...rec, insuranceCompany: '삼성화재' }])
    const form = { ...customerCarRecordToFormItem({ ...rec, insuranceCompany: '삼성화재' }), insuranceCompany: ' 현대해상 ' }
    await saveCustomerCarsForCustomer({ token: 't', customerId: 9, formCars: [form] })
    expect(api.updateCustomerCar).toHaveBeenCalledTimes(1)
    expect(api.updateCustomerCar.mock.calls[0][3]).toMatchObject({ insuranceCompany: '현대해상', carNumber: '12가3456' })
  })

  it('unchanged insuranceCompany does not PATCH; clearing sends empty string', async () => {
    api.listCustomerCars.mockResolvedValue([{ ...rec, insuranceCompany: '삼성화재' }])
    await saveCustomerCarsForCustomer({
      token: 't',
      customerId: 9,
      formCars: [customerCarRecordToFormItem({ ...rec, insuranceCompany: '삼성화재' })],
    })
    expect(api.updateCustomerCar).not.toHaveBeenCalled()

    await saveCustomerCarsForCustomer({
      token: 't',
      customerId: 9,
      formCars: [{ ...customerCarRecordToFormItem({ ...rec, insuranceCompany: '삼성화재' }), insuranceCompany: '' }],
    })
    expect(api.updateCustomerCar.mock.calls[0][3]).toMatchObject({ insuranceCompany: '' })
  })
})
