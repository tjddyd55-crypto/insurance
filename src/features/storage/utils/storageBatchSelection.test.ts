import { describe, expect, it } from 'vitest'
import { toggleStorageSelection, retainFailedSelection, storageBatchDeleteSummary } from './storageBatchSelection'

describe('storage batch selection', () => {
  it('toggles without mutating the previous selection', () => {
    const original = new Set([1])
    expect([...toggleStorageSelection(original, 2)]).toEqual([1, 2])
    expect([...toggleStorageSelection(original, 1)]).toEqual([])
    expect([...original]).toEqual([1])
  })
  it('keeps failed files selected and removes only deleted files', () => {
    expect([...retainFailedSelection(new Set([1, 2, 3]), [1, 3])]).toEqual([2])
  })
  it('omits failure counts when all deletions succeed', () => {
    expect(storageBatchDeleteSummary(4, 0)).toBe('4개 삭제 완료')
    expect(storageBatchDeleteSummary(0, 0)).toBe('0개 삭제 완료')
  })
  it('reports partial failure counts', () => {
    expect(storageBatchDeleteSummary(4, 1)).toBe('4개 삭제 완료 / 1개 삭제 실패')
  })
})
