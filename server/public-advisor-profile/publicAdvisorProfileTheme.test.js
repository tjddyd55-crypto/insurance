import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdvisorProfileTheme } from './publicAdvisorProfileTheme.js'

test('normalizeAdvisorProfileTheme defaults to classic', () => {
  assert.equal(normalizeAdvisorProfileTheme(null), 'classic')
  assert.equal(normalizeAdvisorProfileTheme(''), 'classic')
  assert.equal(normalizeAdvisorProfileTheme('unknown'), 'classic')
})

test('normalizeAdvisorProfileTheme allowlist', () => {
  assert.equal(normalizeAdvisorProfileTheme('classic'), 'classic')
  assert.equal(normalizeAdvisorProfileTheme('Brand'), 'brand')
  assert.equal(normalizeAdvisorProfileTheme('PREMIUM'), 'premium')
})
