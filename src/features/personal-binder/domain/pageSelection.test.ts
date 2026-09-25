import { describe, expect, it } from 'vitest'

import {
  buildBinderViewerPages,
  formatSelectedPages,
  normalizeSelectedPages,
  parsePageRangeInput,
  togglePageSelection,
} from './pageSelection'

describe('personal binder page selection', () => {
  it('parses and normalizes ranges and duplicate pages', () => {
    expect(parsePageRangeInput('3-6, 6, 9, 12-15', 20)).toEqual({
      ok: true,
      pages: [3, 4, 5, 6, 9, 12, 13, 14, 15],
    })
  })

  it.each(['0', '-1', '8-3', 'abc', '1,', '21'])(
    'rejects invalid range %s',
    (input) => {
      expect(parsePageRangeInput(input, 20).ok).toBe(false)
    },
  )

  it('formats compact normalized ranges', () => {
    expect(formatSelectedPages([1, 2, 3, 5, 8, 9])).toBe('1-3, 5, 8-9')
  })

  it('normalizes pages within document bounds', () => {
    expect(normalizeSelectedPages([3, 1, 3, 0, 9], 5)).toEqual([1, 3])
  })

  it('supports additive and shift range selection', () => {
    expect(togglePageSelection([3], 6, { shiftFrom: 3, additive: true })).toEqual([
      3, 4, 5, 6,
    ])
  })

  it('connects multiple PDFs into one deterministic viewer sequence', () => {
    const material = (id: string, pageCount: number) => ({
      id,
      fileId: Number(id),
      title: `자료 ${id}`,
      originalFileName: `${id}.pdf`,
      mimeType: 'application/pdf',
      fileSize: 100,
      pageCount,
    })
    const pages = buildBinderViewerPages({
      id: 'binder',
      title: '상담',
      description: '',
      createdAt: '',
      updatedAt: '',
      sections: [
        {
          id: 'section-1',
          binderId: 'binder',
          title: '첫 섹션',
          sortOrder: 0,
          items: [
            {
              id: 'item-1',
              sectionId: 'section-1',
              materialId: '1',
              sortOrder: 0,
              pageSelection: [2, 4],
              material: material('1', 5),
            },
            {
              id: 'item-2',
              sectionId: 'section-1',
              materialId: '2',
              sortOrder: 1,
              pageSelection: null,
              material: material('2', 2),
            },
          ],
        },
      ],
    })
    expect(pages.map((page) => page.key)).toEqual([
      'item-1:2',
      'item-1:4',
      'item-2:1',
      'item-2:2',
    ])
  })
})
