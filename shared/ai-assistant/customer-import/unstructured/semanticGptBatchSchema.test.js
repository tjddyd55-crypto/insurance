import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SEMANTIC_GPT_BATCH_JSON_SCHEMA } from './semanticGptBatchSchema.js'

describe('semanticGptBatchSchema', () => {
  it('requires recordId on each batch item', () => {
    const itemRequired = SEMANTIC_GPT_BATCH_JSON_SCHEMA.schema.properties.items.items.required
    assert.ok(itemRequired.includes('recordId'))
    assert.ok(itemRequired.includes('multiPersonHint'))
  })
})
