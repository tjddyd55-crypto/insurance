import { describe, expect, it } from 'vitest'
import { isGaStaffAllowedPath, isGaStaffBlockedAdminPath } from './gaStaffPathPolicy'

describe('gaStaffPathPolicy', () => {
  it('STEP allowlist 4개 경로만 허용한다', () => {
    expect(isGaStaffAllowedPath('/insurance/company-registry')).toBe(true)
    expect(isGaStaffAllowedPath('/insurance/contacts')).toBe(true)
    expect(isGaStaffAllowedPath('/insurance/account-credentials/shared')).toBe(true)
    expect(isGaStaffAllowedPath('/insurance/account-credentials/shared/user-1')).toBe(true)
    expect(isGaStaffAllowedPath('/feature-request')).toBe(true)
  })

  it('STEP allowlist 밖 경로는 차단한다', () => {
    expect(isGaStaffBlockedAdminPath('/insurance/history')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/admin/users')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/ga-admin/workspace')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/insurer-managers')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/customers')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/insurance/insurer-sites')).toBe(true)
    expect(isGaStaffBlockedAdminPath('/contracts/send')).toBe(true)
  })
})
