import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton } from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import {
  formatCustomerInflowSourceDisplay,
  getInflowSourceDetailFieldMeta,
} from '../../config/customerInflowSource.config'
import type { CustomerRecord } from '../../domain/types'
import { normalizeCustomerNotesBag } from '../../domain/types'
import { getDDay, getDDayBadgeClass } from '../../utils/dday'
import {
  formatCustomerGenderReadLabel,
  formatCustomerMobileCarrierDisplay,
  formatCustomerPhoneUi,
  formatCustomerSsnUi,
} from '../../utils/customerDisplayFormat'
import {
  type CustomerBasicCoreFormDraft,
  isCustomerBasicCoreDraftDirty,
  recordToBasicCoreDraft,
  saveCustomerBasicCoreInfo,
} from '../../utils/customerBasicCoreSaveUtils'
import { CustomerCopyButton } from '../CustomerAccountNumberField'
import { CustomerMedicalHistoryReadSection } from '../CustomerMedicalHistoryRead'
import { resolveMedicalHistoryFromCustomer } from '../../utils/customerMedicalHistory'
import { CustomerSmsOptOutReadBadge } from '../CustomerSmsOptOutReadBadge'
import { DetailReadFieldRow } from '../DetailReadFieldRow'
import { CustomerBasicCoreEditFields } from './CustomerBasicCoreEditFields'
import { CustomerCustomFieldsQuickInlineSection } from './CustomerCustomFieldsQuickInlineSection'

export type CustomerBasicInfoInsuranceDisplay = {
  ageText: string
  dateText: string
  maturityYmd: string | null
}

export type CustomerBasicInfoSectionProps = {
  customer: CustomerRecord
  ins: CustomerBasicInfoInsuranceDisplay
  token: string | null
  fetchCarsEnabled: boolean
  onCustomerUpdated?: (customer: CustomerRecord) => void
  onEditingChange?: (editing: boolean) => void
}

function MaturityDdayBadge({ maturityYmd }: { maturityYmd: string | null }) {
  if (!maturityYmd) {
    return null
  }
  const dday = getDDay(maturityYmd)
  if (dday === null) {
    return null
  }
  const hot = dday >= 0 && dday <= 30
  const label = `D-${dday}`
  const toneClass = hot ? getDDayBadgeClass(dday) : 'customer-dday'
  return <span className={`customer-detail-read__dday-inline ${toneClass}`}>({label})</span>
}

