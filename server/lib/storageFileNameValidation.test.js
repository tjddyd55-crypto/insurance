import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  FILE_NAME_MAX_LENGTH,
  isValidStorageFileName,
  normalizeStorageFileName,
  sanitizeStorageFileNameForObjectKey,
} from './storageFileNameValidation.js'

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
  test('accepts common Korean and punctuation filenames', () => {
    for (const name of ACCEPTED_FILENAMES) {
      assert.equal(isValidStorageFileName(name), true, `expected valid: ${name}`)
      assert.equal(normalizeStorageFileName(name), name)
    }
  })

  test('rejects path separators and unsafe characters', () => {
    assert.equal(isValidStorageFileName('foo/bar.pdf'), false)
    assert.equal(isValidStorageFileName('foo\\bar.pdf'), false)
    assert.equal(isValidStorageFileName('foo<bar>.pdf'), false)
    assert.equal(isValidStorageFileName('foo"bar".pdf'), false)
    assert.equal(isValidStorageFileName(''), false)
  })

  test('rejects double-quote in display filename (header safety)', () => {
    assert.equal(isValidStorageFileName('보험금청구서 "최종",진단서.pdf'), false)
  })

  test('normalizes whitespace and enforces max length', () => {
    assert.equal(normalizeStorageFileName('  a  b  .pdf'), 'a b .pdf')
    const long = 'a'.repeat(FILE_NAME_MAX_LENGTH + 10)
    assert.equal(normalizeStorageFileName(long).length, FILE_NAME_MAX_LENGTH)
  })

  test('object key sanitize replaces comma but keeps extension', () => {
    assert.equal(
      sanitizeStorageFileNameForObjectKey('보험금청구서,진단서.pdf'),
      '보험금청구서_진단서.pdf',
    )
    assert.equal(sanitizeStorageFileNameForObjectKey('청구서+진단서.pdf'), '청구서_진단서.pdf')
  })
})
