import type { CustomerRecord } from '../domain/types'
import { useCustomerCustomFields } from '../hooks/useCustomerCustomFields'
import { CustomerCustomFieldsReadList } from './CustomerCustomFieldsReadList'

export type CustomerCustomFieldsReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

export function CustomerCustomFieldsReadSection({
  customer,
  token,
  enabled,
}: CustomerCustomFieldsReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { customFields, isLoading, errorMessage } = useCustomerCustomFields({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })

  if (!shouldFetch) {
    return null
  }

  if (!isLoading && !errorMessage && customFields.length === 0) {
    return null
  }

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-custom-fields-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-custom-fields-heading" className="customer-detail-read__section-title">
          추가 정보
        </h4>
      </div>
      <div className="customer-detail-read__section-body customer-custom-fields-read">
        {errorMessage ? (
          <p className="customer-detail-read__api-warn" role="status">
            {errorMessage}
          </p>
        ) : null}
        <CustomerCustomFieldsReadList items={customFields} loading={shouldFetch && isLoading} />
      </div>
    </section>
  )
}
