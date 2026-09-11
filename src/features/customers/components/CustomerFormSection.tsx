import type { ReactNode } from 'react'
import type { CustomerSectionId } from '../theme/customerSectionTheme'

export type CustomerFormSectionProps = {
  title: string
  description?: string
  /** 제목 옆 액션(예: 자동차 추가 버튼) */
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  /** Figma section accent — 지정 시 tinted header 적용 */
  sectionId?: CustomerSectionId
}

export function CustomerFormSection({
  title,
  description,
  headerExtra,
  children,
  className,
  sectionId,
}: CustomerFormSectionProps) {
  return (
    <section
      className={`customer-form-section${className ? ` ${className}` : ''}`}
      data-customer-section={sectionId ?? undefined}
    >
      <div className="customer-form-section__header">
        {sectionId ? <span className="customer-form-section__accent-bar" aria-hidden /> : null}
        <div className="customer-form-section__title-row">
          <h3 className="customer-form-section__title">{title}</h3>
          {headerExtra ? (
            <div className="customer-form-section__header-extra">{headerExtra}</div>
          ) : null}
        </div>
        {description ? (
          <p className="customer-form-section__description">{description}</p>
        ) : null}
      </div>
      <div className="customer-form-section__body">{children}</div>
    </section>
  )
}
