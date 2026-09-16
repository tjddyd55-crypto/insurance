import { useCallback, useMemo, useState } from 'react'
import { parseAddressFromStored } from '../../../../components/form'
import { FormButton } from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import type { CustomerRecord } from '../../domain/types'
import { recordToEditForm } from '../../utils/customerEditFormState'
import {
  type CustomerBasicCoreFormDraft,
  saveCustomerBasicCoreInfo,
} from '../../utils/customerBasicCoreSaveUtils'
import { CustomerBasicCoreEditFields } from './CustomerBasicCoreEditFields'
import { CustomerQuickFormDialog } from './CustomerQuickFormDialog'

function recordToBasicCoreDraft(customer: CustomerRecord): CustomerBasicCoreFormDraft {
  const form = recordToEditForm(customer)
  const parsed = parseAddressFromStored(customer.address ?? '')
  return {
    name: form.name,
    gender: form.gender,
    ssn: form.ssn,
    phone: form.phone,
    carrier: form.carrier,
    smsOptOut: form.smsOptOut,
    inflowSource: form.inflowSource,
    referrerName: form.referrerName,
    birthDate: form.birthDate,
    zonecode: parsed.zonecode,
    address: parsed.baseAddress,
    addressDetail: parsed.detailAddress,
    height: form.height,
    weight: form.weight,
    job: form.job,
    isDriver: form.isDriver,
    treatmentHistoryNote: form.treatmentHistoryNote,
    medicationHistoryNote: form.medicationHistoryNote,
    insuranceHistory: form.insuranceHistory,
    accountNumber: form.accountNumber,
  }
}

export type CustomerBasicInfoQuickSectionProps = {
  customer: CustomerRecord
  token: string | null
  onCustomerUpdated?: (customer: CustomerRecord) => void
}

export function CustomerBasicInfoEditAction({
  customer,
  token,
  onCustomerUpdated,
}: CustomerBasicInfoQuickSectionProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CustomerBasicCoreFormDraft>(() => recordToBasicCoreDraft(customer))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const addressValue = useMemo(
    () => ({
      zonecode: draft.zonecode,
      baseAddress: draft.address,
      detailAddress: draft.addressDetail,
    }),
    [draft.address, draft.addressDetail, draft.zonecode],
  )

  const openModal = useCallback(() => {
    setDraft(recordToBasicCoreDraft(customer))
    setFormError(null)
    setOpen(true)
  }, [customer])

  const closeModal = useCallback(() => {
    if (saving) {
      return
    }
    setOpen(false)
    setFormError(null)
  }, [saving])

  const handleAddressChange = useCallback((next: { zonecode: string; baseAddress: string; detailAddress: string }) => {
    setDraft((prev) => ({
      ...prev,
      zonecode: next.zonecode,
      address: next.baseAddress,
      addressDetail: next.detailAddress,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    const tok = token?.trim()
    if (!tok || !open) {
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const updated = await saveCustomerBasicCoreInfo({ token: tok, customer, draft })
      setOpen(false)
      onCustomerUpdated?.(updated)
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
      console.error('[CustomerBasicInfoEditAction] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [customer, draft, onCustomerUpdated, open, token])

  const canMutate = Boolean(token?.trim())

  if (!canMutate) {
    return null
  }

  return (
    <>
      <div className="customer-detail-read__section-edit-action">
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={openModal}>
          수정하기
        </FormButton>
      </div>
      <CustomerQuickFormDialog
        open={open}
        title="기본 정보 수정"
        saving={saving}
        errorMessage={formError}
        onClose={closeModal}
        onSave={handleSave}
      >
        {open ? (
          <CustomerBasicCoreEditFields
            customerId={customer.id}
            draft={draft}
            setDraft={setDraft}
            addressValue={addressValue}
            onAddressChange={handleAddressChange}
            disabled={saving}
          />
        ) : null}
      </CustomerQuickFormDialog>
    </>
  )
}
