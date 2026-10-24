import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { InsurerSummary, NewsletterBoard, NewsletterItem } from '../types'
import {
  buildNewsletterBoardOptions,
  buildNewsletterInsurerOptions,
  buildNewsletterKindOptions,
  formatPickerFilterLabel,
} from './newsletterPickerFilters'

function board(partial: Partial<NewsletterBoard> & Pick<NewsletterBoard, 'id' | 'label' | 'slug' | 'boardScope'>): NewsletterBoard {
  return {
    description: null,
    contentScope: partial.boardScope === 'global' ? 'global' : 'ga',
    isPublic: partial.boardScope === 'global',
    gaId: null,
    gaCode: null,
    gaName: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

function item(partial: Partial<NewsletterItem> & Pick<NewsletterItem, 'id'>): NewsletterItem {
  return {
    gaCode: 'GA',
    insurerCode: 'INS',
    insurerName: '한화',
    insurerSlug: 'hanwha',
    title: partial.id,
    summary: '',
    heroImageUrl: null,
    publishedAt: '2026-01-01T00:00:00.000Z',
    status: 'PUBLISHED',
    hasImages: false,
    hasPdf: false,
    hasTextBody: true,
    sourceKind: 'GA',
    ...partial,
  }
}

describe('newsletter picker filters', () => {
  it('uses menu labels for source kinds and keeps internal codes', () => {
    const options = buildNewsletterKindOptions([
      item({ id: '1', sourceKind: 'INSURER' }),
    ])
    expect(options.map((option) => option.code)).toEqual(['', 'INSURER', 'GA', 'PUBLIC'])
    expect(formatPickerFilterLabel(options[1])).toBe('원수사소식지 (1)')
    expect(formatPickerFilterLabel(options[2])).toBe('GA전용 소식지 (0)')
    expect(formatPickerFilterLabel(options[3])).toBe('공용 게시판 (0)')
    expect(options[1].menuPath).toBe('/portal/newsletters')
  })

  it('includes registry boards with zero posts', () => {
    const options = buildNewsletterBoardOptions(
      [
        board({ id: 'seoul', label: '서울중앙', slug: 'seoul', boardScope: 'ga' }),
        board({ id: 'busan', label: '부산', slug: 'busan', boardScope: 'ga' }),
      ],
      [item({ id: 'post', boardId: 'busan', sourceKind: 'GA' })],
      'GA',
    )
    const seoul = options.find((option) => option.code === 'board:seoul')
    expect(seoul).toMatchObject({
      label: '서울중앙',
      count: 0,
      menuPath: '/portal/boards/seoul',
    })
    expect(formatPickerFilterLabel(seoul!)).toBe('서울중앙 (0)')
    expect(options.find((option) => option.code === 'board:busan')?.count).toBe(1)
  })

  it('builds insurer options from the registry count, including zero', () => {
    const insurers: InsurerSummary[] = [
      {
        insurerCode: 'SEOUL',
        insurerName: '서울중앙',
        insurerSlug: 'seoul',
        gaCode: 'GA',
        newsletterCount: 0,
        lastPublishedAt: null,
      },
    ]
    const options = buildNewsletterInsurerOptions(insurers)
    expect(options[1]).toMatchObject({ code: 'SEOUL', label: '서울중앙', count: 0 })
    expect(formatPickerFilterLabel(options[1])).toBe('서울중앙 (0)')
  })

  it('single board selector: 전체 소식지 first, 원수사소식지 + all registry boards, zero-count kept', () => {
    const options = buildNewsletterBoardOptions(
      [
        board({ id: 'yj', label: '영진서울중앙', slug: 'yj', boardScope: 'ga' }),
        board({ id: 'adj', label: '손해사정사 소식지', slug: 'adj', boardScope: 'global' }),
        board({ id: 'off', label: '비활성', slug: 'off', boardScope: 'ga', isActive: false }),
      ],
      [
        item({ id: 'i1', sourceKind: 'INSURER' }),
        item({ id: 'g1', boardId: 'adj', sourceKind: 'PUBLIC' }),
      ],
    )
    expect(options.map(formatPickerFilterLabel)).toEqual([
      '전체 소식지 (2)',
      '원수사소식지 (1)',
      '손해사정사 소식지 (1)',
      '영진서울중앙 (0)',
    ])
    expect(options.map((o) => o.code)).toEqual(['', 'insurer', 'board:adj', 'board:yj'])
    expect(options.some((o) => o.label === '전체 게시판')).toBe(false)
  })
})

describe('newsletter picker panel contract', () => {
  const src = readFileSync(resolve(__dirname, '../components/collections/NewsletterPickerPanel.tsx'), 'utf8')
  it('removes the duplicate 소식지 종류 dropdown and keeps folder + board + search', () => {
    expect(src).not.toContain('aria-label="소식지 종류"')
    expect(src).not.toContain('buildNewsletterKindOptions')
    expect(src).toContain('aria-label="소식지 출처"')
    expect(src).toContain('aria-label="소식지"')
    expect(src).toContain('aria-label="소식지 검색"')
    expect(src).toContain('item.insurerName, item.boardLabel, item.title, item.summary, formatTimestampSearchHaystack(item.publishedAt)')
  })
})

describe('material picker layout contract', () => {
  const css = readFileSync(resolve(__dirname, '../../personal-binder/styles/personal-binder.css'), 'utf8')
  it('aligns body/footer padding to header token and keeps the footer', () => {
    expect(css).toMatch(/\.personal-binder-material-picker-dialog \.newsletter-binder-source \{\s*padding-inline: var\(--space-5, 20px\);/)
    expect(css).toMatch(/\.personal-binder-material-picker__footer \{[^}]*flex-shrink: 0;[^}]*padding: var\(--space-3, 12px\) var\(--space-5, 20px\);/)
    expect(css).toContain('.personal-binder-material-picker__footer-count')
  })
})
