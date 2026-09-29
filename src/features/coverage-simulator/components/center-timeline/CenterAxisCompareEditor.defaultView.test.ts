import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const editorPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'CenterAxisCompareEditor.tsx',
)

describe('CenterAxisCompareEditor default timeline only', () => {
  it('does not mount alternative view or view mode switcher', () => {
    const src = readFileSync(editorPath, 'utf8')
    expect(src).not.toMatch(/CoverageScenarioViewModeSwitcher/)
    expect(src).not.toMatch(/CoverageScenarioAlternativeView/)
    expect(src).not.toMatch(/useCoverageScenarioViewMode/)
    expect(src).toMatch(/CoverageScenarioTimeline/)
  })
})
