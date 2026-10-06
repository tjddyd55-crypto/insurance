import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')
const medicalReadSource = readFileSync(
  join(root, 'features/customers/components/CustomerMedicalHistoryRead.tsx'),
  'utf8',
)
const basicSectionSource = readFileSync(
  join(root, 'features/customers/components/detail-quick-crud/CustomerBasicInfoQuickSection.tsx'),
  'utf8',
)

describe('customerDetailTypography', () => {
  it('defines shared label/value/hint/empty typography tokens', () => {
    expect(indexCss).toContain('.customer-detail-read__label')
    expect(indexCss).toContain('.customer-detail-read__value')
    expect(indexCss).toContain('.customer-detail-read__hint')
    expect(indexCss).toContain('.customer-detail-read__empty')
    expect(indexCss).toMatch(/\.customer-detail-read__field-label[\s\S]*color:\s*var\(--text-sub\)/)
    expect(indexCss).toMatch(/\.customer-detail-read__field-value[\s\S]*font-weight:\s*600/)
  })

  it('applies muted question and hint styles in health subsection', () => {
    expect(medicalReadSource).toContain('customer-detail-read__field-question')
    expect(medicalReadSource).toContain('customer-detail-read__hint')
    expect(medicalReadSource).toContain('customer-detail-read__info-answer')
    expect(indexCss).toMatch(/\.customer-detail-read__field-question\s*\{[^}]*color:\s*var\(--text-sub\)/s)
    expect(indexCss).toMatch(/\.customer-detail-read__hint[\s\S]*font-size:\s*0\.8125rem/)
  })

  it('styles insurance/account subsection values as dark data text', () => {
    expect(basicSectionSource).toContain('customer-insurance-history-body')
    expect(basicSectionSource).toContain('customer-account-number-read__value')
    expect(indexCss).toMatch(
      /\.customer-detail-read \.customer-insurance-history-body[\s\S]*font-weight:\s*600/,
    )
    expect(indexCss).toMatch(
      /\.customer-detail-read \.customer-account-number-read__value[\s\S]*font-weight:\s*600/,
    )
  })

  it('uses subsection titles as muted labels', () => {
    expect(basicSectionSource).toContain('customer-detail-read__subsection-title')
    expect(indexCss).toMatch(/\.customer-detail-read__subsection-title\s*\{[^}]*color:\s*var\(--text-sub\)/s)
  })
})
