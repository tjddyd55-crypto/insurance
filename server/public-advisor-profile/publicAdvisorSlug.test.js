import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDefaultAdvisorSlug, isAdvisorPublicSlugValid, normalizeAdvisorPublicSlug } from './publicAdvisorSlug.js'

test('normalizeAdvisorPublicSlug strips invalid characters', () => {
  assert.equal(normalizeAdvisorPublicSlug('  Hong-Gildong FC '), 'hong-gildong-fc')
})

test('reserved slug is rejected', () => {
  assert.equal(isAdvisorPublicSlugValid('experts'), false)
  assert.equal(isAdvisorPublicSlugValid('hong-gildong'), true)
})

test('buildDefaultAdvisorSlug falls back safely', () => {
  const slug = buildDefaultAdvisorSlug({ username: '!!', displayName: '', userId: 'user-abc-123' })
  assert.equal(isAdvisorPublicSlugValid(slug), true)
})
