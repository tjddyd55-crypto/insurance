import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('todo customer links target consultations', () => {
  const src = readFileSync(
    join(repoRoot, 'src/features/todos/utils/relatedEntityNavigate.ts'),
    'utf8',
  )
  assert.match(src, /return `\/customers\/\$\{id\}\/consultations`/)
  assert.doesNotMatch(src, /return `\/customers\/\$\{id\}\/memos`/)
})

test('customer workspace default tab is consultations', () => {
  const src = readFileSync(
    join(repoRoot, 'src/features/customers/utils/customerWorkspaceNavigation.ts'),
    'utf8',
  )
  assert.match(src, /return 'consultations'/)
})
