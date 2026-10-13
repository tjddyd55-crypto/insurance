import { describe, expect, it } from 'vitest'

import {
  mapSharedDetailToPersonalBinder,
  resolveSharedBinderShareFileId,
} from './mapSharedDetailToPersonalBinder'
import type { SharedPersonalBinderDetail } from '../personalBinderShare.api'

const sampleDetail: SharedPersonalBinderDetail = {
  id: '12',
  title: '공유 테스트',
  description: '',
  ownerUserId: 'u1',
  ownerName: 'A',
  gaId: 1,
  sectionCount: 1,
  fileCount: 1,
  totalBytes: 100,
  shareVersion: 1,
  sourceBinderId: '3',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'active',
  sections: [
    {
      id: 's1',
      title: '섹션',
      sortOrder: 0,
      items: [
        {
          id: 'i1',
          shareFileId: '99',
          sortOrder: 0,
          pageSelection: [1, 2],
          material: {
            title: '자료',
            originalFileName: 'doc.pdf',
            mimeType: 'application/pdf',
            fileSize: 100,
            pageCount: 5,
          },
        },
      ],
    },
  ],
}

describe('mapSharedDetailToPersonalBinder', () => {
  it('maps share file ids for shared viewer downloads', () => {
    const binder = mapSharedDetailToPersonalBinder(sampleDetail)
    const material = binder.sections[0].items[0].material
    expect(resolveSharedBinderShareFileId(material)).toBe('99')
    expect(material.fileId).toBe(0)
  })
})
