import { describe, expect, it } from 'vitest'

import { buildAppMenuForSession } from './gaTenantMenu'
import { buildDynamicNewsletterBoardMenuEntries } from '../insurer-news/utils/newsletterBoardMenuLinks'

function linkLabels(entries: ReturnType<typeof buildAppMenuForSession>): string[] {
  return entries.filter((entry) => entry.type === 'link').map((entry) => (entry.type === 'link' ? entry.label : ''))
}

const GA_BOARD = { label: '내부공지', slug: 'internal-news', boardScope: 'ga' as const }
const GLOBAL_BOARD = { label: '공용안내', slug: 'shared-news', boardScope: 'global' as const }

describe('buildDynamicNewsletterBoardMenuEntries', () => {
  it('GA_STAFF 에게 GA전용 보드 조회·업로드 메뉴를 노출한다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([GA_BOARD], 'GA_STAFF')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual([
      '내부공지 조회',
      '내부공지 업로드',
    ])
  })

  it('USER 에게는 조회만 노출하고 업로드는 숨긴다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([GA_BOARD, GLOBAL_BOARD], 'USER')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual([
      '내부공지 조회',
      '공용안내 조회',
    ])
  })

  it('GA_ADMIN 에게는 GA전용 보드만 업로드 메뉴를 붙인다', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries([GA_BOARD, GLOBAL_BOARD], 'GA_ADMIN')
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual([
      '내부공지 조회',
      '내부공지 업로드',
      '공용안내 조회',
    ])
  })
})

describe('buildAppMenuForSession — GA전용 소식지 메뉴', () => {
  it('GA_STAFF 메뉴에 GA전용 소식지 관리와 동적 조회·업로드가 포함된다', () => {
    const labels = linkLabels(
      buildAppMenuForSession('GA_STAFF', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [GA_BOARD],
      }),
    )
    expect(labels).toContain('GA전용 소식지 관리')
    expect(labels).toContain('내부공지 조회')
    expect(labels).toContain('내부공지 업로드')
  })

  it('GA_ADMIN 메뉴에도 동적 조회·업로드가 포함된다', () => {
    const labels = linkLabels(
      buildAppMenuForSession('GA_ADMIN', 'TEST', 'Test GA', {
        dynamicNewsletterBoards: [GA_BOARD],
      }),
    )
    expect(labels).toContain('GA전용 소식지 관리')
    expect(labels).toContain('내부공지 조회')
    expect(labels).toContain('내부공지 업로드')
  })
})
