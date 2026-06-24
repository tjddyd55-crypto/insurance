import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('todo customer links branch by platform', () => {
  const src = readFileSync(
    join(repoRoot, 'src/features/todos/utils/relatedEntityNavigate.ts'),
    'utf8',
  )
  assert.match(src, /buildExternalCustomerNavigateTarget/)
  assert.match(src, /isMobile: options\.isMobile === true/)
  assert.doesNotMatch(src, /return `\/customers\/\$\{id\}\/memos`/)
})

test('external customer navigate helper splits PC and mobile', () => {
  const src = readFileSync(
    join(repoRoot, 'src/features/customers/utils/customerRoutePaths.ts'),
    'utf8',
  )
  assert.match(src, /PC_DEFAULT_CUSTOMER_WORKSPACE_TAB/)
  assert.match(src, /if \(params\.isMobile\)/)
  assert.match(src, /buildCustomerListPath\(next\)/)
})

test('PC customer selection resets to consultations', () => {
  const src = readFileSync(join(repoRoot, 'src/features/customers/pages/CustomersPage.tsx'), 'utf8')
  assert.match(src, /tab: PC_DEFAULT_CUSTOMER_WORKSPACE_TAB/)
})

test('customer workspace default tab is consultations', () => {
  const src = readFileSync(
    join(repoRoot, 'src/features/customers/utils/customerWorkspaceNavigation.ts'),
    'utf8',
  )
  assert.match(src, /return 'consultations'/)
})
