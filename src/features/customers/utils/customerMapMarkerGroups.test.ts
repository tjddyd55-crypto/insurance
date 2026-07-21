import { describe, expect, it } from 'vitest'
import type { CustomerMapListItem } from '../api/customerMapApi'
import {
  buildCoordinateGroupKey,
  buildGroupMarkerLabel,
  findMarkerGroupByCustomerId,
  groupMapCustomersByCoordinate,
} from './customerMapMarkerGroups'

function makeCustomer(
  id: number,
  lat: number,
  lng: number,
  name = `고객${id}`,
): CustomerMapListItem {
  return {
    id,
    markerNo: id,
    name,
    phone: '010-1234-5678',
    address: '서울시 테스트구',
    birthDateYmd: '1990-01-02',
    genderLabel: '남',
    latitude: lat,
    longitude: lng,
    lastConsultDate: null,
  }
}

describe('buildCoordinateGroupKey', () => {
  it('normalizes coordinates to 6 decimal places', () => {
    expect(buildCoordinateGroupKey(37.56651234, 126.97801234)).toBe('37.566512,126.978012')
  })
})

describe('groupMapCustomersByCoordinate', () => {
  it('groups customers with identical coordinates', () => {
    const groups = groupMapCustomersByCoordinate([
      makeCustomer(1, 37.5, 127.0, '김도훈'),
      makeCustomer(2, 37.5, 127.0, '김가족'),
      makeCustomer(3, 37.6, 127.1, '이단독'),
    ])
    expect(groups).toHaveLength(2)
    const shared = groups.find((group) => group.count === 2)
    expect(shared?.customers.map((c) => c.id)).toEqual([1, 2])
  })
})

describe('buildGroupMarkerLabel', () => {
  it('shows single customer name', () => {
    expect(buildGroupMarkerLabel([makeCustomer(1, 37.5, 127.0, '김도훈')])).toBe('김도훈')
  })

  it('shows count label for groups', () => {
    expect(
      buildGroupMarkerLabel([
        makeCustomer(1, 37.5, 127.0, '김도훈'),
        makeCustomer(2, 37.5, 127.0, '김가족'),
        makeCustomer(3, 37.5, 127.0, '김기타'),
      ]),
    ).toBe('김도훈 외 2명')
  })

  it('finds group by string or number customer id', () => {
    const groups = groupMapCustomersByCoordinate([
      makeCustomer(556, 37.5, 127.0),
      makeCustomer(2, 37.6, 127.1),
    ])
    expect(findMarkerGroupByCustomerId(groups, '556')?.customers[0]?.id).toBe(556)
  })
})

describe('findMarkerGroupByCustomerId', () => {
  it('finds the group containing the customer', () => {
    const groups = groupMapCustomersByCoordinate([
      makeCustomer(1, 37.5, 127.0),
      makeCustomer(2, 37.5, 127.0),
    ])
    expect(findMarkerGroupByCustomerId(groups, 2)?.groupKey).toBe(groups[0]?.groupKey)
  })
})
