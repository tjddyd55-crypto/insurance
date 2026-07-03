import { describe, expect, it } from 'vitest'
import { canDeleteNewsletter, isGaAdminNewsletterRole } from './newsletterDeletePermission'

describe('canDeleteNewsletter', () => {
  it('GA 관리자 role 은 작성자가 아니어도 삭제 버튼 노출', () => {
    for (const role of ['SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF'] as const) {
      expect(canDeleteNewsletter({ publisherId: 'other' }, { id: 'admin-1', role })).toBe(true)
    }
  })

  it('작성자 본인은 일반 role 이어도 삭제 가능', () => {
    expect(canDeleteNewsletter({ publisherId: 'w9' }, { id: 'w9', role: 'INSURER_MANAGER' })).toBe(true)
    expect(canDeleteNewsletter({ publisherId: 'w9' }, { id: 'w9', role: 'USER' })).toBe(true)
  })

  it('작성자가 아닌 일반 사용자는 삭제 불가', () => {
    expect(canDeleteNewsletter({ publisherId: 'w9' }, { id: 'u2', role: 'USER' })).toBe(false)
    expect(canDeleteNewsletter({ publisherId: 'w9' }, { id: 'm2', role: 'INSURER_MANAGER' })).toBe(false)
  })

  it('user 가 없거나 publisherId 가 비면 관리자만 삭제 가능', () => {
    expect(canDeleteNewsletter({ publisherId: 'x' }, null)).toBe(false)
    expect(canDeleteNewsletter({ publisherId: '' }, { id: 'u1', role: 'USER' })).toBe(false)
    expect(canDeleteNewsletter({ publisherId: '' }, { id: 'u1', role: 'GA_ADMIN' })).toBe(true)
  })

  it('isGaAdminNewsletterRole 는 관리자 role 만 true', () => {
    expect(isGaAdminNewsletterRole('GA_ADMIN')).toBe(true)
    expect(isGaAdminNewsletterRole('USER')).toBe(false)
    expect(isGaAdminNewsletterRole(undefined)).toBe(false)
  })
})
