import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGaGroupSlug, validateGaGroupSlug } from './gaGroupSlug.js'

test('normalizeGaGroupSlug lowercases and trims hyphens', () => {
  assert.equal(normalizeGaGroupSlug(' YjAsset '), 'yjasset')
  assert.equal(normalizeGaGroupSlug('영진 에셋'), '')
})

test('validateGaGroupSlug accepts simple slug', () => {
  const r = validateGaGroupSlug('yjasset')
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.slug, 'yjasset')
  }
})

test('validateGaGroupSlug rejects single char', () => {
  const r = validateGaGroupSlug('a')
  assert.equal(r.ok, false)
})
