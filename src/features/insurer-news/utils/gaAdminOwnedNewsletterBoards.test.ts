import { describe, expect, it } from 'vitest'

import type { NewsletterBoard } from '../types'
import { filterGaAdminOwnedNewsletterBoards } from './gaAdminOwnedNewsletterBoards'

function board(partial: Partial<NewsletterBoard> & { id: string }): NewsletterBoard {
  return {
    id: partial.id,
    slug: partial.slug ?? 'slug',
    label: partial.label ?? 'label',
    boardScope: partial.boardScope ?? 'ga',
    contentScope: partial.contentScope ?? 'ga',
    systemKey: partial.systemKey ?? null,
    isActive: partial.isActive ?? true,
    description: partial.description ?? null,
    sortOrder: partial.sortOrder ?? 0,
    ownerGaId: partial.ownerGaId ?? 1,
    isPublic: partial.isPublic ?? false,
    gaId: partial.gaId ?? 1,
    gaCode: partial.gaCode ?? 'TEST',
    gaName: partial.gaName ?? 'Test GA',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z',
  }
}

describe('filterGaAdminOwnedNewsletterBoards', () => {
  it('손해사정사 시스템 보드는 제외한다', () => {
    const rows = filterGaAdminOwnedNewsletterBoards([
      board({ id: '1', systemKey: 'LOSS_ADJUSTER', boardScope: 'ga' }),
      board({ id: '2', systemKey: null, boardScope: 'ga', label: '교육자료' }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['2'])
  })

  it('global scope 보드는 제외한다', () => {
    const rows = filterGaAdminOwnedNewsletterBoards([
      board({ id: 'g', boardScope: 'global', contentScope: 'global' }),
      board({ id: 'ga', boardScope: 'ga' }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['ga'])
  })
})
