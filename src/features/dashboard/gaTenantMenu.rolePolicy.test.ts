import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from './gaTenantMenu'

function linkLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries.filter((e) => e.type === 'link').map((e) => (e.type === 'link' ? e.label : ''))
}

function linkPaths(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries.filter((e) => e.type === 'link').map((e) => (e.type === 'link' ? e.path : ''))
}

const USER_WORK_LABELS = [
  '오늘의 TA',
  '고객리스트',
  '원수사소식지',
  '신청서 작성',
  '팀원리스트',
  '문자 발송',
  '내정보관리',
]

const GA_ADMIN_OPS_LABELS = [
  '보험청구 설정',
  'GA전용 소식지 관리',
  '보안 감사 로그',
  '계정 설정',
]

describe('buildAppMenuForSession — 역할별 메뉴 정책', () => {
  it('GA_STAFF 에게 GA전용 소식지 관리·작성자 관리 메뉴를 노출하지 않는다', () => {
    const labels = linkLabels(buildAppMenuForSession('GA_STAFF', 'TEST', 'Test GA'))
    expect(labels).not.toContain('GA전용 소식지 관리')
    expect(labels).not.toContain('소식지 관리')
    expect(labels).toContain('보험청구 설정')
    expect(labels).toContain('원수사 연락처 관리')
    expect(labels).toContain('공유 계정관리')
    for (const label of USER_WORK_LABELS) {
      expect(labels).not.toContain(label)
    }
  })

  it('GA_ADMIN 에게 관리 메뉴만 노출하고 일반 CRM 메뉴는 숨긴다', () => {
    const labels = linkLabels(buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA'))
    for (const label of GA_ADMIN_OPS_LABELS) {
      expect(labels).toContain(label)
    }
    for (const label of USER_WORK_LABELS) {
      expect(labels).not.toContain(label)
    }
    expect(labels).not.toContain('공유 계정관리')
    expect(linkPaths(buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA'))).not.toContain(
      '/customers',
    )
  })

  it('USER 에게는 일반 CRM 메뉴를 유지하고 GA 관리 메뉴는 숨긴다', () => {
    const labels = linkLabels(buildAppMenuForSession('USER', 'TEST', 'Test GA'))
    expect(labels).toContain('고객리스트')
    expect(labels).toContain('원수사소식지')
    expect(labels).not.toContain('GA전용 소식지 관리')
    expect(labels).not.toContain('보험청구 설정')
    expect(labels).not.toContain('보안 감사 로그')
  })

  it('SUPER_ADMIN 전체 관리 메뉴는 축소되지 않는다', () => {
    const labels = linkLabels(buildAppMenuForSession('SUPER_ADMIN', undefined, undefined))
    expect(labels).toContain('GA 관리')
    expect(labels).toContain('소식지 관리')
    expect(labels).toContain('결제·구독 관리')
    expect(labels).toContain('보안 감사 로그')
  })
})
