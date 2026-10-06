import type { CustomerRecord } from '../domain/types'
import { useCustomerCustomFields } from '../hooks/useCustomerCustomFields'
import { CustomerCustomFieldsReadList } from './CustomerCustomFieldsReadList'

export type CustomerBasicInlineCustomFieldsReadProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

/** 기본 정보 accordion 내부 인라인 추가 정보 — 별도 accordion 없음 */
export function CustomerBasicInlineCustomFieldsRead({
  customer,
  token,
  enabled,
}: CustomerBasicInlineCustomFieldsReadProps) {
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
    <div
      className="customer-detail-read__subsection customer-basic-inline-custom-fields"
      data-testid="customer-basic-inline-custom-fields"
    >
      <h5 className="customer-detail-read__subsection-title">추가 정보</h5>
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">
          {errorMessage}
        </p>
      ) : null}
      <CustomerCustomFieldsReadList items={customFields} loading={shouldFetch && isLoading} />
    </div>
  )
}
