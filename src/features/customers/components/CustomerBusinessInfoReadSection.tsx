import { useEffect, useState } from 'react'
import { getCustomerById } from '../api/customersApi'
import type { CustomerBusinessInfo } from '../domain/customerBusinessInfo'
import { formatBusinessNumberDisplay } from '../domain/customerBusinessInfo'

export type CustomerBusinessInfoReadSectionProps = {
  customerId: number
  businessInfo: CustomerBusinessInfo | null | undefined
  token: string | null
  enabled: boolean
}

function ReadRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null
  }
  return (
    <p className="customer-detail-read__info-line">
      <span className="customer-detail-read__info-label">{label}:</span>{' '}
      <span className="customer-detail-read__info-value">{value}</span>
    </p>
  )
}

export function CustomerBusinessInfoReadSection({
  customerId,
  businessInfo,
  token,
  enabled,
}: CustomerBusinessInfoReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim() && !businessInfo)
  const [fetchedInfo, setFetchedInfo] = useState<CustomerBusinessInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!shouldFetch) {
      setFetchedInfo(null)
      setErrorMessage(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)
    void getCustomerById(token!, customerId)
      .then((row) => {
        if (!cancelled) {
          setFetchedInfo(row?.businessInfo ?? null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : '사업자 정보를 불러오지 못했습니다.',
          )
          setFetchedInfo(null)
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
  }, [shouldFetch, token, customerId])

  const displayInfo = businessInfo ?? fetchedInfo

  const hasAny = Boolean(
    displayInfo &&
      (displayInfo.representativeName.trim() ||
        displayInfo.businessNumber.trim() ||
        displayInfo.businessAddress.trim() ||
        displayInfo.memo.trim()),
  )

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-business-info-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-business-info-heading" className="customer-detail-read__section-title">
          사업자 정보
        </h4>
      </div>
      <div className="customer-detail-read__section-body">
        {errorMessage ? (
          <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p>
        ) : null}
        {isLoading ? <p className="customer-detail-read__loading-hint">불러오는 중…</p> : null}
        {!isLoading && hasAny ? (
          <>
            <ReadRow label="대표자명" value={displayInfo.representativeName} />
            <ReadRow
              label="사업자번호"
              value={formatBusinessNumberDisplay(displayInfo.businessNumber)}
            />
            <ReadRow label="사업장 주소" value={displayInfo.businessAddress} />
            {displayInfo.memo.trim() ? (
              <div className="customer-detail-read__memo-block">{displayInfo.memo}</div>
            ) : null}
          </>
        ) : null}
        {!isLoading && !hasAny && !errorMessage ? '내용 없음' : null}
      </div>
    </section>
  )
}
