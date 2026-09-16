import { useCallback, useState } from 'react'
import {
  AddressSearchField,
  FormButton,
  FormInput,
  FormTextarea,
  formatAddressForSave,
  parseAddressFromStored,
  type AddressSearchValue,
} from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import { updateCustomer } from '../../api/customersApi'
import type { CustomerBusinessInfo } from '../../domain/customerBusinessInfo'
import {
  customerBusinessInfoToForm,
  emptyCustomerBusinessInfoForm,
  formatBusinessNumberDisplay,
  isCustomerBusinessInfoFormEmpty,
} from '../../domain/customerBusinessInfo'
import type { CustomerRecord } from '../../domain/types'
import { CustomerQuickFormDialog } from './CustomerQuickFormDialog'
import { getCustomerBusinessQuickCrudValidationError } from './customerQuickCrudValidation'

type ModalState =
  | { mode: 'closed' }
  | { mode: 'open'; draft: CustomerBusinessInfo; address: AddressSearchValue }

export type CustomerBusinessQuickSectionProps = {
  customer: CustomerRecord
  token: string | null
  onCustomerUpdated?: (customer: CustomerRecord) => void
  embedded?: boolean
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

export function CustomerBusinessQuickSection({
  customer,
  token,
  onCustomerUpdated,
  embedded = false,
}: CustomerBusinessQuickSectionProps) {
  const businessInfo = customer.businessInfo
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const hasAny =
    businessInfo &&
    (businessInfo.representativeName.trim() ||
      businessInfo.businessNumber.trim() ||
      businessInfo.businessAddress.trim() ||
      businessInfo.memo.trim())

  const parsedAddress = parseAddressFromStored(businessInfo?.businessAddress ?? '')

  const openModal = useCallback(() => {
    const draft = businessInfo ? customerBusinessInfoToForm(businessInfo) : emptyCustomerBusinessInfoForm()
    setFormError(null)
    setModal({
      mode: 'open',
      draft,
      address: parseAddressFromStored(draft.businessAddress),
    })
  }, [businessInfo])

  const closeModal = useCallback(() => {
    if (saving) {
      return
    }
    setModal({ mode: 'closed' })
    setFormError(null)
  }, [saving])

  const updateDraft = useCallback((patch: Partial<CustomerBusinessInfo>) => {
    setModal((current) => {
      if (current.mode !== 'open') {
        return current
      }
      return { ...current, draft: { ...current.draft, ...patch } }
    })
  }, [])

  const updateAddress = useCallback((address: AddressSearchValue) => {
    setModal((current) => {
      if (current.mode !== 'open') {
        return current
      }
      const businessAddress = formatAddressForSave(address)
      return {
        ...current,
        address,
        draft: { ...current.draft, businessAddress },
      }
    })
  }, [])

  const handleSave = useCallback(async () => {
    const tok = token?.trim()
    if (!tok || modal.mode !== 'open') {
      return
    }
    const validationError = getCustomerBusinessQuickCrudValidationError(modal.draft)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payloadBusiness = isCustomerBusinessInfoFormEmpty(modal.draft) ? null : modal.draft
      const updated = await updateCustomer(tok, customer.id, {
        businessInfo: payloadBusiness,
      })
      setModal({ mode: 'closed' })
      onCustomerUpdated?.(updated)
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
      console.error('[CustomerBusinessQuickSection] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [customer.id, modal, onCustomerUpdated, token])

  const canMutate = Boolean(token?.trim())
  const modalOpen = modal.mode === 'open'

  const body = (
    <div className="customer-detail-read__section-body customer-detail-read__grid customer-quick-crud-section">
      {hasAny ? (
        <>
          <ReadRow label="대표자명" value={businessInfo?.representativeName ?? ''} />
          <ReadRow
            label="사업자번호"
            value={formatBusinessNumberDisplay(businessInfo?.businessNumber ?? '')}
          />
          <ReadRow label="사업장 주소" value={parsedAddress.baseAddress || businessInfo?.businessAddress || ''} />
          {parsedAddress.detailAddress.trim() ? (
            <ReadRow label="상세주소" value={parsedAddress.detailAddress} />
          ) : null}
          {businessInfo?.memo.trim() ? (
            <div className="customer-detail-read__memo-block customer-detail-read__grid-span-all">
              {businessInfo.memo}
            </div>
          ) : null}
        </>
      ) : (
        <p className="customer-business-read-section__empty customer-detail-read__grid-span-all">
          등록된 사업자 정보가 없습니다.
        </p>
      )}
      {canMutate ? (
        <div className="customer-quick-crud-section__add customer-detail-read__grid-span-all">
          <FormButton htmlType="button" variant="secondary" size="sm" disabled={saving} onClick={openModal}>
            {hasAny ? '수정' : '+ 사업자 정보 등록'}
          </FormButton>
        </div>
      ) : null}

      <CustomerQuickFormDialog
        open={modalOpen}
        title={hasAny ? '사업자 정보 수정' : '사업자 정보 등록'}
        saving={saving}
        errorMessage={formError}
        onClose={closeModal}
        onSave={handleSave}
      >
        {modalOpen ? (
          <div className="customer-quick-form-dialog__fields">
            <label className="field">
              <span className="field__label">대표자명</span>
              <FormInput
                className="field__control"
                value={modal.draft.representativeName}
                disabled={saving}
                onChange={(e) => updateDraft({ representativeName: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">사업자번호</span>
              <FormInput
                className="field__control"
                inputMode="numeric"
                placeholder="000-00-00000"
                value={modal.draft.businessNumber}
                disabled={saving}
                onChange={(e) => updateDraft({ businessNumber: e.target.value })}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">사업장 주소</span>
              <AddressSearchField
                className="address-search-field"
                value={modal.address}
                disabled={saving}
                onChange={updateAddress}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">메모</span>
              <FormTextarea
                className="field__control customer-form-textarea"
                rows={3}
                value={modal.draft.memo}
                disabled={saving}
                onChange={(e) => updateDraft({ memo: e.target.value })}
              />
            </label>
          </div>
        ) : null}
      </CustomerQuickFormDialog>
    </div>
  )

  if (embedded) {
    return body
  }

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-business-info-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-business-info-heading" className="customer-detail-read__section-title">
          사업자 정보
        </h4>
      </div>
      {body}
    </section>
  )
}
