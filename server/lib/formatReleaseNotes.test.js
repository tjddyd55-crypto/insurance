import test from 'node:test'
import assert from 'node:assert/strict'
import { formatReleaseNotes } from '../../shared/formatReleaseNotes.js'

test('formatReleaseNotes — strips HTML paragraph tags', () => {
  const input = '<p>fix(customers): maximize customer map viewport</p>'
  assert.equal(formatReleaseNotes(input), 'fix(customers): maximize customer map viewport')
})

test('formatReleaseNotes — converts br and decodes entities', () => {
  const input = '<p>line1</p><br/><p>line2 &amp; more</p>'
  assert.equal(formatReleaseNotes(input), 'line1\n\nline2 & more')
})

test('formatReleaseNotes — joins array release notes', () => {
  const input = [{ note: '<p>first</p>' }, { note: 'second' }]
  assert.equal(formatReleaseNotes(input), 'first\n\nsecond')
})

test('formatReleaseNotes — empty input fallback', () => {
  assert.equal(formatReleaseNotes(null), '업데이트 내용이 없습니다.')
  assert.equal(formatReleaseNotes(''), '업데이트 내용이 없습니다.')
})
