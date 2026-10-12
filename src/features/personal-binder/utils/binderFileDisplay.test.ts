import { describe, expect, it } from 'vitest'

import { splitBinderFileDisplayName } from './binderFileDisplay'

describe('splitBinderFileDisplayName', () => {
  it('splits extension from display name', () => {
    const result = splitBinderFileDisplayName({
      id: '1',
      title: 't',
      displayName: '상담자료.final.pdf',
      originalFileName: 'x.pdf',
      mimeType: 'application/pdf',
      pageCount: 3,
      fileId: 'f',
    })
    expect(result.baseName).toBe('상담자료.final')
    expect(result.extension).toBe('PDF')
  })

  it('infers PDF when no extension', () => {
    const result = splitBinderFileDisplayName({
      id: '1',
      title: 'doc',
      mimeType: 'application/pdf',
      pageCount: 1,
      fileId: 'f',
    })
    expect(result.extension).toBe('PDF')
  })
})
