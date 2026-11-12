import { describe, expect, it } from 'vitest'

import {
  binderMaterialDownloadName,
  isBinderImageMaterial,
  resolveBinderMaterialRenderKind,
  splitBinderFileDisplayName,
} from './binderFileDisplay'

describe('splitBinderFileDisplayName', () => {
  it('splits extension from display name', () => {
    const result = splitBinderFileDisplayName({
      id: '1',
      title: '상담자료.final.pdf',
      displayName: 'stale.pdf',
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

describe('resolveBinderMaterialRenderKind', () => {
  const base = {
    id: '1',
    title: 't',
    fileSize: 1,
    pageCount: 1,
    fileId: 1,
    originalFileName: 'a.pdf',
  }

  it('treats image mime as image', () => {
    expect(
      resolveBinderMaterialRenderKind({
        ...base,
        mimeType: 'image/png',
        originalFileName: 'a.png',
      }),
    ).toBe('image')
    expect(isBinderImageMaterial({ ...base, mimeType: 'image/jpeg', originalFileName: 'a.jpg' })).toBe(true)
  })

  it('infers image from file name when mime is empty', () => {
    expect(
      resolveBinderMaterialRenderKind({
        ...base,
        mimeType: '',
        originalFileName: 'photo.JPG',
      }),
    ).toBe('image')
  })

  it('defaults to pdf for application/pdf', () => {
    expect(resolveBinderMaterialRenderKind({ ...base, mimeType: 'application/pdf' })).toBe('pdf')
  })
})

describe('splitBinderFileDisplayName — original file name', () => {
  it('uses resolved title when original upload name differs', () => {
    const result = splitBinderFileDisplayName({
      id: '1',
      title: '촬영 자료',
      originalFileName: '1758065437402.jpg',
      mimeType: 'image/jpeg',
      pageCount: 1,
      fileId: 1,
      fileSize: 1,
    })
    expect(result.baseName).toBe('촬영 자료')
    expect(result.extension).toBe('JPG')
  })
})

it('downloads with resolved title and preserves only the original extension', () => {
  const material = { title: 'Current', originalFileName: 'Upload.pdf', mimeType: 'application/pdf' } as Parameters<typeof binderMaterialDownloadName>[0]
  expect(binderMaterialDownloadName(material)).toBe('Current.pdf')
  expect(binderMaterialDownloadName({ ...material, title: 'Custom.pdf' })).toBe('Custom.pdf')
})
