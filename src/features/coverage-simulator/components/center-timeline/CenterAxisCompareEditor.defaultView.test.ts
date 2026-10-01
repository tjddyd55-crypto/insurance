import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const editorPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'CenterAxisCompareEditor.tsx',
)

describe('CenterAxisCompareEditor view modes on the 3-pane editor', () => {
  it('mounts the header switcher and keeps the default timeline', () => {
    const src = readFileSync(editorPath, 'utf8')
    expect(src).toMatch(/CoverageScenarioViewModeSwitcher/)
    expect(src).toMatch(/useCoverageScenarioViewMode/)
    expect(src).toMatch(/viewMode === 'default'/)
    expect(src).toMatch(/CoverageScenarioTimeline/)
    expect(src).toMatch(/CoverageScenarioAlternativeView/)
    expect(src).toMatch(/enableInlineAmountEdit/)
    expect(src).toMatch(/enableInlineTitleEdit/)
  })

  it('does not mount a second customer bar inside the compare editor', () => {
    const src = readFileSync(editorPath, 'utf8')
    expect(src).not.toMatch(/ConsultationCustomerBar/)
    expect(src).not.toMatch(/setConsultationCustomer/)
  })
})
