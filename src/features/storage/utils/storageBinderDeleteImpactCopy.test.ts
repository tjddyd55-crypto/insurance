import { describe, expect, it } from 'vitest'

import {
  buildStorageBinderDeleteImpactConfirmMessage,
  buildStorageBinderDeleteImpactDetailLines,
  hasStorageBinderDeleteImpact,
} from './storageBinderDeleteImpactCopy'

describe('storageBinderDeleteImpactCopy', () => {
  it('detects binder usage', () => {
    expect(hasStorageBinderDeleteImpact({ binderItemCount: 0, binderCount: 0, binders: [] } as never)).toBe(
      false,
    )
    expect(
      hasStorageBinderDeleteImpact({
        binderItemCount: 1,
        binderCount: 1,
        binders: [{ id: '1', title: 'A', itemCount: 1 }],
      } as never),
    ).toBe(true)
  })

  it('builds detail lines with binder titles', () => {
    const lines = buildStorageBinderDeleteImpactDetailLines({
      materialCount: 1,
      binderCount: 2,
      binderItemCount: 3,
      binders: [
        { id: '1', title: '암보험 상담 바인더', itemCount: 2 },
        { id: '2', title: '종합 상담 바인더', itemCount: 1 },
      ],
      materials: [],
    })
    expect(lines.some((line) => line.includes('2개의 바인더'))).toBe(true)
    expect(lines).toContain('· 암보험 상담 바인더 (2항목)')
    expect(lines).toContain('· 종합 상담 바인더')
  })

  it('builds confirm message for unused file', () => {
    expect(
      buildStorageBinderDeleteImpactConfirmMessage(
        { materialCount: 0, binderCount: 0, binderItemCount: 0, binders: [], materials: [] },
        'test.pdf',
      ),
    ).toContain('test.pdf')
  })
})
