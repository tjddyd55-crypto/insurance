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
    expect(listCardSource).toContain('showPcHeaderCopyAction')
    expect(listCardSource).toContain('showPcDeleteFooter')
    const editButtonBlock = listCardSource.match(
      /\{useFullEditForm \? \([\s\S]*?\) : null\}/,
    )?.[0]
    expect(editButtonBlock).toBeTruthy()
    expect(editButtonBlock).toContain('수정')
    expect(editButtonBlock).toContain('onStartEdit(c)')
    expect(listCardSource).toContain('useFullEditForm && editingId === c.id && editForm')
  })

  it('keeps basic info inline section editing and custom fields quick crud', () => {
    expect(readViewSource).toContain('CustomerBasicInfoSection')
    expect(readViewSource).not.toContain('CustomerBasicInfoEditAction')
    expect(readViewSource).not.toContain('onStartEditBasic')
  })

  it('keeps pc expanded detail full card width without extra horizontal inset', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*width:\s*100%/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*max-width:\s*none/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*padding:\s*0/s,
    )
    expect(indexCss).not.toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*padding:\s*0 16px/s,
    )
  })

  it('styles pc header copy icon and bottom delete footer', () => {
    expect(listCardSource).toContain('CustomerListCopySvg')
    expect(listCardSource).toContain('customer-detail-delete-footer')
    expect(indexCss).toContain('.customers-page--pc .customer-card__copy-action')
    expect(indexCss).toContain('.customer-detail-delete-footer')
  })
})
