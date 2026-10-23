import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

const editor = readFileSync(join(dir, 'pages/PersonalBinderEditorPage.tsx'), 'utf8')
const picker = readFileSync(join(dir, 'components/MaterialAddSourceDialog.tsx'), 'utf8')
const css = readFileSync(join(dir, 'styles/personal-binder.css'), 'utf8')

describe('binder editor and material picker contract', () => {
  it('reuses the customer accordion chevron and toggles from the section header', () => {
    expect(editor).toContain('customer-detail-accordion__chevron')
    expect(editor).toContain("sectionCollapsed ? '▸' : '▾'")
    expect(editor).toContain('aria-expanded={!sectionCollapsed}')
    expect(editor).toContain('event.stopPropagation()')
    expect(css).toContain('.personal-binder-section-card__header .customer-detail-accordion__chevron')
    expect(css).toContain('transition: opacity 0.15s ease')
  })

  it('keeps PDF download and drops the editor print action', () => {
    expect(editor).toMatch(/>\s*PDF\s*</)
    expect(editor).not.toMatch(/>\s*출력\s*</)
  })

  it('pins the material picker footer and scrolls the stage', () => {
    expect(picker).toContain('personal-binder-material-picker__footer')
    expect(picker).toContain('개 선택')
    expect(picker).toContain('선택한 자료')
    expect(picker).toContain('newsletterSelectedCount === 0')
    expect(picker).toContain('personal-binder-material-picker__stage')
    expect(css).toMatch(/\.personal-binder-material-picker__stage[\s\S]*min-height:\s*0/)
    expect(css).toMatch(/\.personal-binder-material-picker__stage[\s\S]*overflow:\s*hidden/)
    expect(css).toMatch(/\.personal-binder-material-picker__footer[\s\S]*flex-shrink:\s*0/)
    expect(css).toMatch(/\.newsletter-picker__grid[\s\S]*overflow-y:\s*auto/)
  })
})
