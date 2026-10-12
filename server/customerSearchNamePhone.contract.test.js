import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

function block(src, start, end) {
  const i = src.indexOf(start)
  assert.ok(i >= 0, `missing ${start}`)
  const j = src.indexOf(end, i + start.length)
  return src.slice(i, j < 0 ? undefined : j)
}

for (const [label, file, start, end] of [
  ['GET /customers/search', './index.js', "apiRouter.get('/customers/search'", "apiRouter.get('/customers'"],
  ['GET /contracts/customers/search', './apis/contractUserApi.js', "'/contracts/customers/search'", 'const sql ='],
]) {
  test(`${label}: name(공백 무시) + digits-normalized phone only`, () => {
    const b = block(read(file), start, end)
    assert.match(b, /regexp_replace\(COALESCE\(c\.name, ''\), '\\\\s', '', 'g'\) ILIKE/)
    assert.match(b, /regexp_replace\(COALESCE\(c\.phone, ''\), '\\\\D', '', 'g'\) LIKE/)
    assert.doesNotMatch(b, /customer_code ILIKE/)
    assert.doesNotMatch(b, /c\.id = \$/)
    assert.doesNotMatch(b, /c\.phone ILIKE/)
    for (const where of b.match(/AND \(\s*regexp_replace[\s\S]*?\n\s*\)\n/g) ?? []) {
      assert.doesNotMatch(where, /address|memo|customer_code/i)
    }
  })
}
