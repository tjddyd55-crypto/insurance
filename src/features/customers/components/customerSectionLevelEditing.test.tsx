import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const listCardSource = readFileSync(
  join(root, 'features/customers/components/CustomerListCard.tsx'),
  'utf8',
)
const readViewSource = readFileSync(
  join(root, 'features/customers/components/CustomerDetailReadView.tsx'),
  'utf8',
)
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')

describe('customerSectionLevelEditing', () => {
  it('removes pc global edit button for insurance layout', () => {
    expect(listCardSource).toContain('const useFullEditForm = isMobile || !crmIsInsuranceLayout')
    expect(listCardSource).toContain('customer-detail-action-button--compact')
    expect(listCardSource).toContain('customer-detail-action-button--danger-muted')
    const editButtonBlock = listCardSource.match(
      /\{useFullEditForm \? \([\s\S]*?\) : null\}/,
    )?.[0]
    expect(editButtonBlock).toBeTruthy()
    expect(editButtonBlock).toContain('수정')
    expect(editButtonBlock).toContain('onStartEdit(c)')
    expect(listCardSource).toContain('useFullEditForm && editingId === c.id && editForm')
  })

  it('keeps basic info section edit action and custom fields quick crud', () => {
    expect(readViewSource).toContain('CustomerBasicInfoEditAction')
    expect(readViewSource).toContain('CustomerCustomFieldsQuickInlineSection')
    expect(readViewSource).not.toContain('onStartEditBasic')
  })

  it('uses pc detail horizontal padding', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*padding:\s*0 16px/s,
    )
  })

  it('styles compact pc copy/delete actions', () => {
    expect(indexCss).toContain('customer-detail-action-button--compact')
    expect(indexCss).toContain('customer-detail-action-button--danger-muted')
  })
})
