import { type ReactNode, useState } from 'react'
import type { CustomerSectionId } from '../theme/customerSectionTheme'

export type CustomerCollapsibleSectionProps = {
  sectionId: CustomerSectionId
  title: string
  headingId: string
  children: ReactNode
  defaultExpanded?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** 헤더 우측(토글 앞) — 연계 고객 액션 등 */
  headerExtra?: ReactNode
  className?: string
  /** false면 접기 UI 없이 항상 펼침(상담 PC panel 등) */
  collapsible?: boolean
}

export function CustomerCollapsibleSection({
  sectionId,
  title,
  headingId,
  children,
  defaultExpanded = true,
  expanded: expandedProp,
  onExpandedChange,
  headerExtra,
  className,
  collapsible = true,
}: CustomerCollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const expanded = expandedProp ?? internalExpanded
  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) {
      setInternalExpanded(next)
    }
    onExpandedChange?.(next)
  }
  const isOpen = collapsible ? expanded : true

  const header = collapsible ? (
    <button
      type="button"
      className="customer-detail-section__header"
      aria-expanded={isOpen}
      aria-controls={`${headingId}-body`}
      onClick={() => setExpanded(!expanded)}
    >
      <span className="customer-detail-section__accent-bar" aria-hidden />
      <h4 id={headingId} className="customer-detail-section__title">{title}</h4>
      {headerExtra ? (
        <div className="customer-detail-section__header-extra" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
        </div>
      ) : null}
      <span className="customer-detail-section__toggle" aria-hidden>
        {isOpen ? '최소 ˄' : '펼치기 ˅'}
      </span>
    </button>
  ) : (
    <div className="customer-detail-section__header customer-detail-section__header--static">
      <span className="customer-detail-section__accent-bar" aria-hidden />
      <h4 id={headingId} className="customer-detail-section__title">{title}</h4>
      {headerExtra ? (
        <div className="customer-detail-section__header-extra">{headerExtra}</div>
      ) : null}
    </div>
  )

  return (
    <section
      className={`customer-detail-section customer-detail-section--${sectionId}${className ? ` ${className}` : ''}`}
      data-customer-section={sectionId}
      aria-labelledby={headingId}
    >
      <div className="customer-detail-section__shell">
        {header}
        {isOpen ? (
          <div id={`${headingId}-body`} className="customer-detail-section__body">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}
