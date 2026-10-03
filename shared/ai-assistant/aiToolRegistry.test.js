import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  loadAiToolRegistry,
  summarizeAiToolRegistry,
  summarizeAiToolRegistryByCategory,
  validateAiToolRegistry,
} from './registry.js'

describe('AI Tool Registry SSOT', () => {
  it('loads and validates catalog', () => {
    assert.equal(validateAiToolRegistry(), true)
    const tools = loadAiToolRegistry()
    assert.ok(tools.length >= 100)
    const keys = new Set(tools.map((t) => t.key))
    assert.equal(keys.size, tools.length)
    const implemented = tools.filter((t) => t.implementationStatus === 'IMPLEMENTED')
    assert.equal(implemented.length, 16)
  })

  it('summary counts match registry', () => {
    const tools = loadAiToolRegistry()
    const summary = summarizeAiToolRegistry(tools)
    assert.equal(summary.total, tools.length)
    assert.equal(
      summary.aiNotStarted + summary.aiInProgress + summary.aiConnected + summary.blocked,
      tools.length,
    )
  })

  it('category breakdown sums to total', () => {
    const tools = loadAiToolRegistry()
    const rows = summarizeAiToolRegistryByCategory(tools)
    const sum = rows.reduce((acc, r) => acc + r.total, 0)
    assert.equal(sum, tools.length)
  })

  it('requires confirmation defaults for READ vs SEND', () => {
    const tools = loadAiToolRegistry()
    const read = tools.find((t) => t.key === 'customer.search')
    const send = tools.find((t) => t.key === 'sms.send')
    assert.ok(read)
    assert.ok(send)
    assert.equal(read.requiresConfirmation, false)
    assert.equal(send.requiresConfirmation, true)
  })
})
