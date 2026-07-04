import { describe, expect, it } from 'vitest'

import {
  filterNewsletterBoardsForGaOpsMenu,
  isUserAgentNewsletterBoard,
} from './newsletterBoardMenuPolicy'

describe('newsletterBoardMenuPolicy', () => {
  it('global · 더도움 · 공용 라벨 보드를 USER 전용으로 분류한다', () => {
    expect(
      isUserAgentNewsletterBoard({
        label: '공용 소식지',
        slug: 'shared',
        boardScope: 'global',
        contentScope: 'global',
      }),
    ).toBe(true)
    expect(
      isUserAgentNewsletterBoard({
        label: '더도움손해사정사',
        slug: 'deodoum',
        boardScope: 'ga',
        contentScope: 'ga',
      }),
    ).toBe(true)
    expect(
      isUserAgentNewsletterBoard({
        label: 'GA 전용',
        slug: 'ga-only',
        boardScope: 'ga',
        contentScope: 'ga',
      }),
    ).toBe(false)
  })

  it('GA 운영 메뉴 필터에서 USER 전용 보드를 제외한다', () => {
    const filtered = filterNewsletterBoardsForGaOpsMenu([
      { label: '공용 소식지', slug: 'shared', boardScope: 'global', contentScope: 'global' },
      { label: '더도움손해사정사', slug: 'deodoum', boardScope: 'ga', contentScope: 'ga' },
      { label: '일반 소식지', slug: 'general', boardScope: 'ga', contentScope: 'ga' },
    ])
    expect(filtered.map((row) => row.slug)).toEqual(['general'])
  })
})
