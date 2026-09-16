import { type ReactNode, useId } from 'react'

export type CustomerDetailAccordionSectionProps = {
  title: string
  testId: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: ReactNode
}

export function CustomerDetailAccordionSection({
  title,
  testId,
  expanded,
  onExpandedChange,
  children,
}: CustomerDetailAccordionSectionProps) {
  const headingId = useId()

  return (
    <section
      className={`customer-detail-accordion${expanded ? ' customer-detail-accordion--expanded' : ''}`}
      data-testid={testId}
    >
      <button
        type="button"
        className="customer-detail-accordion__trigger"
        aria-expanded={expanded}
        aria-controls={headingId}
        onClick={() => onExpandedChange(!expanded)}
      >
        <span className="customer-detail-accordion__title">{title}</span>
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
