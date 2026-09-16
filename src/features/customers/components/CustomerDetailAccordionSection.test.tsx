import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomerDetailAccordionSection } from './CustomerDetailAccordionSection'

describe('CustomerDetailAccordionSection', () => {
  it('renders native-style accent bar without card border inline styles', () => {
    const html = renderToStaticMarkup(
      <CustomerDetailAccordionSection
        sectionId="vehicle"
        title="자동차 정보"
        testId="customer-detail-section-vehicle"
        expanded={true}
        onExpandedChange={() => {}}
      >
        <p>body</p>
      </CustomerDetailAccordionSection>,
    )
    expect(html).toContain('customer-detail-accordion__accent')
    expect(html).toContain('customer-detail-accordion--expanded')
    expect(html).not.toContain('bg-soft')
    expect(html).toContain('background-color:#2563EB')
    expect(html).not.toContain('border-width:')
  })
})
