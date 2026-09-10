import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = join(import.meta.dirname, '..', '..')
const indexSource = readFileSync(join(root, 'server/index.js'), 'utf8')

function extractAuthenticatedCustomerCreateInsert() {
  const routeIdx = indexSource.indexOf("apiRouter.post('/customers', requireAuth")
  assert.ok(routeIdx > 0, 'POST /customers route not found')
  const slice = indexSource.slice(routeIdx, routeIdx + 6000)
  const insertMatch = slice.match(/INSERT INTO customers\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)\s*RETURNING/)
  assert.ok(insertMatch, 'authenticated customer INSERT not found')
  const columns = insertMatch[1]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  const valuesClause = insertMatch[2]
  const placeholderNumbers = [...valuesClause.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]))
  const maxPlaceholder = Math.max(...placeholderNumbers)
  return { columns, maxPlaceholder, placeholderNumbers }
}

describe('POST /customers INSERT placeholders', () => {
  it('keeps INSERT column count aligned with VALUES placeholders', () => {
    const { columns, maxPlaceholder, placeholderNumbers } = extractAuthenticatedCustomerCreateInsert()
    assert.equal(columns.length, 35)
    assert.equal(maxPlaceholder, 35)
    assert.equal(placeholderNumbers.length, 35)
    assert.deepEqual(
      [...new Set(placeholderNumbers)].sort((a, b) => a - b),
      Array.from({ length: 35 }, (_, i) => i + 1),
    )
  })
})
