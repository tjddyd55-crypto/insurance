import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildAttachmentContentDisposition } from './storageContentDisposition.js'

describe('storageContentDisposition', () => {
  test('comma and Korean preserved in filename*', () => {
    const header = buildAttachmentContentDisposition('보험금청구서,진단서.pdf')
    assert.match(header, /^attachment;/)
    assert.match(header, /filename\*=UTF-8''/)
    const star = header.match(/filename\*=UTF-8''(.+)$/)?.[1]
    assert.equal(star, encodeURIComponent('보험금청구서,진단서.pdf'))
    assert.equal(decodeURIComponent(star), '보험금청구서,진단서.pdf')
  })

  test('spaces and plus in filename*', () => {
    const name = '보험금 청구서, 진단서(최종).pdf'
    const header = buildAttachmentContentDisposition(name)
    const star = header.match(/filename\*=UTF-8''(.+)$/)?.[1]
    assert.equal(decodeURIComponent(star), name)
  })
})
