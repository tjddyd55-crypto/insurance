import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from '../dashboard/gaTenantMenu'

function linkLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries.filter((e) => e.type === 'link').map((e) => (e.type === 'link' ? e.label : ''))
}

describe('AI assistant admin access — SUPER_ADMIN only menu', () => {
  it('SUPER_ADMIN 메뉴에 기능 연결 현황을 포함한다', () => {
    const labels = linkLabels(buildAppMenuForSession('SUPER_ADMIN', undefined, undefined))
    expect(labels).toContain('기능 연결 현황')
  })

  it('GA_ADMIN 메뉴에 기능 연결 현황을 포함하지 않는다', () => {
    const labels = linkLabels(buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA'))
    expect(labels).not.toContain('기능 연결 현황')
  })
})
