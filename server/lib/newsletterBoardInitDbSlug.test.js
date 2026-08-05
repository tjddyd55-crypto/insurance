import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const initDb = fs.readFileSync(path.join(repoRoot, 'server/initDb.js'), 'utf8')

test('initDb does not recreate obsolete global active-slug unique index early', () => {
  assert.doesNotMatch(
    initDb,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_boards_active_slug\s+ON newsletter_boards\(slug\)/,
  )
})

test('initDb soft-deletes active slug duplicates before scoped unique index', () => {
  assert.match(initDb, /PARTITION BY slug, COALESCE\(owner_ga_id, 0\)/)
  assert.match(initDb, /idx_newsletter_boards_active_slug_scope/)
  assert.match(initDb, /r\.rn > 1/)
})
