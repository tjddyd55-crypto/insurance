import { useEffect, useState } from 'react'
import type { CustomerRecord } from '../domain/types'
import { listCustomerFireInsuranceLocations } from '../api/customerFireInsuranceLocationsApi'
import type { CustomerFireInsuranceLocationRecord } from '../api/customerFireInsuranceLocationsApi'

export type CustomerFireInsuranceLocationsReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

export function CustomerFireInsuranceLocationsReadSection({
  customer,
  token,
  enabled,
}: CustomerFireInsuranceLocationsReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const [locations, setLocations] = useState<CustomerFireInsuranceLocationRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!shouldFetch) {
      setLocations([])
      setErrorMessage(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)
    void listCustomerFireInsuranceLocations(token!, customer.id)
      .then((rows) => {
        if (!cancelled) {
          setLocations(rows)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : '화재보험 소재지를 불러오지 못했습니다.')
          setLocations([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [shouldFetch, token, customer.id])

  const embedded = customer.fireInsuranceLocations
  const displayLocations =
    shouldFetch && !errorMessage && !isLoading
      ? locations
      : Array.isArray(embedded)
        ? embedded
        : locations

  const hasContent = displayLocations.some((loc) => loc.address.trim() || loc.memo.trim())

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-fire-insurance-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-fire-insurance-heading" className="customer-detail-read__section-title">
          화재보험 정보
        </h4>
      </div>
      <div className="customer-detail-read__section-body">
        {errorMessage ? (
          <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p>
        ) : null}
        {isLoading ? <p className="customer-detail-read__loading-hint">불러오는 중…</p> : null}
        {!isLoading && !hasContent ? '내용 없음' : null}
        {!isLoading && hasContent
          ? displayLocations.map((loc, i) => {
              const n = i + 1
              const address = loc.address?.trim() ?? ''
              const memo = loc.memo?.trim() ?? ''
              if (!address && !memo) {
                return null
              }
              return (
                <div key={loc.id ?? `idx-${i}`} className="customer-fire-location-read-block">
                  <h5 className="customer-fire-location-read-block__title">소재지 {n}</h5>
                  {address ? (
                    <p className="customer-detail-read__info-line">
                      <span className="customer-detail-read__info-label">주소:</span>{' '}
                      <span className="customer-detail-read__info-value">{address}</span>
                    </p>
                  ) : null}
                  {memo ? <div className="customer-detail-read__memo-block">{memo}</div> : null}
                </div>
              )
            })
          : null}
      </div>
    </section>
  )
}
