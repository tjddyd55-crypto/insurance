import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { collectStorageFileObjectKeyCandidates, resolveStorageFileObjectKey } from './storageFileObjectKey.js'

describe('collectStorageFileObjectKeyCandidates', () => {
  it('returns relative key and root variants for plain path', () => {
    const keys = collectStorageFileObjectKeyCandidates('files/user-1/123-doc.pdf')
    assert.ok(keys.includes('files/user-1/123-doc.pdf'))
    assert.equal(keys[0], 'files/user-1/123-doc.pdf')
  })

  it('parses pathname from https URL when CDN base differs', () => {
    const keys = collectStorageFileObjectKeyCandidates(
      'https://old-cdn.example.com/platform-assets/insurer/ga1/user/files/storage/2024/01/1700000000_test.pdf',
    )
    assert.ok(
      keys.some((k) =>
        k.includes('platform-assets/insurer/ga1/user/files/storage/2024/01/1700000000_test.pdf'),
      ),
    )
  })

  it('skips file:// scheme', () => {
    assert.deepEqual(collectStorageFileObjectKeyCandidates('file:///C:/tmp/a.pdf'), [])
  })

  it('resolveStorageFileObjectKey returns first candidate', () => {
    assert.equal(resolveStorageFileObjectKey('files/a/b.pdf'), 'files/a/b.pdf')
    assert.equal(resolveStorageFileObjectKey(''), null)
  })
})
