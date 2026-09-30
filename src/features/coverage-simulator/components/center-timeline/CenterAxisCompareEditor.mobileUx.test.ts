import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const editorPath = join(dirname(fileURLToPath(import.meta.url)), 'CenterAxisCompareEditor.tsx')
const eventRowMenuPath = join(dirname(fileURLToPath(import.meta.url)), 'EventRowMenu.tsx')
const shareThemePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../styles/share-public-fixed-theme.css',
)

describe('CenterAxisCompareEditor mobile UX regression guards', () => {
  it('uses direct-edit row menu and inline outside commit session on mobile', () => {
    const src = readFileSync(editorPath, 'utf8')
    expect(src).toMatch(/itemMenuMode=\{useLatestMobileEditor \? 'direct-edit' : 'popover'\}/)
    expect(src).toMatch(/commitRegisteredInlineAmount/)
    expect(src).toMatch(/pointerdown/)
    expect(src).not.toMatch(/itemMenuMode=\{useLatestMobileEditor \? 'action-sheet'/)
  })

  it('EventRowMenu supports direct-edit without ItemActionSheet', () => {
    const src = readFileSync(eventRowMenuPath, 'utf8')
    expect(src).toMatch(/menuMode === 'direct-edit'/)
  })

  it('share public fixed light theme SSOT is scoped to public shells', () => {
    const css = readFileSync(shareThemePath, 'utf8')
    expect(css).toMatch(/color-scheme:\s*light only/)
    expect(css).toMatch(/:has\(\.cs-share-public-shell\)/)
  })
})
