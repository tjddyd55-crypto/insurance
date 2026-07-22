import { describe, expect, it } from 'vitest'
import { CUSTOMER_MAP_FOCUS_ZOOM } from '../config/customerMap.config'
import type { CustomerMapListItem } from '../api/customerMapApi'
import {
  canRecenterToKnownMapCustomer,
  mergeKnownMapCustomers,
} from '../utils/customerMapCustomerId'

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

describe('customer map recenter control', () => {
  it('uses the same focus zoom as menu map focusCustomerId', () => {
    expect(CUSTOMER_MAP_FOCUS_ZOOM).toBe(17)
  })

  it('keeps canRecenter true after bounds change drops customer from visible list', () => {
    const known = mergeKnownMapCustomers(
      [marker({ id: 190 })],
      [marker({ id: 999, latitude: 35, longitude: 129 })],
    )
    expect(
      canRecenterToKnownMapCustomer({
        targetId: '190',
        knownMapCustomers: known,
      }),
    ).toBe(true)
  })
})
