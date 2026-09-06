import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'resolveNewsletterPostAuthorLabel.ts'),
  'utf8',
)

describe('resolveNewsletterPostAuthorLabel frontend SSOT', () => {
  it('keeps board label out of fallback chain', () => {
    assert.match(source, /legacy && legacy !== boardLabel/)
    assert.doesNotMatch(source, /board\.label/)
  })
})
