/**
 * Form control SSOT — portal/모바일에서도 .pc-root 없이 스타일이 적용되어야 한다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(dir, '../../src/index.css'), 'utf8')
const todoDialog = readFileSync(
  join(dir, '../../src/features/todos/components/TodoEditorDialog.tsx'),
  'utf8',
)
const claimDetail = readFileSync(
  join(dir, '../../src/features/claim-requests/pages/claim-requests/sections/ClaimRequestDetailSection.tsx'),
  'utf8',
)

test('form-input/select/textarea SSOT is root-agnostic (not only .pc-root)', () => {
  assert.match(css, /\.form-input,\s*\n\.form-select,\s*\n\.form-textarea\s*\{[^}]*border-radius:\s*10px/s)
  assert.match(css, /\.form-input,\s*\n\.form-select\s*\{[^}]*min-height:\s*48px/s)
  assert.match(css, /\.form-textarea\s*\{[^}]*padding:\s*12px/s)
  assert.match(css, /\.form-select\s*\{[^}]*appearance:\s*none/s)
  assert.match(
    css,
    /\.form-input:focus:not\(:disabled\):not\(\[readonly\]\),\s*\n\.form-input:focus-visible[^\{]*\{[^}]*border-color:\s*var\(--input-focus-border\)/s,
  )
})

test('TodoEditorDialog uses FormInput/FormTextarea/AppDateInput', () => {
  assert.match(todoDialog, /FormTextarea/)
  assert.match(todoDialog, /FormInput/)
  assert.match(todoDialog, /AppDateInput/)
  assert.match(todoDialog, /todo-editor-dialog/)
  assert.equal(todoDialog.includes('max-w-xs'), false)
})

test('ClaimRequestDetailBody uses FormSelect and FormTextarea for status', () => {
  assert.match(claimDetail, /FormSelect/)
  assert.match(claimDetail, /FormTextarea/)
  assert.match(claimDetail, /claim-status-note-textarea/)
  assert.match(claimDetail, /claim-requests-page__status-select/)
})
