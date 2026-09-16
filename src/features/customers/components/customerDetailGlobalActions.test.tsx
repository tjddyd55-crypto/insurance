import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const listCardSource = readFileSync(
  join(root, 'features/customers/components/CustomerListCard.tsx'),
  'utf8',
)
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')

describe('customerDetailGlobalActions', () => {
  it('moves pc copy action into header before favorite and removes top copy button row', () => {
    expect(listCardSource).toContain('showPcHeaderCopyAction')
    expect(listCardSource).toContain('icon-box--copy')
    expect(listCardSource).toContain('CustomerListCopySvg')
    expect(listCardSource).toContain('aria-label="고객 정보 복사"')
    expect(listCardSource).not.toContain('customer-detail-action-button--copy')
    expect(listCardSource).not.toContain('customer-detail-action-button--copy')
    const favoriteIndex = listCardSource.indexOf('즐겨찾기 해제')
    const copyIndex = listCardSource.indexOf('aria-label="고객 정보 복사"')
    expect(copyIndex).toBeGreaterThan(-1)
    expect(favoriteIndex).toBeGreaterThan(copyIndex)
  })

  it('removes pc top delete button and places danger delete footer after detail sections', () => {
    expect(listCardSource).toContain('showPcDeleteFooter')
    expect(listCardSource).toContain('customer-detail-delete-footer')
    expect(listCardSource).toContain('CustomerListDeleteSvg')
    expect(listCardSource).toContain('고객 삭제')
    expect(listCardSource).not.toContain('customer-detail-action-button--danger-muted')
    const readViewIndex = listCardSource.indexOf('<CustomerDetailReadView')
    const deleteFooterIndex = listCardSource.indexOf('className="customer-detail-delete-footer"')
    expect(readViewIndex).toBeGreaterThan(-1)
    expect(deleteFooterIndex).toBeGreaterThan(readViewIndex)
  })

  it('hides pc global action toolbar when not editing', () => {
    expect(listCardSource).toContain('showDetailToolbar = isMobile || isEditingThisCard')
    expect(listCardSource).not.toContain('customer-detail-toolbar--pc-actions-only')
    expect(indexCss).toContain('.customer-detail-delete-footer')
    expect(indexCss).toContain('.customers-page--pc .customer-card__copy-action')
  })
})
