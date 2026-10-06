import { type ReactNode, useId } from 'react'
import type { CustomerDetailCoreSectionId } from '../config/customerDetailCoreSectionOrder'
import { customerDetailSectionTheme } from '../config/customerSectionTheme'

export type CustomerDetailAccordionSectionProps = {
  sectionId: CustomerDetailCoreSectionId
  title: string
  testId: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: ReactNode
}

export function CustomerDetailAccordionSection({
  sectionId,
  title,
  testId,
  expanded,
  onExpandedChange,
  children,
}: CustomerDetailAccordionSectionProps) {
  const headingId = useId()
  const theme = customerDetailSectionTheme(sectionId)

  return (
    <section
      className={`customer-detail-accordion${expanded ? ' customer-detail-accordion--expanded' : ''}`}
      data-testid={testId}
      data-section-id={sectionId}
      style={{
        ['--customer-section-accent' as string]: theme.accent,
      }}
    >
      <button
        type="button"
        className="customer-detail-accordion__trigger"
        aria-expanded={expanded}
        aria-controls={headingId}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          onExpandedChange(!expanded)
        }}
      >
        <span className="customer-detail-accordion__title-wrap">
          <span
            className="customer-detail-accordion__accent"
            aria-hidden="true"
            style={{ backgroundColor: theme.accent }}
          />
          <span className="customer-detail-accordion__title">{title}</span>
        </span>
        <span className="customer-detail-accordion__chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <div id={headingId} className="customer-detail-accordion__panel">
          {children}
        </div>
      ) : null}
    </section>
  )
}
