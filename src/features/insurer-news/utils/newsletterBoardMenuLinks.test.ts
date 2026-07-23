import { describe, expect, it } from 'vitest'
import {
  LOSS_ADJUSTER_PORTAL_PATH,
  LOSS_ADJUSTER_SYSTEM_KEY,
  buildDynamicNewsletterBoardMenuEntries,
  buildLossAdjusterPortalMenuEntry,
  mapNewsletterBoardsToMenuItems,
  partitionNewsletterBoardsForMenu,
} from './newsletterBoardMenuLinks'
import type { NewsletterBoard } from '../types'

describe('newsletterBoardMenuLinks — LOSS_ADJUSTER system board', () => {
  const systemBoard: NewsletterBoard = {
    id: 'sys-1',
    slug: 'system-loss-adjuster',
    label: '보상 실무 자료',
    boardScope: 'ga',
    contentScope: 'ga',
    isPublic: false,
    ownerGaId: 7,
    gaId: 7,
    gaCode: 'TEST',
    gaName: 'Test GA',
    isActive: true,
    systemKey: LOSS_ADJUSTER_SYSTEM_KEY,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('maps systemKey onto menu items', () => {
    const items = mapNewsletterBoardsToMenuItems([systemBoard])
    expect(items[0]?.systemKey).toBe('LOSS_ADJUSTER')
    expect(items[0]?.label).toBe('보상 실무 자료')
  })

  it('partitions active system board to fixed portal path entry', () => {
    const items = mapNewsletterBoardsToMenuItems([systemBoard])
    const { lossAdjuster, dynamicBoards } = partitionNewsletterBoardsForMenu(items)
    expect(lossAdjuster?.label).toBe('보상 실무 자료')
    expect(dynamicBoards).toEqual([])
    expect(buildLossAdjusterPortalMenuEntry(lossAdjuster)).toEqual({
      type: 'link',
      label: '보상 실무 자료',
      path: LOSS_ADJUSTER_PORTAL_PATH,
    })
  })

  it('hides inactive system board from portal menu', () => {
    const items = mapNewsletterBoardsToMenuItems([{ ...systemBoard, isActive: false }])
    const { lossAdjuster, dynamicBoards } = partitionNewsletterBoardsForMenu(items)
    expect(lossAdjuster).toBeNull()
    expect(dynamicBoards).toEqual([])
    expect(buildLossAdjusterPortalMenuEntry(lossAdjuster)).toBeNull()
  })

  it('does not mount system board as /portal/boards/:slug', () => {
    const entries = buildDynamicNewsletterBoardMenuEntries(
      mapNewsletterBoardsToMenuItems([
        systemBoard,
        {
          ...systemBoard,
          id: 'c1',
          slug: 'yeongjin',
          label: '영진서울중앙',
          systemKey: null,
        },
      ]),
      'USER',
    )
    expect(entries.map((e) => (e.type === 'link' ? e.path : ''))).toEqual([
      '/portal/boards/yeongjin',
    ])
    expect(entries.map((e) => (e.type === 'link' ? e.label : ''))).toEqual(['영진서울중앙'])
  })
})
