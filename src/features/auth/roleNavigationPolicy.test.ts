import { describe, expect, it } from 'vitest'

import { GA_ADMIN_LANDING_PATH, resolveAuthLandingPath } from './landing'
import { isGaAdminAllowedPath } from './gaAdminPathPolicy'
import {
  canManageGaBoardWriters,
  canUseNewsletterBoardAdminRoutes,
  canAccessUserCrmWorkspace,
} from './roleGuards'

describe('resolveAuthLandingPath — 역할별 랜딩', () => {
  it('GA_ADMIN 은 보험청구 설정으로 진입한다', () => {
    expect(resolveAuthLandingPath(false, 'GA_ADMIN')).toBe(GA_ADMIN_LANDING_PATH)
    expect(resolveAuthLandingPath(true, 'GA_ADMIN')).toBe(GA_ADMIN_LANDING_PATH)
  })

  it('USER / GA_STAFF / SUPER_ADMIN 기존 랜딩을 유지한다', () => {
    expect(resolveAuthLandingPath(false, 'USER')).toBe('/customers')
    expect(resolveAuthLandingPath(true, 'USER')).toBe('/dashboard')
    expect(resolveAuthLandingPath(false, 'GA_STAFF')).toBe('/insurance/company-registry')
    expect(resolveAuthLandingPath(false, 'SUPER_ADMIN')).toBe('/dashboard')
  })
})

describe('gaAdminPathPolicy', () => {
  it('관리 path 만 허용한다', () => {
    expect(isGaAdminAllowedPath('/admin/claim/insurance-companies')).toBe(true)
    expect(isGaAdminAllowedPath('/admin/newsletter-boards')).toBe(true)
    expect(isGaAdminAllowedPath('/admin/audit-logs')).toBe(true)
    expect(isGaAdminAllowedPath('/profile')).toBe(true)
    expect(isGaAdminAllowedPath('/dashboard')).toBe(true)
  })

  it('일반 CRM path 는 차단한다', () => {
    expect(isGaAdminAllowedPath('/customers')).toBe(false)
    expect(isGaAdminAllowedPath('/todos')).toBe(false)
    expect(isGaAdminAllowedPath('/ta-call')).toBe(false)
    expect(isGaAdminAllowedPath('/application/documents')).toBe(false)
    expect(isGaAdminAllowedPath('/insurance/company-registry')).toBe(false)
    expect(isGaAdminAllowedPath('/sms/settings')).toBe(false)
  })
})

describe('roleGuards — 소식지 관리 / CRM', () => {
  it('소식지·작성자 관리는 SUPER_ADMIN·GA_ADMIN 만', () => {
    expect(canUseNewsletterBoardAdminRoutes('SUPER_ADMIN')).toBe(true)
    expect(canUseNewsletterBoardAdminRoutes('GA_ADMIN')).toBe(true)
    expect(canUseNewsletterBoardAdminRoutes('GA_STAFF')).toBe(false)
    expect(canUseNewsletterBoardAdminRoutes('USER')).toBe(false)
    expect(canManageGaBoardWriters('GA_STAFF')).toBe(false)
    expect(canManageGaBoardWriters('GA_ADMIN')).toBe(true)
  })

  it('USER CRM 워크스페이스는 USER 만', () => {
    expect(canAccessUserCrmWorkspace('USER')).toBe(true)
    expect(canAccessUserCrmWorkspace('GA_ADMIN')).toBe(false)
    expect(canAccessUserCrmWorkspace('GA_STAFF')).toBe(false)
  })
})
