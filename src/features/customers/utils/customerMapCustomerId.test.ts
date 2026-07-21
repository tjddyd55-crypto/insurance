import { describe, expect, it } from 'vitest'
import type { CustomerMapListItem } from '../api/customerMapApi'
import {
  findMapCustomerById,
  isValidMapCustomerPosition,
  sameCustomerMapId,
} from './customerMapCustomerId'

function marker(partial: Partial<CustomerMapListItem> & { id: number }): CustomerMapListItem {
  return {
    markerNo: 1,
    name: '테스트',
    phone: '',
    address: '',
    birthDateYmd: '',
    genderLabel: '-',
    latitude: 37.5,
    longitude: 127.0,
    lastConsultDate: null,
    ...partial,
  }
}

describe('sameCustomerMapId', () => {
  it('treats string and number ids as equal', () => {
    expect(sameCustomerMapId(556, '556')).toBe(true)
    expect(sameCustomerMapId('556', 556)).toBe(true)
  })

  it('rejects invalid ids', () => {
    expect(sameCustomerMapId(0, 0)).toBe(false)
    expect(sameCustomerMapId('abc', 1)).toBe(false)
  })
})

describe('findMapCustomerById', () => {
  it('finds marker when selected id is a string and marker id is a number', () => {
    const rows = [marker({ id: 556 })]
    expect(findMapCustomerById(rows, '556')?.id).toBe(556)
  })
})

describe('isValidMapCustomerPosition', () => {
  it('requires finite latitude and longitude', () => {
    expect(isValidMapCustomerPosition(marker({ id: 1 }))).toBe(true)
    expect(isValidMapCustomerPosition(marker({ id: 1, latitude: Number.NaN }))).toBe(false)
    expect(isValidMapCustomerPosition(null)).toBe(false)
  })
})
