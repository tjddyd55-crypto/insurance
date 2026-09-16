import { describe, expect, it } from 'vitest'
import { resolveStorageExplorerFileActionsMenuPosition } from './storageExplorerFileActionsMenuPosition'

describe('resolveStorageExplorerFileActionsMenuPosition', () => {
  it('aligns menu to trigger right edge below by default', () => {
    const result = resolveStorageExplorerFileActionsMenuPosition({
      triggerRect: {
        top: 200,
        bottom: 228,
        left: 500,
        right: 580,
        width: 80,
        height: 28,
        x: 500,
        y: 200,
        toJSON: () => ({}),
      },
      menuSize: { width: 120, height: 160 },
      viewportWidth: 1200,
      viewportHeight: 800,
    })

    expect(result.placement).toBe('bottom')
    expect(result.top).toBe(232)
    expect(result.left).toBe(460)
  })

  it('flips above when bottom space is smaller than top space', () => {
    const result = resolveStorageExplorerFileActionsMenuPosition({
      triggerRect: {
        top: 720,
        bottom: 748,
        left: 500,
        right: 580,
        width: 80,
        height: 28,
        x: 500,
        y: 720,
        toJSON: () => ({}),
      },
      menuSize: { width: 120, height: 160 },
      viewportWidth: 1200,
      viewportHeight: 800,
    })

    expect(result.placement).toBe('top')
    expect(result.top).toBe(556)
  })

  it('clamps menu inside viewport horizontal padding', () => {
    const result = resolveStorageExplorerFileActionsMenuPosition({
      triggerRect: {
        top: 200,
        bottom: 228,
        left: 20,
        right: 72,
        width: 52,
        height: 28,
        x: 20,
        y: 200,
        toJSON: () => ({}),
      },
      menuSize: { width: 120, height: 160 },
      viewportWidth: 400,
      viewportHeight: 800,
    })

    expect(result.left).toBe(12)
  })
})
