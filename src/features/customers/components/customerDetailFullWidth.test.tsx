import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')
const listCardSource = readFileSync(
  join(root, 'features/customers/components/CustomerListCard.tsx'),
  'utf8',
)
const basicSectionSource = readFileSync(
  join(root, 'features/customers/components/detail-quick-crud/CustomerBasicInfoQuickSection.tsx'),
  'utf8',
)

describe('customerDetailFullWidth', () => {
  it('removes pc expand-detail horizontal inset so detail matches card width', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*width:\s*100%/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*padding:\s*0/s,
    )
    expect(indexCss).not.toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*padding:\s*0 16px/s,
    )
  })

  it('aligns pc detail toolbar with summary inner gutter only', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-toolbar\s*\{[^}]*padding-inline:\s*12px/s,
    )
  })

  it('keeps accordion section cards at full detail width', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion\s*\{[^}]*width:\s*100%/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion__panel\s*\{[^}]*padding:\s*12px/s,
    )
    expect(indexCss).not.toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion__panel\s*\{[^}]*padding:\s*12px 16px/s,
    )
  })

  it('uses the same basic read/edit wrapper in list card', () => {
    expect(listCardSource).toContain('customer-expand-detail')
    expect(listCardSource).toContain('CustomerDetailReadView')
    expect(basicSectionSource).toContain('customer-detail-read__field-list--editing')
    expect(basicSectionSource).toContain('customer-detail-read__field-list')
  })
})
