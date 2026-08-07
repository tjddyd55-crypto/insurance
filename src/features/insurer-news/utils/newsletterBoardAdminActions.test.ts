import { describe, expect, it } from 'vitest'
import { resolveNewsletterBoardAdminActions } from './newsletterBoardAdminActions'
import type { NewsletterBoard } from '../types'

const baseGa: NewsletterBoard = {
  id: '1',
  slug: 'edu',
  label: '교육자료',
  boardScope: 'ga',
  contentScope: 'ga',
  isPublic: false,
  ownerGaId: 7,
  gaId: 7,
  gaCode: 'TEST',
  gaName: 'Test',
  isActive: true,
  systemKey: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const lossAdjuster: NewsletterBoard = {
  ...baseGa,
  id: '2',
  slug: 'system-loss-adjuster',
  label: '보상 실무 자료',
  systemKey: 'LOSS_ADJUSTER',
}

describe('resolveNewsletterBoardAdminActions', () => {
  it('gives GA admin the same author-manage actions for loss adjuster and custom GA boards', () => {
    const ga = resolveNewsletterBoardAdminActions(baseGa, 'GA_ADMIN')
    const la = resolveNewsletterBoardAdminActions(lossAdjuster, 'GA_ADMIN')
    expect(ga.canManageAuthors).toBe(true)
    expect(la.canManageAuthors).toBe(true)
    expect(ga.canDisable).toBe(true)
    expect(la.canDisable).toBe(true)
    expect(ga.canDelete).toBe(true)
    expect(la.canDelete).toBe(false)
    expect(la.portalPath).toBe('/portal/adjuster-news')
    expect(ga.portalPath).toBe('/portal/boards/edu')
    expect(la.kindLabel).toBe('기본')
    expect(ga.kindLabel).toBe('GA 게시판')
  })

  it('allows super admin to delete global boards but not loss-adjuster system boards', () => {
    const globalBoard: NewsletterBoard = {
      ...baseGa,
      id: 'g1',
      boardScope: 'global',
      contentScope: 'global',
      isPublic: true,
      ownerGaId: null,
      gaId: null,
    }
    const flags = resolveNewsletterBoardAdminActions(globalBoard, 'SUPER_ADMIN')
    expect(flags.canDelete).toBe(true)
    expect(resolveNewsletterBoardAdminActions(lossAdjuster, 'SUPER_ADMIN').canDelete).toBe(false)
  })

  it('hides manage actions for normal users', () => {
    const flags = resolveNewsletterBoardAdminActions(lossAdjuster, 'USER')
    expect(flags.canManageAuthors).toBe(false)
    expect(flags.canEdit).toBe(false)
    expect(flags.canDisable).toBe(false)
    expect(flags.canDelete).toBe(false)
  })

  it('hides manage actions for GA_STAFF', () => {
    const flags = resolveNewsletterBoardAdminActions(baseGa, 'GA_STAFF')
    expect(flags.canManageAuthors).toBe(false)
    expect(flags.canEdit).toBe(false)
    expect(flags.canDisable).toBe(false)
    expect(flags.canDelete).toBe(false)
  })
})
