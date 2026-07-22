import { describe, expect, it } from 'vitest'
import type { CustomerMapListItem } from '../api/customerMapApi'
import {
  canRecenterToKnownMapCustomer,
  findMapCustomerById,
  isValidMapCustomerPosition,
  mergeFocusCustomerIntoVisible,
  mergeKnownMapCustomers,
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

describe('mergeKnownMapCustomers', () => {
  it('keeps previously known customers when current viewport list drops them', () => {
    const known = [marker({ id: 190, latitude: 37.1, longitude: 127.1 })]
    const visibleOnly = [marker({ id: 200, latitude: 37.2, longitude: 127.2 })]
    const merged = mergeKnownMapCustomers(known, visibleOnly)
    expect(findMapCustomerById(merged, 190)?.latitude).toBe(37.1)
    expect(findMapCustomerById(merged, 200)?.id).toBe(200)
  })
})

describe('canRecenterToKnownMapCustomer', () => {
  it('stays true when customer is outside current visible markers', () => {
    const known = [marker({ id: 190 })]
    const visible: CustomerMapListItem[] = []
    expect(
      canRecenterToKnownMapCustomer({ targetId: '190', knownMapCustomers: known }),
    ).toBe(true)
    expect(
      canRecenterToKnownMapCustomer({ targetId: 190, knownMapCustomers: visible }),
    ).toBe(false)
  })

  it('is false when coordinates are missing', () => {
    expect(
      canRecenterToKnownMapCustomer({
        targetId: 190,
        knownMapCustomers: [marker({ id: 190, latitude: Number.NaN })],
      }),
    ).toBe(false)
  })

  it('does not depend on bounds/visible list when known has coords', () => {
    const knownAfterPanAway = mergeKnownMapCustomers(
      [marker({ id: 190 })],
      [marker({ id: 999 })],
    )
    expect(
      canRecenterToKnownMapCustomer({
        targetId: '190',
        knownMapCustomers: knownAfterPanAway,
      }),
    ).toBe(true)
  })
})

describe('mergeFocusCustomerIntoVisible', () => {
  it('adds focus customer when missing from bounds result', () => {
    const visible = [marker({ id: 1 })]
    const focus = marker({ id: 190, latitude: 37.5665, longitude: 126.978 })
    const merged = mergeFocusCustomerIntoVisible(visible, focus)
    expect(findMapCustomerById(merged, 190)?.id).toBe(190)
    expect(merged).toHaveLength(2)
  })

  it('does not duplicate focus customer already in visible list', () => {
    const visible = [marker({ id: 190 })]
    const merged = mergeFocusCustomerIntoVisible(visible, marker({ id: 190 }))
    expect(merged).toHaveLength(1)
  })
})
