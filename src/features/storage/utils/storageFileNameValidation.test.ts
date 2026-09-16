import { describe, expect, it } from 'vitest'

import { isValidStorageFileName, normalizeStorageFileName } from './storageFileNameValidation'

const ACCEPTED_FILENAMES = [
  'test.pdf',
  '보험금청구서.pdf',
  '보험금청구서,진단서.pdf',
  '보험금 청구서, 진단서.pdf',
  '청구서(최종).pdf',
  '청구서+진단서.pdf',
  '청구서_2026-09-16.pdf',
  '청구서#1.pdf',
  '청구서&진단서.pdf',
]

describe('storageFileNameValidation', () => {
  it('accepts comma and other punctuation in display filenames', () => {
    for (const name of ACCEPTED_FILENAMES) {
      expect(isValidStorageFileName(name)).toBe(true)
      expect(normalizeStorageFileName(name)).toBe(name)
    }
  })

  it('rejects path separators', () => {
    expect(isValidStorageFileName('foo/bar.pdf')).toBe(false)
    expect(isValidStorageFileName('foo\\bar.pdf')).toBe(false)
  })

  it('rejects double-quote in display filename', () => {
    expect(isValidStorageFileName('보험금청구서 "최종",진단서.pdf')).toBe(false)
  })
})
