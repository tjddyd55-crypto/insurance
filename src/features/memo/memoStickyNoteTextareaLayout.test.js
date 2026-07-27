import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8')
const formTextareaSource = readFileSync(join(root, 'src/components/form/FormTextarea.tsx'), 'utf8')

describe('memo sticky note textarea fill layout', () => {
  it('overrides shared form-textarea fixed sizing inside memo content', () => {
    assert.match(
      indexCss,
      /\.memo-sticky-note__content\s*>\s*textarea\.form-textarea\.memo-sticky-note__textarea/,
    )
    assert.match(indexCss, /\.pc-root\s+\.memo-sticky-note__content\s*>\s*textarea\.form-textarea\.memo-sticky-note__textarea/)
    assert.match(indexCss, /min-height:\s*0/)
    assert.match(indexCss, /height:\s*100%/)
    assert.match(indexCss, /resize:\s*none/)
    assert.match(indexCss, /flex:\s*1\s+1\s+auto/)
  })

  it('keeps shared form-textarea defaults for non-memo fields', () => {
    assert.match(indexCss, /\.form-textarea\s*\{[^}]*min-height:\s*96px/s)
    assert.match(indexCss, /\.pc-root\s+\.form-textarea[\s\S]*?min-height:\s*96px/)
    assert.doesNotMatch(formTextareaSource, /fillContainer|variant\s*=/)
  })

  it('keeps memo card column flex shell', () => {
    assert.match(indexCss, /\.memo-sticky-note__root\s*\{[^}]*display:\s*flex/s)
    assert.match(indexCss, /\.memo-sticky-note__root\s*\{[^}]*flex-direction:\s*column/s)
    assert.match(indexCss, /\.memo-sticky-note__content\s*\{[^}]*min-height:\s*0/s)
    assert.match(indexCss, /\.memo-sticky-note__footer\s*\{[^}]*flex-shrink:\s*0/s)
  })

  it('uses distinct editor vs focus background tokens without changing fill layout', () => {
    assert.match(indexCss, /--memo-editor-bg:\s*transparent/)
    assert.match(indexCss, /--memo-editor-focus-bg:\s*#fffdf2/)
    assert.match(
      indexCss,
      /textarea\.form-textarea\.memo-sticky-note__textarea:focus[\s\S]*?background:\s*var\(--memo-editor-focus-bg/,
    )
    assert.match(
      indexCss,
      /textarea\.form-textarea\.memo-sticky-note__textarea--editing\s*,[\s\S]*?background:\s*var\(--memo-editor-bg/,
    )
    const focusBlock = indexCss.match(
      /\.memo-sticky-note__content\s*>\s*textarea\.form-textarea\.memo-sticky-note__textarea:focus[\s\S]*?background:\s*var\(--memo-editor-focus-bg[^;]*;/,
    )?.[0]
    assert.ok(focusBlock)
    assert.doesNotMatch(focusBlock, /height\s*:/)
    assert.doesNotMatch(focusBlock, /flex\s*:/)
    assert.doesNotMatch(focusBlock, /resize\s*:/)
  })
})
