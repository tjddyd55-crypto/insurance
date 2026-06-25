import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBoardMetadataPatch } from './newsletterBoardMetadata.js'
import { PATCH_NEWSLETTER_BOARD_SQL } from './newsletterBoardAdminSql.js'

test('parseBoardMetadataPatch rejects empty label', () => {
  const result = parseBoardMetadataPatch({ label: '   ' })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
})

test('parseBoardMetadataPatch accepts trimmed label and optional description', () => {
  const result = parseBoardMetadataPatch({ label: ' 노무사 소식지 ', description: '안내' })
  assert.equal(result.ok, true)
  assert.equal(result.label, '노무사 소식지')
  assert.equal(result.description, '안내')
})

test('parseBoardMetadataPatch allows name alias', () => {
  const result = parseBoardMetadataPatch({ name: '공지' })
  assert.equal(result.ok, true)
  assert.equal(result.label, '공지')
})

test('PATCH newsletter board SQL does not modify slug', () => {
  assert.doesNotMatch(PATCH_NEWSLETTER_BOARD_SQL, /\bslug\b/i)
})
