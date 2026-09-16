import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const readViewSource = readFileSync(
  join(root, 'features/customers/components/CustomerDetailReadView.tsx'),
  'utf8',
)
const basicSectionSource = readFileSync(
  join(root, 'features/customers/components/detail-quick-crud/CustomerBasicInfoQuickSection.tsx'),
  'utf8',
)
const saveUtilsSource = readFileSync(
  join(root, 'features/customers/utils/customerBasicCoreSaveUtils.ts'),
  'utf8',
)
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')

describe('customerBasicInlineEdit', () => {
  it('uses inline basic section instead of modal quick form dialog', () => {
    expect(readViewSource).toContain('CustomerBasicInfoSection')
    expect(readViewSource).toContain('기본 정보 수정 중')
    expect(basicSectionSource).toContain('customer-detail-read__inline-edit-actions')
    expect(basicSectionSource).not.toContain('CustomerQuickFormDialog')
    expect(basicSectionSource).toContain('isCustomerBasicCoreDraftDirty')
  })

  it('keeps basic core save contract without child collections', () => {
    expect(saveUtilsSource).toContain('saveCustomerBasicCoreInfo')
    expect(saveUtilsSource).not.toContain('cars')
    expect(saveUtilsSource).not.toContain('specialDates')
    expect(saveUtilsSource).not.toContain('customFields')
  })

  it('restores full-width section cards on pc detail', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion\s*\{[^}]*width:\s*100%/s,
    )
    expect(indexCss).toMatch(
      /\.customer-basic-core-edit-fields\s*\{[^}]*max-width:\s*none/s,
    )
    expect(indexCss).not.toMatch(/\.customer-basic-core-edit-fields\s*\{[^}]*max-width:\s*720px/s)
  })
})
