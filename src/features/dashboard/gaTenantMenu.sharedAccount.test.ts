import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from './gaTenantMenu'

const SHARED_ACCOUNT_PATH = '/insurance/account-credentials/shared'

function linkPaths(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries
    .filter((entry) => entry.type === 'link')
    .map((entry) => (entry.type === 'link' ? entry.path : ''))
}

describe('buildAppMenuForSession — 공유 계정관리 노출 정책', () => {
  it('GA_ADMIN 관리 전용 메뉴에는 공유 계정관리를 넣지 않는다', () => {
    const paths = linkPaths(buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA'))
    expect(paths).not.toContain(SHARED_ACCOUNT_PATH)
    expect(paths).not.toContain('/insurance/account-credentials')
    expect(paths).toContain('/admin/newsletter-boards')
  })

  it('GA_STAFF 에게 공유 계정관리 메뉴를 노출한다', () => {
    const paths = linkPaths(buildAppMenuForSession('GA_STAFF', 'TEST', 'Test GA'))
    expect(paths).toContain(SHARED_ACCOUNT_PATH)
  })

  it('USER 에게는 공유 계정관리 메뉴를 노출하지 않는다', () => {
    const paths = linkPaths(buildAppMenuForSession('USER', 'TEST', 'Test GA'))
    expect(paths).not.toContain(SHARED_ACCOUNT_PATH)
    // 본인 계정관리는 유지
    expect(paths).toContain('/insurance/account-credentials')
  })

  it('SUPER_ADMIN 에게는 공유 계정관리 메뉴를 노출하지 않는다(A안: 메뉴 미노출)', () => {
    const paths = linkPaths(buildAppMenuForSession('SUPER_ADMIN', undefined, undefined))
    expect(paths).not.toContain(SHARED_ACCOUNT_PATH)
  })
})
