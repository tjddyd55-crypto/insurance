/**
 * Contract guards for CustomerRelationsStrip — avoids ReferenceError regressions
 * (e.g. legacyLinkOpen used without useState) without requiring a browser runner.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const stripPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/features/customers/components/CustomerRelationsStrip.tsx',
)
const src = readFileSync(stripPath, 'utf8')

test('declares legacyLinkOpen with useState(false)', () => {
  assert.match(
    src,
    /const \[legacyLinkOpen,\s*setLegacyLinkOpen\]\s*=\s*useState\(false\)/,
    'legacyLinkOpen must be declared via useState — missing declaration crashes /customers',
  )
})

test('group member click uses onOpenCustomer prop', () => {
  assert.match(src, /onOpenCustomer\(m\.customerId,\s*m\.name\)/)
})

test('legacy 1:1 chip click uses onOpenCustomer prop', () => {
  assert.match(src, /onOpenCustomer\(r\.relatedCustomerId,\s*r\.relatedName\)/)
})

test('does not invent a separate legacyLinkOpen open-customer function', () => {
  assert.equal(src.includes('legacyLinkOpen('), false)
  assert.equal(src.includes('legacyLinkOpen ='), false)
})

test('onOpenCustomer is a required Props field', () => {
  assert.match(src, /onOpenCustomer:\s*\(id:\s*number,\s*name\?:\s*string\)\s*=>\s*void/)
})
