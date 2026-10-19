import { describe, expect, it } from 'vitest'
import { emptyAddressSearchValue } from '../../../components/form/addressSearchUtils'
import {
  advisorOfficeAddressFromProfile,
  advisorOfficeColumnsFromAddress,
  buildAdvisorOfficeDisplayLine,
} from './advisorOfficeAddress'

describe('advisor office address mapping', () => {
  it('round-trips search base address and typed detail into separate columns', () => {
    const form = advisorOfficeAddressFromProfile({
      office_postal_code: '04524',
      office_road_address: '서울특별시 중구 세종대로 110',
      office_address_detail: '12층',
      office_address_sido: '서울특별시',
      office_address_sigungu: '중구',
    })
    expect(form).toMatchObject({
      zonecode: '04524',
      baseAddress: '서울특별시 중구 세종대로 110',
      detailAddress: '12층',
      sido: '서울특별시',
      sigungu: '중구',
    })
    expect(advisorOfficeColumnsFromAddress(form)).toEqual({
      office_postal_code: '04524',
      office_road_address: '서울특별시 중구 세종대로 110',
      office_address_detail: '12층',
      office_address_sido: '서울특별시',
      office_address_sigungu: '중구',
    })
    expect(buildAdvisorOfficeDisplayLine(form)).toBe('서울특별시 중구 세종대로 110 12층')
  })

  it('keeps a detail-only address visible', () => {
    const form = advisorOfficeAddressFromProfile({
      office_address_detail: '강남빌딩 3층',
    })
    expect(form.baseAddress).toBe('')
    expect(form.detailAddress).toBe('강남빌딩 3층')
    expect(buildAdvisorOfficeDisplayLine(form)).toBe('강남빌딩 3층')
  })
})

describe('office address clear (주소 지우기)', () => {
  it('saves empty strings for every office column after clearing a loaded address', () => {
    const loaded = advisorOfficeAddressFromProfile({
      office_postal_code: '04524',
      office_road_address: '서울 중구 세종대로 110 (서울특별시청)',
      office_address_detail: '3층 301호',
      office_address_sido: '서울',
      office_address_sigungu: '중구',
    })
    expect(buildAdvisorOfficeDisplayLine(loaded)).not.toBe('')

    const cleared = emptyAddressSearchValue()
    expect(advisorOfficeColumnsFromAddress(cleared)).toEqual({
      office_postal_code: '',
      office_road_address: '',
      office_address_detail: '',
      office_address_sido: '',
      office_address_sigungu: '',
    })
    expect(buildAdvisorOfficeDisplayLine(cleared)).toBe('')
  })

  it('the clear payload sends every office key (never undefined), so the server overwrites them', () => {
    const payload = advisorOfficeColumnsFromAddress(emptyAddressSearchValue())
    for (const key of [
      'office_postal_code',
      'office_road_address',
      'office_address_detail',
      'office_address_sido',
      'office_address_sigungu',
    ] as const) {
      expect(Object.prototype.hasOwnProperty.call(payload, key)).toBe(true)
      expect(payload[key]).toBe('')
    }
  })
})

