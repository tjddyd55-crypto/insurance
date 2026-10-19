import { describe, expect, it } from 'vitest'
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
