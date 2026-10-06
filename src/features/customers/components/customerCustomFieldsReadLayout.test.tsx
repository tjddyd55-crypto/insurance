import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const customFieldsSource = readFileSync(
  join(root, 'features/customers/components/detail-quick-crud/CustomerCustomFieldsQuickInlineSection.tsx'),
  'utf8',
)

describe('customerCustomFieldsReadLayout', () => {
  it('does not render hardcoded 라벨/내용 labels in read rows', () => {
    expect(customFieldsSource).not.toContain('customer-quick-crud-card__label">라벨')
    expect(customFieldsSource).not.toContain('customer-quick-crud-card__label">내용')
    expect(customFieldsSource).not.toContain('customer-quick-crud-card__fields--inline')
  })

  it('renders user label/value with shared read typography classes', () => {
    expect(customFieldsSource).toContain('customer-custom-fields-read__label">{item.label}')
    expect(customFieldsSource).toContain('customer-custom-fields-read__value')
    expect(customFieldsSource).toContain('내용 없음')
    expect(customFieldsSource).toContain('customer-custom-fields-read__row')
  })

  it('keeps edit/delete actions and add button in subsection', () => {
    expect(customFieldsSource).toContain('수정')
    expect(customFieldsSource).toContain('삭제')
    expect(customFieldsSource).toContain('+ 항목 추가')
    expect(customFieldsSource).toContain('추가 정보')
  })
})
