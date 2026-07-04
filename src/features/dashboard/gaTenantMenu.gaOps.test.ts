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

const GLOBAL_BOARD = {
  label: '공용 소식지',
  slug: 'shared-news',
  boardScope: 'global' as const,
  contentScope: 'global' as const,
}

const GA_BOARD = {
  label: 'GA 전용 소식',
  slug: 'ga-news',
  boardScope: 'ga' as const,
  contentScope: 'ga' as const,
}

describe('buildAppMenuForSession — GA_ADMIN / GA_STAFF 운영 메뉴', () => {
  it('GA_ADMIN 에게 결제·보험청구 설정·전자서명·공용 소식지 메뉴를 노출하지 않는다', () => {
    const paths = linkPaths(
      buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [GLOBAL_BOARD, GA_BOARD],
      }),
    )
    expect(paths.some((path) => path.includes('/billing'))).toBe(false)
    expect(paths.some((path) => path.includes('/account/billing'))).toBe(false)
    expect(paths).not.toContain('/admin/claim/insurance-companies')
    expect(paths).not.toContain('/contracts/signatures/send')
    expect(paths).not.toContain('/contracts/signatures/history')
    expect(paths.some((path) => path.includes('/portal/boards/shared-news'))).toBe(false)
    expect(paths).toContain('/insurance/account-credentials/shared')
  })

  it('GA_STAFF 에게 결제·보험청구 설정·전자서명·공용 소식지·팀관리 메뉴를 노출하지 않는다', () => {
    const menu = buildAppMenuForSession('GA_STAFF', 'TEST', 'Test GA', {
      dynamicNewsletterBoards: [GLOBAL_BOARD, GA_BOARD],
    })
    const paths = linkPaths(menu)
    const labels = linkLabels(menu)
    expect(paths.some((path) => path.includes('/billing'))).toBe(false)
    expect(paths).not.toContain('/admin/claim/insurance-companies')
    expect(paths).not.toContain('/contracts/signatures/send')
    expect(paths.some((path) => path.includes('/portal/boards/shared-news'))).toBe(false)
    expect(labels).not.toContain('팀원 관리')
    expect(paths).toContain('/insurance/account-credentials/shared')
  })

  it('USER 에게는 공유 계정관리를 노출하지 않고 전자서명·공용 소식지는 유지한다', () => {
    const paths = linkPaths(
      buildAppMenuForSession('USER', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [GLOBAL_BOARD, GA_BOARD],
      }),
    )
    expect(paths).not.toContain('/insurance/account-credentials/shared')
    expect(paths).toContain('/contracts/signatures/send')
    expect(paths.some((path) => path.includes('/portal/boards/shared-news'))).toBe(true)
  })
})