export function CustomerBasicInfoSection({
  customer,
  ins,
  token,
  fetchCarsEnabled,
  onCustomerUpdated,
  onEditingChange,
}: CustomerBasicInfoSectionProps) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<CustomerBasicCoreFormDraft>(() => recordToBasicCoreDraft(customer))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const canMutate = Boolean(token?.trim())
  const notes = normalizeCustomerNotesBag(customer.notes)
  const inflowDetailMeta = getInflowSourceDetailFieldMeta(customer.inflowSource)
  const inflowDetailName = customer.referrerName?.trim()

  useEffect(() => {
    setIsEditing(false)
    setDraft(recordToBasicCoreDraft(customer))
    setFormError(null)
  }, [customer])

  useEffect(() => {
    onEditingChange?.(isEditing)
  }, [isEditing, onEditingChange])

  const addressValue = useMemo(
    () => ({
      zonecode: draft.zonecode,
      baseAddress: draft.address,
      detailAddress: draft.addressDetail,
    }),
    [draft.address, draft.addressDetail, draft.zonecode],
  )

  const startEditing = useCallback(() => {
    setDraft(recordToBasicCoreDraft(customer))
    setFormError(null)
    setIsEditing(true)
  }, [customer])

  const exitEditing = useCallback(() => {
    if (saving) {
      return
    }
    setIsEditing(false)
    setFormError(null)
    setDraft(recordToBasicCoreDraft(customer))
  }, [customer, saving])

  const requestCancel = useCallback(async () => {
    if (saving) {
      return
    }
    if (!isCustomerBasicCoreDraftDirty(customer, draft)) {
      exitEditing()
      return
    }
    const ok = await confirm({
      title: '기본 정보 수정',
      message: '변경사항이 저장되지 않습니다. 취소할까요?',
      confirmLabel: '취소',
      cancelLabel: '계속 수정',
      tone: 'warning',
    })
    if (ok) {
      exitEditing()
    }
  }, [confirm, customer, draft, exitEditing, saving])

  const handleAddressChange = useCallback(
    (next: { zonecode: string; baseAddress: string; detailAddress: string }) => {
      setDraft((prev) => ({
        ...prev,
        zonecode: next.zonecode,
        address: next.baseAddress,
        addressDetail: next.detailAddress,
      }))
    },
    [],
  )

  const handleSave = useCallback(async () => {
    const tok = token?.trim()
    if (!tok || !isEditing || saving) {
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const updated = await saveCustomerBasicCoreInfo({ token: tok, customer, draft })
      setIsEditing(false)
      onCustomerUpdated?.(updated)
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
      console.error('[CustomerBasicInfoSection] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [customer, draft, isEditing, onCustomerUpdated, saving, token])

  if (isEditing) {
    return (
      <div className="customer-detail-read__field-list customer-detail-read__field-list--editing">
        {formError ? (
          <p className="customer-relations-strip__status customer-relations-strip__status--error" role="alert">
            {formError}
          </p>
        ) : null}
        <CustomerBasicCoreEditFields
          customerId={customer.id}
          draft={draft}
          setDraft={setDraft}
          addressValue={addressValue}
          onAddressChange={handleAddressChange}
          disabled={saving}
          inline
        />
        <div className="customer-detail-read__inline-edit-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => void requestCancel()}
          >
            취소
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            size="sm"
            disabled={saving}
            loading={saving}
            loadingText="저장 중…"
            onClick={() => void handleSave()}
          >
            저장
          </FormButton>
        </div>
        {confirmDialog}
      </div>
    )
  }

  return (
    <div className="customer-detail-read__field-list">
      <DetailReadFieldRow label="이름">{customer.name || '—'}</DetailReadFieldRow>
      <DetailReadFieldRow label="연락처">{formatCustomerPhoneUi(customer.phone) || '—'}</DetailReadFieldRow>
      <DetailReadFieldRow label="주민번호">{formatCustomerSsnUi(customer.ssn) || '—'}</DetailReadFieldRow>
      <DetailReadFieldRow label="성별">
        {formatCustomerGenderReadLabel(customer.gender, customer.ssn)}
      </DetailReadFieldRow>
      <DetailReadFieldRow label="상령일">
        {ins.dateText}
        <MaturityDdayBadge maturityYmd={ins.maturityYmd} />
      </DetailReadFieldRow>
      <DetailReadFieldRow label="보험나이">{ins.ageText}</DetailReadFieldRow>
      <DetailReadFieldRow label="문자 수신">
        <CustomerSmsOptOutReadBadge smsOptOut={customer.smsOptOut === true} />
      </DetailReadFieldRow>
      <DetailReadFieldRow label="통신사">
        {formatCustomerMobileCarrierDisplay(customer.carrier) || '—'}
      </DetailReadFieldRow>
      <DetailReadFieldRow label="주소">{customer.address || '—'}</DetailReadFieldRow>
      <DetailReadFieldRow label="키/몸무게">
        {customer.height?.trim() || customer.weight?.trim()
          ? `${customer.height?.trim() || '—'}/${customer.weight?.trim() || '—'}`
          : '—'}
      </DetailReadFieldRow>
      <DetailReadFieldRow label="직업/회사명/하는일/지역">{customer.job?.trim() || '—'}</DetailReadFieldRow>
      <DetailReadFieldRow label="운전 여부">
        {customer.isDriver === true
          ? '운전함'
          : customer.isDriver === false
            ? '운전 안함'
            : customer.driving || '—'}
      </DetailReadFieldRow>
      <DetailReadFieldRow label="유입 경로">
        {formatCustomerInflowSourceDisplay(customer.inflowSource)}
      </DetailReadFieldRow>
      {inflowDetailMeta && inflowDetailName ? (
        <DetailReadFieldRow label={inflowDetailMeta.readLabel}>{inflowDetailName}</DetailReadFieldRow>
      ) : null}
      <CustomerMedicalHistoryReadSection {...resolveMedicalHistoryFromCustomer(customer)} />
      <div className="customer-detail-read__subsection">
        <h5 className="customer-detail-read__subsection-title">보험 가입</h5>
        <div className="customer-insurance-history-body">
          {notes.insuranceHistory?.trim() ? notes.insuranceHistory : '내용 없음'}
        </div>
      </div>
      <div className="customer-detail-read__subsection">
        <h5 className="customer-detail-read__subsection-title">계좌</h5>
        <div className="customer-account-number-read">
          <span className="customer-account-number-read__value">
            {notes.accountNumber?.trim() || '내용 없음'}
          </span>
          {notes.accountNumber?.trim() ? (
            <CustomerCopyButton text={notes.accountNumber} ariaLabel="계좌번호 복사" />
          ) : null}
        </div>
      </div>
      <CustomerCustomFieldsQuickInlineSection
        customer={customer}
        token={token}
        enabled={fetchCarsEnabled}
      />
      {canMutate ? (
        <div className="customer-detail-read__section-edit-action">
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={startEditing}>
            수정하기
          </FormButton>
        </div>
      ) : null}
    </div>
  )
}
