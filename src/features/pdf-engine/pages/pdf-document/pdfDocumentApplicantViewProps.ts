import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { CustomerCarRecord } from '../../../customers/api/customerCarsApi'
import type { PdfFieldSpec, PdfTemplateSummary } from '../../types'

export type PdfSelectedCustomerSummary = {
  id: number
  name: string
  phone?: string
}

/** 고객 데이터 불러오기 후 차량 선택·적용 UI */
export type PdfApplicantCarPickerUi = {
  cars: CustomerCarRecord[]
  selectedCarCandidateId: number | null
  appliedCarId: number | null
  hasCarMappedFields: boolean
  carLoadHint: string | null
  carApplyHint: string | null
  onSelectCarCandidate: (carId: number) => void
  onApplySelectedCar: () => void
}

export type PdfDocumentApplicantViewProps = {
  template: PdfTemplateSummary
  fields: PdfFieldSpec[]
  pdfBuffer: ArrayBuffer | null
  values: Record<string, string>
  fontOverrides: Record<string, number>
  focusedFieldKey: string | null
  prefillBanner: ReactNode | null
  submitting: boolean
  workspaceCustomerId: number | null
  workspaceCustomerLabel: string | null
  /** 귀속 고객 — 발급 이력 customer_id 기준 */
  attributionCustomer: PdfSelectedCustomerSummary | null
  /** 필드 자동입력 완료 고객 */
  appliedCustomer: PdfSelectedCustomerSummary | null
  customerStatusMessage: string
  selectedCustomer: PdfSelectedCustomerSummary | null
  effectiveCustomerId: number | null
  loadCustomerButtonLabel: string
  customerLoadHint: string | null
  loadingCustomerData: boolean
  overwriteCustomerOnLoad: boolean
  onToggleOverwriteCustomerOnLoad: () => void
  onLoadCustomerData: () => void
  showCustomerSearch: boolean
  onShowCustomerSearch: () => void
  onHideCustomerSearch: () => void
  customerSearchQuery: string
  onCustomerSearchQueryChange: (query: string) => void
  customerSearchBusy: boolean
  customerSearchError: string | null
  customerSearchResults: PdfSelectedCustomerSummary[]
  onCustomerSearchSubmit: () => void
  onSelectSearchedCustomer: (customer: PdfSelectedCustomerSummary) => void
  onClearSelectedCustomer: () => void
  /** ← 문서 목록 링크 (고객 작업 영역 embed 시 `/customers/.../application-documents`) */
  documentsListPath: string
  onChangeValues: Dispatch<SetStateAction<Record<string, string>>>
  onChangeFontOverrides: Dispatch<SetStateAction<Record<string, number>>>
  onFocusedFieldChange: (key: string | null) => void
  onSubmitApplicant: (
    values: Record<string, string>,
    fontOverrides: Record<string, number>,
  ) => Promise<void> | void

  pdfCarPicker: PdfApplicantCarPickerUi | null
}
