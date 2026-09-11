import type { CustomerRecord } from '../domain/types'
import { useCustomerSpecialDates } from '../hooks/useCustomerSpecialDates'
import { CustomerSpecialDatesReadList } from './CustomerSpecialDatesReadList'
import { CustomerCollapsibleSection } from './CustomerCollapsibleSection'

export type CustomerSpecialDatesReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

export function CustomerSpecialDatesReadSection({
  customer,
  token,
  enabled,
}: CustomerSpecialDatesReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { specialDates, isLoading, errorMessage } = useCustomerSpecialDates({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })

  return (
    <CustomerCollapsibleSection
      sectionId="anniversary"
      title="기념일"
      headingId="customer-special-dates-heading"
      defaultExpanded
      className="customer-special-dates-read"
    >
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">
          {errorMessage}
        </p>
      ) : null}
      <CustomerSpecialDatesReadList items={specialDates} loading={shouldFetch && isLoading} />
    </CustomerCollapsibleSection>
  )
}
