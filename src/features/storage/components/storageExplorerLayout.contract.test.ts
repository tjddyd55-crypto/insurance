import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const css = readFileSync(join(repoRoot, 'src/index.css'), 'utf8')

test('storage explorer grid prioritizes filename over action width', () => {
  assert.match(css, /--storage-explorer-file-grid-columns/)
  assert.match(css, /minmax\(0,\s*1fr\)/)
  assert.match(css, /--storage-explorer-file-name-min-width/)
  assert.match(css, /minmax\(0,\s*max-content\)/)
  assert.doesNotMatch(css, /minmax\(200px,\s*1\.4fr\)/)
})

test('storage explorer panel chrome uses shared header height tokens', () => {
  assert.match(css, /--storage-explorer-breadcrumb-row-height/)
  assert.match(css, /--storage-explorer-column-header-row-height/)
  assert.match(css, /--storage-explorer-breadcrumb-min-height/)
  assert.match(css, /--storage-explorer-panel-header-min-height/)
  assert.match(css, /\.storage-explorer-chrome__breadcrumb-row/)
  assert.match(css, /\.storage-explorer-chrome__column-header-row/)
  assert.match(css, /\.storage-explorer-tree__breadcrumb-spacer/)
})

test('storage explorer responsive breakpoints hide secondary columns before filename', () => {
  assert.match(css, /@media \(max-width: 1200px\)[\s\S]*\.storage-explorer-files__date/)
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*\.storage-explorer-files__size/)
  assert.doesNotMatch(
    css,
    /@media \(max-width: 960px\)[\s\S]*\.storage-explorer-files__type[\s\S]*display:\s*none/,
  )
})
