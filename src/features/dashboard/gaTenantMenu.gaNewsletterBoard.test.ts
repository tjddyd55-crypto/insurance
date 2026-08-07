import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from './gaTenantMenu'
import { buildDynamicNewsletterBoardMenuEntries } from '../insurer-news/utils/newsletterBoardMenuLinks'
import { buildBoardWriterNavLabels } from '../insurer-news/config/boardWriterNavigation'

function linkLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries.filter((entry) => entry.type === 'link').map((entry) => (entry.type === 'link' ? entry.label : ''))
}

const GA_BOARD = { label: '내부공지', slug: 'internal-news', boardScope: 'ga' as const }
const GLOBAL_BOARD = { label: '공용안내', slug: 'shared-news', boardScope: 'global' as const }
const YEONGJIN_BOARD = { label: '영진서울중앙', slug: 'yeongjin', boardScope: 'ga' as const }

describe('buildDynamicNewsletterBoardMenuEntries', () => {
  it('GA_STAFF 에게 GA전용 보드 조회·업로드 메뉴를 노출한다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([GA_BOARD], 'GA_STAFF')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual([
      '내부공지',
      '내부공지 업로드',
    ])
  })

  it('USER 에게는 조회만 노출하고 업로드는 숨긴다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([GA_BOARD, GLOBAL_BOARD], 'USER')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual([
      '내부공지',
      '공용안내',
    ])
  })

  it('GA_ADMIN 에게는 GA전용 보드만 업로드 메뉴를 붙인다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([GA_BOARD, GLOBAL_BOARD], 'GA_ADMIN')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual([
      '내부공지',
      '내부공지 업로드',
      '공용안내',
    ])
  })

  it('조회 메뉴 label 은 생성 이름 그대로이며 「조회」 suffix 를 붙이지 않는다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([YEONGJIN_BOARD], 'USER')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual(['영진서울중앙'])
  })

  it('이름에 「조회」가 포함되어도 임의로 제거하지 않는다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries(
      [{ label: '계약 조회팀', slug: 'contract-review', boardScope: 'ga' }],
      'USER',
    )
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual(['계약 조회팀'])
  })
})

describe('buildBoardWriterNavLabels', () => {
  it('GA 보드는 viewLabel 에 조회 suffix 를 붙이지 않는다', () => {
    expect(buildBoardWriterNavLabels(YEONGJIN_BOARD)).toEqual({
      title: '영진서울중앙',
      viewLabel: '영진서울중앙',
      uploadLabel: '영진서울중앙 업로드',
    })
  })
})

describe('buildAppMenuForSession — GA전용 소식지 메뉴', () => {
  it('GA_STAFF 메뉴에 GA전용 소식지 관리는 없고 동적 조회·업로드만 유지한다', () => {
    const labels = linkLabels(
      buildAppMenuForSession('GA_STAFF', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [GA_BOARD],
      }),
    )
    expect(labels).not.toContain('GA전용 소식지 관리')
    expect(labels).toContain('내부공지')
    expect(labels).toContain('내부공지 업로드')
    expect(labels).not.toContain('내부공지 조회')
  })

  it('GA_ADMIN 메뉴는 관리 전용이며 동적 사용자 소식지 링크를 붙이지 않는다', () => {
    const labels = linkLabels(
      buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [GA_BOARD],
      }),
    )
    expect(labels).toContain('GA전용 소식지 관리')
    expect(labels).not.toContain('내부공지')
    expect(labels).not.toContain('내부공지 업로드')
    expect(labels).not.toContain('고객리스트')
  })

  it('고정 메뉴(원수사소식지·연락처 등)는 그대로 유지한다', () => {
    const userLabels = linkLabels(buildAppMenuForSession('USER', 'TEST', 'Test GA', {}))
    expect(userLabels).toContain('원수사소식지')
    expect(userLabels).toContain('원수사 연락처')
    expect(userLabels).toContain('손해사정사 소식지')

    const insurerLabels = linkLabels(buildAppMenuForSession('INSURER_MANAGER', 'TEST', 'Test GA', {}))
    expect(insurerLabels).toContain('원수사 소식지 조회')
  })

  it('활성 손해사정사 시스템 보드는 표시 이름을 쓰고 고정 path 를 유지한다', () => {
    const labels = linkLabels(
      buildAppMenuForSession('USER', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [
          {
            label: '보상 실무 자료',
            slug: 'system-loss-adjuster',
            boardScope: 'ga',
            systemKey: 'LOSS_ADJUSTER',
            isActive: true,
          },
        ],
      }),
    )
    expect(labels).toContain('보상 실무 자료')
    expect(labels).not.toContain('손해사정사 소식지')
    const paths = buildAppMenuForSession('USER', 'TEST', 'Test GA', {
      dynamicNewsletterBoards: [
        {
          label: '보상 실무 자료',
          slug: 'system-loss-adjuster',
          boardScope: 'ga',
          systemKey: 'LOSS_ADJUSTER',
          isActive: true,
        },
      ],
    })
      .filter((e) => e.type === 'link')
      .map((e) => (e.type === 'link' ? e.path : ''))
    expect(paths).toContain('/portal/adjuster-news')
    expect(paths).not.toContain('/portal/boards/system-loss-adjuster')
  })

  it('비활성 손해사정사 시스템 보드는 일반 사용자 메뉴에서 숨긴다', () => {
    const labels = linkLabels(
      buildAppMenuForSession('USER', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [
          {
            label: '손해사정사 소식지',
            slug: 'system-loss-adjuster',
            boardScope: 'ga',
            systemKey: 'LOSS_ADJUSTER',
            isActive: false,
          },
          { label: '영진서울중앙', slug: 'yeongjin', boardScope: 'ga' },
        ],
      }),
    )
    expect(labels).not.toContain('손해사정사 소식지')
    expect(labels).toContain('원수사소식지')
    expect(labels).toContain('영진서울중앙')
  })
})
