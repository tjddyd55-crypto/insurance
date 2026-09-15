import { useEffect, useState } from 'react'
import { getCustomerById, updateCustomer } from '../api/customersApi'
import type { CustomerBusinessInfo } from '../domain/customerBusinessInfo'
import {
  customerBusinessInfoToForm,
  emptyCustomerBusinessInfoForm,
  formatBusinessNumberDisplay,
  isCustomerBusinessInfoFormEmpty,
} from '../domain/customerBusinessInfo'
import { CustomerCollapsibleSection } from './CustomerCollapsibleSection'
import { CustomerSectionQuickEditDialog } from './CustomerSectionQuickEditDialog'
import {
  AddressSearchField,
  FormButton,
  FormInput,
  FormTextarea,
  formatAddressForSave,
  parseAddressFromSave,
} from '../../../components/form'

export type CustomerBusinessInfoReadSectionProps = {
  customerId: number
  businessInfo: CustomerBusinessInfo | null | undefined
  token: string | null
  enabled: boolean
}

function ReadRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
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
  const [expanded, setExpanded] = useState(false)
  const [localInfo, setLocalInfo] = useState<CustomerBusinessInfo | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CustomerBusinessInfo>(emptyCustomerBusinessInfoForm())
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
        if (!cancelled) setFetchedInfo(row?.businessInfo ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : '사업자 정보를 불러오지 못했습니다.')
          setFetchedInfo(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shouldFetch, token, customerId])

  const displayInfo = localInfo ?? businessInfo ?? fetchedInfo
  const hasAny = Boolean(displayInfo && !isCustomerBusinessInfoFormEmpty(displayInfo))

  const openEditor = () => {
    setDraft(customerBusinessInfoToForm(displayInfo))
    setFormError(null)
    setOpen(true)
    setExpanded(true)
  }

  const save = async () => {
    if (!token?.trim()) return
    setBusy(true)
    setFormError(null)
    try {
      const next = {
        representativeName: draft.representativeName.trim(),
        businessNumber: draft.businessNumber.trim(),
        businessAddress: draft.businessAddress.trim(),
        memo: draft.memo.trim(),
      }
      const updated = await updateCustomer(token, customerId, {
        businessInfo: isCustomerBusinessInfoFormEmpty(next) ? null : next,
      })
      setLocalInfo(updated.businessInfo ?? null)
      if (shouldFetch) {
        setFetchedInfo(updated.businessInfo ?? null)
      }
      setOpen(false)
      setExpanded(true)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <CustomerCollapsibleSection
        sectionId="business"
        title="사업자 정보"
        headingId="customer-business-info-heading"
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        {errorMessage ? <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p> : null}
        {isLoading ? <p className="customer-detail-read__loading-hint">불러오는 중…</p> : null}
        {!isLoading && hasAny ? (
          <>
            <ReadRow label="대표자명" value={displayInfo!.representativeName} />
            <ReadRow label="사업자번호" value={formatBusinessNumberDisplay(displayInfo!.businessNumber)} />
            <ReadRow label="사업장 주소" value={displayInfo!.businessAddress} />
            {displayInfo!.memo.trim() ? (
              <div className="customer-detail-read__memo-block">{displayInfo!.memo}</div>
            ) : null}
            <button type="button" className="customer-section-read-row__edit customer-section-read-row__edit--solo" onClick={openEditor}>
              수정
            </button>
          </>
        ) : null}
        {!isLoading && !hasAny && !errorMessage ? (
          <>
            <p className="customer-detail-read__empty-hint">등록된 사업자 정보가 없습니다.</p>
            <FormButton htmlType="button" variant="secondary" size="sm" className="customer-section-read-add" onClick={openEditor}>
              + 사업자 정보 등록
            </FormButton>
          </>
        ) : null}
      </CustomerCollapsibleSection>

      <CustomerSectionQuickEditDialog
        open={open}
        title={hasAny ? '사업자 정보 수정' : '사업자 정보 등록'}
        busy={busy}
        onCancel={() => setOpen(false)}
        onSave={() => void save()}
      >
        <label className="field">
          <span className="field__label">대표자명</span>
          <FormInput value={draft.representativeName} onChange={(e) => setDraft((p) => ({ ...p, representativeName: e.target.value }))} />
        </label>
        <label className="field">
          <span className="field__label">사업자번호</span>
          <FormInput value={draft.businessNumber} onChange={(e) => setDraft((p) => ({ ...p, businessNumber: e.target.value }))} />
        </label>
        <AddressSearchField
          value={parseAddressFromSave(draft.businessAddress)}
          onChange={(address) => setDraft((p) => ({ ...p, businessAddress: formatAddressForSave(address) }))}
        />
        <label className="field field--wide">
          <span className="field__label">메모</span>
          <FormTextarea rows={2} value={draft.memo} onChange={(e) => setDraft((p) => ({ ...p, memo: e.target.value }))} />
        </label>
        {formError ? <p className="field-error" role="alert">{formError}</p> : null}
      </CustomerSectionQuickEditDialog>
    </>
  )
}
