import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CUSTOMER_DETAIL_CORE_SECTIONS } from '../config/customerDetailCoreSectionOrder'
import { CustomerDetailAccordionSection } from './CustomerDetailAccordionSection'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const indexCss = readFileSync(join(root, 'index.css'), 'utf8')
const readViewSource = readFileSync(
  join(root, 'features/customers/components/CustomerDetailReadView.tsx'),
  'utf8',
)
const scrollHookSource = readFileSync(
  join(root, 'features/customers/hooks/useCustomerExpandedCardScroll.ts'),
  'utf8',
)

describe('customerDetailNativeCardLayout', () => {
  it('keeps six independent accordion section cards with accent bar', () => {
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
    expect(html).toContain('customer-detail-accordion--expanded')
  })

  it('removes pc expand-detail green outer card styling', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*border:\s*none/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-expand-detail\s*\{[^}]*box-shadow:\s*none/s,
    )
  })

  it('uses native-style pc section cards without outer wrapper card', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion\s*\{[^}]*gap:/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion\s*\{[^}]*border:\s*1px/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-detail-accordion\s*\{[^}]*border-radius:\s*12px/s,
    )
  })

  it('uses label/value field rows in basic info', () => {
    expect(readViewSource).toContain('customer-detail-read__field-list')
    expect(readViewSource).toContain('DetailReadFieldRow')
    expect(indexCss).toMatch(/\.customer-detail-read__field-row\s*\{[^}]*grid-template-columns:\s*140px/s)
  })

  it('keeps health subsection and full-width question block', () => {
    expect(readViewSource).toContain('CustomerMedicalHistoryReadSection')
    expect(indexCss).toContain('customer-detail-read__subsection--health')
    expect(indexCss).toContain('customer-detail-read__field-block--full')
  })

  it('flattens quick crud item cards inside pc section cards', () => {
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-quick-crud-card\s*\{[^}]*border:\s*none/s,
    )
    expect(indexCss).toMatch(
      /\.customers-page--pc \.customer-detail-read--accordion \.customer-quick-crud-card\s*\{[^}]*border-bottom:/s,
    )
  })

  it('does not reintroduce accordion scroll compensation helpers', () => {
    expect(scrollHookSource).not.toContain('ResizeObserver')
  })
})
