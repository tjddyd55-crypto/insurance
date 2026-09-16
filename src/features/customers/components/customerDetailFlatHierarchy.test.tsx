import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CUSTOMER_DETAIL_CORE_SECTIONS } from '../config/customerDetailCoreSectionOrder'
import { CustomerDetailAccordionSection } from './CustomerDetailAccordionSection'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')
const listCardSource = readFileSync(join(root, 'features/customers/components/CustomerListCard.tsx'), 'utf8')

describe('customerDetailFlatHierarchy', () => {
  it('keeps six accordion sections with accent bar', () => {
    expect(CUSTOMER_DETAIL_CORE_SECTIONS).toHaveLength(6)
    const html = renderToStaticMarkup(
      <CustomerDetailAccordionSection
        sectionId="basic"
        title="기본 정보"
        testId="customer-detail-section-basic"
        expanded={true}
        onExpandedChange={() => {}}
      >
        <p>body</p>
      </CustomerDetailAccordionSection>,
    )
    expect(html).toContain('customer-detail-accordion__accent')
  })

  it('removes pc expand-detail green outer card styling', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*border:\s*none/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*box-shadow:\s*none/s,
    )
  })

  it('uses flat pc accordion section layout without rounded card box', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion\s*\{[^}]*border:\s*none/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion__trigger\s*\{[^}]*border-bottom:/s,
    )
  })

  it('flattens quick crud rows inside pc accordion', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-quick-crud-card\s*\{[^}]*background:\s*transparent/s,
    )
  })

  it('hides duplicate customer name in pc detail toolbar', () => {
    expect(listCardSource).toContain('customer-detail-toolbar--pc-actions-only')
    expect(listCardSource).toMatch(
      /\{isMobile \? \([\s\S]*customer-detail-toolbar__title[\s\S]*\) : null\}/,
    )
  })
})
