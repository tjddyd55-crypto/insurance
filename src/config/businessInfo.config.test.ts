import { describe, expect, it } from 'vitest'
import {
  businessInfo,
  formatBusinessRegistrationForFtc,
  formatPhoneForTelLink,
  getFtcBusinessVerificationUrl,
} from './businessInfo.config'

describe('businessInfo SSOT', () => {
  it('uses the new business registration profile', () => {
    expect(businessInfo.businessName).toBe('올인원솔루션')
    expect(businessInfo.representativeName).toBe('박성용')
    expect(businessInfo.businessRegistrationNumber).toBe('232-51-00991')
    expect(businessInfo.businessAddress).toBe('서울특별시 광진구 천호대로114길 39 (능동)')
    expect(businessInfo.businessEmail).toBe('tjddyd55@naver.com')
    expect(businessInfo.privacyOfficerName).toBe('박성용')
    expect(businessInfo.privacyOfficerPhone).toBe('010-2222-1382')
  })

  it('does not retain legacy business identifiers', () => {
    const serialized = JSON.stringify(businessInfo)
    expect(serialized).not.toContain('팍스미디어')
    expect(serialized).not.toContain('540-99-01608')
  })

  it('exposes confirmed mail-order registration number', () => {
    expect(businessInfo.mailOrderRegistrationNumber).toBe('제 2026-서울광진-1256 호')
    expect(businessInfo.hostingProviderName).toBeNull()
  })

  it('builds FTC verification and contact links from SSOT', () => {
    expect(formatBusinessRegistrationForFtc(businessInfo.businessRegistrationNumber)).toBe('2325100991')
    expect(getFtcBusinessVerificationUrl()).toBe(
      'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2325100991',
    )
    expect(formatPhoneForTelLink(businessInfo.privacyOfficerPhone)).toBe('01022221382')
  })
})
