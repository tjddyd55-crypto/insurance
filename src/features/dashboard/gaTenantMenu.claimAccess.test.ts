import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from './gaTenantMenu'

function linkPaths(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries
    .filter((entry) => entry.type === 'link')
    .map((entry) => (entry.type === 'link' ? entry.path : ''))
}

function sectionLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries
    .filter((entry) => entry.type === 'section')
    .map((entry) => (entry.type === 'section' ? entry.label : ''))
}

describe('buildAppMenuForSession claim access', () => {
  it('groups SUPER_ADMIN menu and excludes claim routes', () => {
    const menu = buildAppMenuForSession('SUPER_ADMIN', undefined, undefined)
    const paths = linkPaths(menu)
    const sections = sectionLabels(menu)

    expect(sections).toContain('사용자 / 조직 관리')
    expect(sections).toContain('결제 / 구독 관리')
    expect(sections).toContain('공지 / 운영 관리')
    expect(sections).toContain('전자문서 / 서명 관리')
    expect(sections).toContain('보험사 / 시스템 설정')

    expect(paths.some((path) => path.includes('claim'))).toBe(false)
    expect(paths.some((path) => path.includes('insurance-claim'))).toBe(false)
  })

  it('excludes claim routes for GA_ADMIN and GA_STAFF', () => {
    for (const role of ['GA_ADMIN', 'GA_STAFF'] as const) {
      const paths = linkPaths(buildAppMenuForSession(role, 'TEST', 'Test GA'))
      expect(paths.some((path) => path.includes('/claim-requests'))).toBe(false)
      expect(paths.some((path) => path.includes('/insurance-claim'))).toBe(false)
      expect(paths.some((path) => path.includes('/admin/claim'))).toBe(false)
    }
  })

  it('keeps insurance claim entries for USER', () => {
    const paths = linkPaths(buildAppMenuForSession('USER', 'TEST', 'Test GA'))
    expect(paths).toContain('/claim-requests')
    expect(paths).toContain('/insurance-claim/requests')
  })
})
