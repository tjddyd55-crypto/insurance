/**
 * Form control SSOT — portal/모바일에서도 .pc-root 없이 스타일이 적용되어야 한다.
 * radio/checkbox 는 텍스트 입력 SSOT 와 분리한다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(dir, '../../src/index.css'), 'utf8')
const formInput = readFileSync(join(dir, '../../src/components/form/FormInput.tsx'), 'utf8')
const todoDialog = readFileSync(
  join(dir, '../../src/features/todos/components/TodoEditorDialog.tsx'),
  'utf8',
)
const claimDetail = readFileSync(
  join(dir, '../../src/features/claim-requests/pages/claim-requests/sections/ClaimRequestDetailSection.tsx'),
  'utf8',
)

test('form-input SSOT excludes radio/checkbox and keeps text field chrome', () => {
  assert.match(css, /:not\(\[type='radio'\]\):not\(\[type='checkbox'\]\)/)
  assert.match(css, /min-height:\s*var\(--control-height-md,\s*40px\)/)
  assert.match(css, /border-radius:\s*10px/)
  assert.match(css, /border-color:\s*var\(--input-focus-border\)/)
  assert.match(css, /\.form-select\s*\{[^}]*appearance:\s*none/s)
  assert.match(css, /\.form-textarea\s*\{[^}]*height:\s*auto/s)
  assert.match(css, /\.form-textarea\s*\{[^}]*min-height:\s*96px/s)
})

test('FormInput maps radio/checkbox to form-radio/form-checkbox classes', () => {
  assert.match(formInput, /form-radio/)
  assert.match(formInput, /form-checkbox/)
  assert.match(formInput, /isChoiceControl/)
  assert.match(css, /\.form-radio[\s,][^]*?width:\s*20px/)
  assert.match(css, /\.form-checkbox[\s,][^]*?width:\s*18px/)
  assert.match(css, /\.customer-form-gender-options label[\s\S]*?white-space:\s*nowrap/)
  assert.match(css, /\.customer-driving-radio-option__label[\s\S]*?white-space:\s*nowrap/)
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
