import assert from 'node:assert/strict'
import test from 'node:test'
import { serializeSharePageSelection } from './personalBinderShareService.js'

test('serializeSharePageSelection: NULL(all pages) stays SQL NULL, never jsonb null', () => {
  assert.equal(serializeSharePageSelection(null), null)
  assert.equal(serializeSharePageSelection(undefined), null)
})
test('serializeSharePageSelection: arrays serialize as JSON arrays', () => {
  assert.equal(serializeSharePageSelection([1, 3, 4]), '[1,3,4]')
  assert.equal(serializeSharePageSelection('[2,5]'), '[2,5]')
})
test('serializeSharePageSelection: non-array values fall back to NULL (all pages)', () => {
  assert.equal(serializeSharePageSelection({}), null)
  assert.equal(serializeSharePageSelection('null'), null)
  assert.equal(serializeSharePageSelection('garbage'), null)
})
