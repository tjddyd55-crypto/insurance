import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from './gaTenantMenu'

function linkPaths(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries
    .filter((entry) => entry.type === 'link')
    .map((entry) => (entry.type === 'link' ? entry.path : ''))
}

function linkLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries
    .filter((entry) => entry.type === 'link')
    .map((entry) => (entry.type === 'link' ? entry.label : ''))
}

function sectionLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries
    .filter((entry) => entry.type === 'section')
    .map((entry) => (entry.type === 'section' ? entry.label : ''))
}

describe('buildAppMenuForSession claim access', () => {
  it('groups SUPER_ADMIN menu and exposes admin claim settings only', () => {
    const menu = buildAppMenuForSession('SUPER_ADMIN', undefined, undefined)
    const paths = linkPaths(menu)
    const sections = sectionLabels(menu)

    expect(sections).toContain('사용자 / 조직 관리')
    expect(sections).toContain('결제 / 구독 관리')
    expect(sections).toContain('공지 / 운영 관리')
    expect(sections).toContain('전자문서 / 서명 관리')
    expect(sections).toContain('보험사 / 시스템 설정')

    expect(paths).toContain('/admin/claim/insurance-companies')
    expect(paths.some((path) => path.includes('/insurance-claim'))).toBe(false)
    expect(paths.some((path) => path.includes('/claim-requests'))).toBe(false)
  })

  it('exposes admin claim settings for GA_ADMIN and GA_STAFF but not user claim routes', () => {
    for (const role of ['GA_ADMIN', 'GA_STAFF'] as const) {
      const paths = linkPaths(buildAppMenuForSession(role, 'TEST', 'Test GA'))
      expect(paths).toContain('/admin/claim/insurance-companies')
      expect(paths.some((path) => path.includes('/claim-requests'))).toBe(false)
      expect(paths.some((path) => path.includes('/insurance-claim'))).toBe(false)
    }
  })

  it('hides top-level signature and insurance-claim menus but keeps customer management claim links for USER', () => {
    const menu = buildAppMenuForSession('USER', 'TEST', 'Test GA')
    const paths = linkPaths(menu)
    const labels = linkLabels(menu)
    const sections = sectionLabels(menu)

    expect(sections).toContain('고객관리')
    expect(sections).not.toContain('보험청구')
    expect(sections).not.toContain('전자서명')

    expect(labels).toContain('고객소식지')
    expect(labels).toContain('청구관리')
    expect(paths).toContain('/claim-requests')
    expect(paths).toContain('/claim-requests?claimTab=news-all')

    expect(paths).not.toContain('/insurance-claim/new')
    expect(paths).not.toContain('/insurance-claim/requests')
    expect(paths).not.toContain('/contracts/signatures/send')
    expect(paths).not.toContain('/contracts/signatures/history')
    expect(paths).not.toContain('/admin/claim/insurance-companies')
    expect(paths).toContain('/customers')
  })
})
