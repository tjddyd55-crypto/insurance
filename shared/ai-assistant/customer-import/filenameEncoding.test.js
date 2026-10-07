import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeUploadedFileName } from './filenameEncoding.js'

describe('normalizeUploadedFileName', () => {
  it('decodes latin1-mojibake UTF-8 filenames', () => {
    const utf8 = '편집충돌_서버_01. 고객관리.xlsx'
    const mojibake = Buffer.from(utf8, 'utf8').toString('latin1')
    assert.equal(normalizeUploadedFileName(mojibake), utf8)
  })

  it('keeps plain ASCII filenames', () => {
    assert.equal(normalizeUploadedFileName('English.xlsx'), 'English.xlsx')
  })
})
