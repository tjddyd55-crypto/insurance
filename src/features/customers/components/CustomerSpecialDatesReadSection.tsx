import { CUSTOMER_DESIGNATED_DATE_LABEL } from '../../../../shared/customerDesignatedDateCopy.js'
import type { CustomerRecord } from '../domain/types'
import { useCustomerSpecialDates } from '../hooks/useCustomerSpecialDates'
import { CustomerSpecialDatesReadList } from './CustomerSpecialDatesReadList'

export type CustomerSpecialDatesReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
  embedded?: boolean
}

export function CustomerSpecialDatesReadSection({
  customer,
  token,
  enabled,
  embedded = false,
}: CustomerSpecialDatesReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { specialDates, isLoading, errorMessage } = useCustomerSpecialDates({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })

  const body = (
    <div className="customer-detail-read__section-body customer-special-dates-read">
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">
          {errorMessage}
        </p>
      ) : null}
      <CustomerSpecialDatesReadList items={specialDates} loading={shouldFetch && isLoading} />
    </div>
  )

  if (embedded) {
    return body
  }

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-special-dates-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-special-dates-heading" className="customer-detail-read__section-title">
          {CUSTOMER_DESIGNATED_DATE_LABEL}
        </h4>
      </div>
      {body}
    </section>
  )
}
