import { describe, expect, it } from 'vitest'
import { isGaStaffBlockedAdminPath } from './gaStaffPathPolicy'

describe('gaStaffPathPolicy', () => {
  it('STEP 에서 관리·설정 admin path 를 차단한다', () => {
    expect(isGaStaffBlockedAdminPath('/admin/claim/insurance-companies')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/admin/pdf-templates')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/admin/newsletter-boards')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/ga-admin/workspace')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/admin/delegates')).toBe(true)
  })

  it('STEP 실무 path 는 허용한다', () => {
    expect(isGaStaffBlockedAdminPath('/insurance/company-registry')).toBe(false)
    expect(isGaStaffBlockedAdminPath('/insurance/account-credentials/shared')).toBe(false)
    expect(isGaStaffBlockedAdminPath('/customers')).toBe(false)
  })
})
