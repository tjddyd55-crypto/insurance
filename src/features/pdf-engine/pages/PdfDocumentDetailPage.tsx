/**
 * 사용자용 문서 상세 — PC/모바일 분리 뷰 + 실시간 PDF 오버레이 미리보기.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { FormButton } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { ApiError, resolveAbsoluteApiUrl } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById, searchCustomers } from '../../customers/api/customersApi'
import { listCustomerCars, type CustomerCarRecord } from '../../customers/api/customerCarsApi'
import type { CustomerRecord } from '../../customers/domain/types'
import {
  fetchPdfTemplateFile,
  getPdfIssuance,
  getPdfTemplate,
  renderPdfTemplate,
  requestPdfRenderPreviewUrl,
} from '../api/pdfTemplateApi'
import { mergedInitialValues, splitPdfSnapshot } from '../components/PdfTemplateForm'
import PdfDocumentApplicantPCView from './pdf-document/PdfDocumentApplicantPCView'
import PdfDocumentApplicantMobileView from './pdf-document/PdfDocumentApplicantMobileView'
import type {
  PdfDocumentApplicantViewProps,
  PdfSelectedCustomerSummary,
} from './pdf-document/pdfDocumentApplicantViewProps'
import { clampApplicantFontSizePt } from '../lib/pdfApplicantTypography'
import {
  applyCustomerDataToPdfValues,
  normalizePdfFieldDataMapping,
  overwriteCarMappedPdfValuesFromCustomer,
} from '../lib/resolvePdfFieldValue'
import { isCustomerPdfCarFieldKey } from '../config/customerPdfFieldOptions'
import {
  countCarMappedPdfInputFields,
  hasCarMappedFields,
  listCarMappedPdfFieldKeys,
} from '../lib/hasCarMappedFields'
import { customerWithSelectedCar, resolveCustomerCarsForPicker } from '../lib/customerPdfCarOverlay'
import {
  collectCustomerRawCarFields,
  listCustomerKeysWithCarWords,
} from '../../customers/utils/resolveCustomerCarsForDisplay'
import type { PdfFieldSpec, PdfInputRole, PdfTemplateSummary } from '../types'
import { DEFAULT_PDF_FIELD_DATA_MAPPING } from '../types'
import { usePdfDocumentsWorkspacePaths } from '../utils/pdfCustomerWorkspacePaths'
import { buildPdfIssuanceDisplayFilename } from '../utils/pdfIssuanceFilename'
import {
  buildPdfIssuanceSaveAttribution,
  resolvePdfIssuanceLoadWarning,
  resolvePdfIssuanceUnassignedNotice,
  resolvePdfMappingCustomerId,
} from '../utils/pdfIssuanceAttribution'
import {
  buildApplicationCustomerSearchQuery,
  extractCustomerSearchHintsFromPdfForm,
  logApplicationCustomerAutoMatchDebug,
  logManualCustomerCandidateSelected,
  logManualCustomerSearchDebug,
  logManualCustomerSearchResultsRendered,
  logCustomerCarPickerDebug,
  logCustomerCarSourceDebug,
  logSelectedCustomerDataLoaded,
  resolveApplicationCustomerAutoMatch,
} from '../lib/pdfApplicationCustomerAutoMatch'
import '../pdf-engine.css'

function coercePdfFieldSpecForForm(f: PdfFieldSpec & { id?: number }): PdfFieldSpec {
  const rest = { ...f } as PdfFieldSpec & { id?: number }
  delete rest.id
  const inputRole: PdfInputRole =
    rest.fieldType === 'signature'
      ? 'customer'
      : rest.inputRole === 'sender' || rest.inputRole === 'disabled' || rest.inputRole === 'customer'
        ? rest.inputRole
        : 'customer'
  return {
    ...rest,
    inputRole,
    dataMapping: normalizePdfFieldDataMapping(
      rest.dataMapping ??
        (rest as PdfFieldSpec & { customerMapping?: unknown }).customerMapping ??
        DEFAULT_PDF_FIELD_DATA_MAPPING,
    ),
  }
}

function pickFontSnapshotsFromIssuance(
  fields: PdfFieldSpec[],
  snapFonts: Record<string, number>,
): Record<string, number> {
  const textKeys = new Set(
    fields.filter((f) => f.fieldType === 'text' || f.fieldType === 'textarea').map((f) => f.fieldKey),
  )
  const out: Record<string, number> = {}
  for (const [k0, v0] of Object.entries(snapFonts)) {
    const k = String(k0)
    if (!textKeys.has(k)) continue
    const n = Number(v0)
    if (!Number.isFinite(n) || n <= 0) continue
    out[k] = clampApplicantFontSizePt(n)
  }
  return out
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; template: PdfTemplateSummary; fields: PdfFieldSpec[] }

type SourcePrefillState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      values: Record<string, string>
      loadWarning: string | null
      unassignedNotice: string | null
    }

/** fetch 응답 Blob 이 빈 타입이어도 뷰어·다운로드가 PDF 로 인식하도록 고정한다. */
function coercePdfBlob(blob: Blob): Blob {
  if (blob && blob.type === 'application/pdf') return blob
  return new Blob([blob], { type: 'application/pdf' })
}

/** Blob → 브라우저 다운로드. File 로 감싸 저장 대화상자·일부 PDF 뷰어의 기본 파일명을 정렬한다. */
function triggerDownload(blob: Blob, filename: string): void {
  const safeName = filename.trim() || 'document.pdf'
  const typed = blob.type?.includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' })
  const file = new File([typed], safeName, { type: 'application/pdf' })
  const url = URL.createObjectURL(file)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = safeName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export default function PdfDocumentDetailPage() {
  const { id: idParam, customerId: routeCustomerId } = useParams<{ id?: string; customerId?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateId = Number(idParam)
  const { token, user } = useAuth()
  const { listPath, historyPath } = usePdfDocumentsWorkspacePaths()

  const issuerParam = searchParams.get('issuerCustomerName')
  const workspaceCustomerIdFromRoute = useMemo(() => {
    const n = Number(routeCustomerId)
    return Number.isInteger(n) && n >= 1 ? n : null
  }, [routeCustomerId])

  const issuerCustomerLabel = useMemo(() => {
    if (!issuerParam?.trim()) return ''
    try {
      return decodeURIComponent(issuerParam.trim())
    } catch {
      return issuerParam.trim()
    }
  }, [issuerParam])

  const sourceIssuanceId = useMemo(() => {
    const raw = searchParams.get('sourceIssuanceId')
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 ? n : null
  }, [searchParams])

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [submitting, setSubmitting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewValues, setPreviewValues] = useState<Record<string, string> | null>(null)
  const [previewFonts, setPreviewFonts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [sourcePrefill, setSourcePrefill] = useState<SourcePrefillState>({ kind: 'none' })
  const [fallbackCustomerLabel, setFallbackCustomerLabel] = useState('')

  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null)
  const [applicantValues, setApplicantValues] = useState<Record<string, string>>({})
  const [fontOverrides, setFontOverrides] = useState<Record<string, number>>({})
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null)
  const [loadingCustomerData, setLoadingCustomerData] = useState(false)
  const [overwriteCustomerOnLoad, setOverwriteCustomerOnLoad] = useState(false)
  const [customerLoadHint, setCustomerLoadHint] = useState<string | null>(null)
  const [cachedCustomer, setCachedCustomer] = useState<CustomerRecord | null>(null)
  /** 검색 결과에서 “선택”한 고객 후보 — 아직 신청서 필드에 반영 전 */
  const [selectedCustomerCandidate, setSelectedCustomerCandidate] =
    useState<PdfSelectedCustomerSummary | null>(null)
  /** “선택 고객 데이터 불러오기”로 실제 반영된 고객 */
  const [appliedCustomer, setAppliedCustomer] = useState<PdfSelectedCustomerSummary | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchBusy, setCustomerSearchBusy] = useState(false)
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null)
  const [customerSearchResults, setCustomerSearchResults] = useState<PdfSelectedCustomerSummary[]>([])
  const [customerCars, setCustomerCars] = useState<CustomerCarRecord[]>([])
  /** 사용자가 선택한 차량 후보 — 아직 신청서 필드에 반영 전 */
  const [selectedCustomerCarCandidate, setSelectedCustomerCarCandidate] = useState<number | null>(null)
  /** “선택 차량 적용”으로 실제 반영된 차량 id */
  const [appliedCustomerCar, setAppliedCustomerCar] = useState<number | null>(null)
  const [carApplyHint, setCarApplyHint] = useState<string | null>(null)
  const [customerCarsFetchComplete, setCustomerCarsFetchComplete] = useState(false)
  const hasAttemptedAutoMatchRef = useRef(false)
  const hasManualCustomerInteractionRef = useRef(false)

  const hasCarPdfMapping = state.status === 'ready' && hasCarMappedFields(state.fields)

  const mappingCustomerId = useMemo(
    () => resolvePdfMappingCustomerId(appliedCustomer),
    [appliedCustomer],
  )

  const effectiveCustomerId = useMemo(
    () => appliedCustomer?.id ?? workspaceCustomerIdFromRoute ?? null,
    [appliedCustomer, workspaceCustomerIdFromRoute],
  )

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewValues(null)
    setPreviewFonts({})
    setPreviewError(null)
    setPreviewUrl(null)
  }

  useEffect(() => {
    if (!token?.trim()) {
      setFallbackCustomerLabel('')
      return
    }
    if (issuerCustomerLabel.trim()) {
      setFallbackCustomerLabel('')
      return
    }
    if (workspaceCustomerIdFromRoute == null) {
      setFallbackCustomerLabel('')
      return
    }
    let cancelled = false
    getCustomerById(token, workspaceCustomerIdFromRoute)
      .then((row) => {
        if (cancelled) return
        const name = row?.name?.trim()
        setFallbackCustomerLabel(name ?? '')
      })
      .catch(() => {
        if (cancelled) return
        setFallbackCustomerLabel('')
      })
    return () => {
      cancelled = true
    }
  }, [issuerCustomerLabel, token, workspaceCustomerIdFromRoute])

  useEffect(() => {
    if (!token?.trim()) return
    if (!Number.isInteger(templateId) || templateId < 1) {
      setState({ status: 'error', message: '잘못된 문서 주소입니다.' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    getPdfTemplate(token, templateId)
      .then((res) => {
        if (cancelled) return
        setState({ status: 'ready', template: res.template, fields: res.fields.map(coercePdfFieldSpecForForm) })
      })
      .catch((e) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: e instanceof ApiError ? e.message : '문서를 불러오지 못했습니다.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [token, templateId])

  useEffect(() => {
    if (!token?.trim() || state.status !== 'ready') {
      setPdfBuffer(null)
      return
    }
    let cancelled = false
    fetchPdfTemplateFile(token, templateId)
      .then((buf) => {
        if (!cancelled) setPdfBuffer(buf)
      })
      .catch(() => {
        if (!cancelled) setPdfBuffer(null)
      })
    return () => {
      cancelled = true
    }
  }, [token, state.status, templateId])

  useEffect(() => {
    if (!token?.trim()) return
    if (state.status !== 'ready') return
    if (sourceIssuanceId == null) {
      setSourcePrefill({ kind: 'none' })
      return
    }
    let cancelled = false
    setSourcePrefill({ kind: 'loading' })
    getPdfIssuance(token, sourceIssuanceId)
      .then((res) => {
        if (cancelled) return
        const tid = res.issuance.templateId
        if (tid == null || tid !== templateId) {
          setSourcePrefill({
            kind: 'error',
            message:
              '선택한 발급 이력의 템플릿과 현재 문서가 일치하지 않습니다. 목록에서 다시 선택해 주세요.',
          })
          return
        }
        setSourcePrefill({
          kind: 'ready',
          values: res.issuance.valuesSnapshot,
          loadWarning: resolvePdfIssuanceLoadWarning({
            issuanceCustomerId: res.issuance.customerId,
            issuanceCustomerLabel: res.issuance.customerLabel,
            contextCustomerId: workspaceCustomerIdFromRoute,
          }),
          unassignedNotice: resolvePdfIssuanceUnassignedNotice(res.issuance.customerId),
        })
      })
      .catch((e) => {
        if (cancelled) return
        setSourcePrefill({
          kind: 'error',
          message:
            e instanceof ApiError
              ? e.message
              : '과거 발급 입력값을 불러오지 못했습니다.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [token, state.status, templateId, sourceIssuanceId, workspaceCustomerIdFromRoute])

  useEffect(() => {
    if (state.status !== 'ready') return
    if (sourceIssuanceId != null && sourcePrefill.kind !== 'ready') return
    const issuanceSnapshot = sourcePrefill.kind === 'ready' ? sourcePrefill.values : null
    const { fontSizes: snapFsRaw } =
      issuanceSnapshot != null ? splitPdfSnapshot(issuanceSnapshot) : { fontSizes: {} as Record<string, number> }
    const mergedVals = mergedInitialValues(state.fields, issuanceSnapshot)
    setApplicantValues(mergedVals)
    setFontOverrides(pickFontSnapshotsFromIssuance(state.fields, snapFsRaw))
    setFocusedFieldKey(null)
  }, [
    templateId,
    state.status === 'ready' ? state.template.id : 0,
    sourceIssuanceId,
    sourcePrefill.kind,
  ])

  const displayCustomerLabel = issuerCustomerLabel.trim() || fallbackCustomerLabel.trim()

  const workspaceCustomerLabel = displayCustomerLabel.trim() || null

  const loadCustomerButtonLabel = useMemo(() => {
    if (selectedCustomerCandidate) return '선택 고객 데이터 불러오기'
    if (workspaceCustomerIdFromRoute != null) return '현재 고객 데이터 불러오기'
    return '고객 검색해서 불러오기'
  }, [selectedCustomerCandidate, workspaceCustomerIdFromRoute])

  const effectiveCustomerLabelForFilename = useMemo(() => {
    if (appliedCustomer?.name?.trim()) return appliedCustomer.name.trim()
    if (selectedCustomerCandidate?.name?.trim()) return selectedCustomerCandidate.name.trim()
    return displayCustomerLabel.trim()
  }, [appliedCustomer, selectedCustomerCandidate, displayCustomerLabel])

  const resultPdfFilename = useMemo(() => {
    if (state.status !== 'ready') return '고객_신청서.pdf'
    return buildPdfIssuanceDisplayFilename({
      customerLabel: effectiveCustomerLabelForFilename || undefined,
      templateTitle: state.template.title,
      templateCode: state.template.code,
    })
  }, [state, effectiveCustomerLabelForFilename])

  const scopeGaId = user?.gaId ?? null

  const customerRecordToSearchSummary = useCallback(
    (row: CustomerRecord): PdfSelectedCustomerSummary => ({
      id: row.id,
      name: row.name?.trim() || `고객 #${row.id}`,
      phone: (row.phone || row.phoneNumber || '').trim() || undefined,
    }),
    [],
  )

  const loadCustomerIntoApplicantForm = useCallback(
    async (customerId: number, appliedSummary?: PdfSelectedCustomerSummary | null) => {
      if (!token?.trim() || state.status !== 'ready') {
        return
      }
      setLoadingCustomerData(true)
      setCustomerLoadHint(null)
      setCustomerCarsFetchComplete(false)
      let didApplyCustomer = false
      try {
        const customer =
          cachedCustomer?.id === customerId
            ? cachedCustomer
            : await getCustomerById(token, customerId)
        if (!customer) {
          setCustomerLoadHint('고객 정보를 찾을 수 없습니다.')
          return
        }
        setCachedCustomer(customer)
        const summary =
          appliedSummary ?? customerRecordToSearchSummary(customer)
        setAppliedCustomer(summary)
        didApplyCustomer = true
        logSelectedCustomerDataLoaded(customerId)
        const fields = state.fields

        let rawCars: CustomerCarRecord[] = []
        try {
          rawCars = await listCustomerCars(token, customerId)
        } catch {
          rawCars = []
        }
        const sortedCars = resolveCustomerCarsForPicker(rawCars, customer)
        logCustomerCarSourceDebug({
          customerId,
          listCustomerCarsCount: rawCars.length,
          customerKeysWithCarWords: listCustomerKeysWithCarWords(customer),
          customerRawCarFields: collectCustomerRawCarFields(customer),
          resolvedCars: sortedCars.map((car) => ({
            id: car.id,
            carNumber: car.carNumber,
            carModel: car.carModel,
            carYear: car.carYear,
            renewalDate: car.renewalDate,
            carType: car.carType,
          })),
        })
        setCustomerCars(sortedCars)
        setSelectedCustomerCarCandidate(null)
        setAppliedCustomerCar(null)
        setCarApplyHint(null)

        const carFieldKeys = listCarMappedPdfFieldKeys(fields)
        const hasCarFields = hasCarMappedFields(fields)
        logCustomerCarPickerDebug({
          appliedCustomerId: summary.id,
          hasCarMappedFields: hasCarFields,
          carFieldKeys,
          carsCount: sortedCars.length,
          pdfCarPickerPassed: hasCarFields,
          customerCarsFetchComplete: true,
        })

        setApplicantValues((prev) =>
          applyCustomerDataToPdfValues(fields, prev, customer, {
            overwriteMode: overwriteCustomerOnLoad,
            skipCarMappedFields: true,
          }),
        )
        const mappedCount = state.fields.filter((f) => {
          const m = normalizePdfFieldDataMapping(f.dataMapping)
          if (m.dataSourceType !== 'customer' || !m.customerFieldKey) return false
          if (f.fieldType !== 'text' && f.fieldType !== 'textarea') return false
          return !isCustomerPdfCarFieldKey(m.customerFieldKey)
        }).length
        const carHint =
          sortedCars.length > 0
            ? ' 등록된 차량은 아래에서 선택 후 「선택 차량 적용」을 눌러 반영할 수 있습니다.'
            : ''
        setCustomerLoadHint(
          mappedCount > 0
            ? `매핑된 ${mappedCount}개 항목에 고객 기본 정보를 반영했습니다.${carHint}`
            : sortedCars.length > 0
              ? `고객 데이터 매핑 필드는 없습니다.${carHint}`
              : '고객 데이터 매핑이 설정된 텍스트 필드가 없습니다.',
        )
      } catch (e) {
        setCustomerLoadHint(
          e instanceof ApiError ? e.message : '고객 데이터를 불러오지 못했습니다.',
        )
      } finally {
        setLoadingCustomerData(false)
        setCustomerCarsFetchComplete(didApplyCustomer)
      }
    },
    [token, state, cachedCustomer, overwriteCustomerOnLoad, customerRecordToSearchSummary],
  )

  const handleSelectCarCandidate = useCallback((carId: number) => {
    setSelectedCustomerCarCandidate(carId)
    setCarApplyHint(null)
  }, [])

  const handleApplySelectedCar = useCallback(() => {
    if (state.status !== 'ready' || cachedCustomer == null) {
      return
    }
    const carId = selectedCustomerCarCandidate
    if (carId == null) {
      setCarApplyHint('적용할 차량을 먼저 「이 차량 선택」으로 고르세요.')
      return
    }
    const car = customerCars.find((c) => c.id === carId)
    if (!car) {
      setCarApplyHint('선택한 차량 정보를 찾을 수 없습니다.')
      return
    }
    const fields = state.fields
    if (!hasCarMappedFields(fields)) {
      setCarApplyHint('적용 가능한 자동차 필드가 없습니다.')
      return
    }
    const merged = customerWithSelectedCar(cachedCustomer, car)
    setApplicantValues((prev) =>
      overwriteCarMappedPdfValuesFromCustomer(fields, prev, merged, {
        overwriteMode: overwriteCustomerOnLoad,
      }),
    )
    setAppliedCustomerCar(carId)
    const carFieldCount = countCarMappedPdfInputFields(fields)
    setCarApplyHint(
      carFieldCount > 0
        ? `선택한 차량 정보를 ${carFieldCount}개 자동차 항목에 반영했습니다.`
        : '적용 가능한 자동차 필드가 없습니다.',
    )
  }, [
    state,
    cachedCustomer,
    selectedCustomerCarCandidate,
    customerCars,
    overwriteCustomerOnLoad,
  ])

  const handleCustomerSearchSubmit = useCallback(async () => {
    if (!token?.trim()) return
    const q = customerSearchQuery.trim()
    if (!q) {
      setCustomerSearchError('검색어를 입력해 주세요.')
      return
    }
    hasManualCustomerInteractionRef.current = true
    hasAttemptedAutoMatchRef.current = true
    setCustomerSearchBusy(true)
    setCustomerSearchError(null)
    setSelectedCustomerCandidate(null)
    try {
      const rows = await searchCustomers(token, q, {
        scopeGaId: scopeGaId != null && Number(scopeGaId) > 0 ? Number(scopeGaId) : null,
      })
      logManualCustomerSearchDebug(q, rows.length)
      const summaries = rows.map(customerRecordToSearchSummary)
      setCustomerSearchResults(summaries)
      if (summaries.length > 0) {
        logManualCustomerSearchResultsRendered()
      }
    } catch (e) {
      setCustomerSearchResults([])
      setCustomerSearchError(
        e instanceof ApiError ? e.message : '고객 검색에 실패했습니다.',
      )
    } finally {
      setCustomerSearchBusy(false)
    }
  }, [token, customerSearchQuery, scopeGaId, customerRecordToSearchSummary])

  useEffect(() => {
    if (state.status !== 'ready' || !token?.trim()) {
      return
    }
    if (workspaceCustomerIdFromRoute != null) {
      return
    }
    if (appliedCustomer != null) {
      return
    }
    if (selectedCustomerCandidate != null) {
      return
    }
    if (hasManualCustomerInteractionRef.current) {
      return
    }
    if (hasAttemptedAutoMatchRef.current) {
      return
    }
    if (sourceIssuanceId != null && sourcePrefill.kind === 'loading') {
      return
    }

    const hints = extractCustomerSearchHintsFromPdfForm(state.fields, applicantValues)
    const q = buildApplicationCustomerSearchQuery(hints, issuerCustomerLabel)
    if (!q) {
      return
    }

    hasAttemptedAutoMatchRef.current = true
    let cancelled = false

    void (async () => {
      try {
        const rows = await searchCustomers(token, q, {
          scopeGaId: scopeGaId != null && Number(scopeGaId) > 0 ? Number(scopeGaId) : null,
        })
        if (cancelled) {
          return
        }
        const match = resolveApplicationCustomerAutoMatch(rows)
        logApplicationCustomerAutoMatchDebug(match, hints)
        if (match.kind !== 'selected') {
          return
        }
        const summary = customerRecordToSearchSummary(match.customer)
        setSelectedCustomerCandidate(summary)
        await loadCustomerIntoApplicantForm(match.customer.id, summary)
      } catch {
        // 수동 검색으로 fallback
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    state.status,
    token,
    workspaceCustomerIdFromRoute,
    appliedCustomer,
    selectedCustomerCandidate,
    sourceIssuanceId,
    sourcePrefill.kind,
    issuerCustomerLabel,
    applicantValues,
    scopeGaId,
    state.status === 'ready' ? state.fields : null,
    customerRecordToSearchSummary,
    loadCustomerIntoApplicantForm,
  ])

  const handleSelectSearchedCustomer = useCallback(
    (customer: PdfSelectedCustomerSummary) => {
      hasManualCustomerInteractionRef.current = true
      hasAttemptedAutoMatchRef.current = true
      setSelectedCustomerCandidate(customer)
      setCachedCustomer(null)
      setCustomerCars([])
      setSelectedCustomerCarCandidate(null)
      setAppliedCustomerCar(null)
      setCarApplyHint(null)
      setCustomerCarsFetchComplete(false)
      setShowCustomerSearch(false)
      setCustomerSearchError(null)
      setCustomerLoadHint('「선택 고객 데이터 불러오기」를 눌러 신청서에 반영하세요.')
      logManualCustomerCandidateSelected(customer.id)
    },
    [],
  )

  const handleClearSelectedCustomer = useCallback(() => {
    setSelectedCustomerCandidate(null)
    setAppliedCustomer(null)
    setCachedCustomer(null)
    setCustomerCars([])
    setSelectedCustomerCarCandidate(null)
    setAppliedCustomerCar(null)
    setCarApplyHint(null)
    setCustomerCarsFetchComplete(false)
    setCustomerLoadHint(null)
  }, [])

  const handleLoadCustomerData = useCallback(async () => {
    if (!token?.trim()) return
    if (selectedCustomerCandidate != null) {
      await loadCustomerIntoApplicantForm(
        selectedCustomerCandidate.id,
        selectedCustomerCandidate,
      )
      return
    }
    if (workspaceCustomerIdFromRoute != null) {
      await loadCustomerIntoApplicantForm(workspaceCustomerIdFromRoute)
      return
    }
    setShowCustomerSearch(true)
    setCustomerLoadHint('고객을 검색해서 선택한 뒤 데이터를 불러올 수 있습니다.')
  }, [
    token,
    selectedCustomerCandidate,
    workspaceCustomerIdFromRoute,
    loadCustomerIntoApplicantForm,
  ])

  const handleSubmitApplicant = useCallback(
    async (values: Record<string, string>, persistFonts: Record<string, number>) => {
      if (!token || state.status !== 'ready') return
      const previewFilename = buildPdfIssuanceDisplayFilename({
        customerLabel: effectiveCustomerLabelForFilename || undefined,
        templateTitle: state.template.title,
        templateCode: state.template.code,
      })
      setSubmitting(true)
      try {
        const { previewUrl: relUrl } = await requestPdfRenderPreviewUrl(token, templateId, values, {
          fontSizes: Object.keys(persistFonts).length > 0 ? persistFonts : undefined,
          displayFilename: previewFilename,
          customerId: mappingCustomerId,
          overwriteCustomerMapping: overwriteCustomerOnLoad,
        })
        setPreviewUrl(resolveAbsoluteApiUrl(relUrl))
        setPreviewValues(values)
        setPreviewFonts(persistFonts)
        setPreviewError(null)
        setPreviewOpen(true)
      } catch (e) {
        const message =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'PDF 생성에 실패했습니다.'
        throw new Error(message)
      } finally {
        setSubmitting(false)
      }
    },
    [token, templateId, state, effectiveCustomerLabelForFilename, mappingCustomerId, overwriteCustomerOnLoad],
  )

  const handleSaveFromPreview = async () => {
    if (!token || state.status !== 'ready' || !previewValues) return
    setSaving(true)
    setPreviewError(null)
    try {
      const attribution = buildPdfIssuanceSaveAttribution(
        appliedCustomer,
        appliedCustomerCar,
        customerCars,
      )
      const blobRaw = await renderPdfTemplate(token, templateId, previewValues, {
        fontSizes: Object.keys(previewFonts).length > 0 ? previewFonts : undefined,
        customerId: mappingCustomerId,
        overwriteCustomerMapping: overwriteCustomerOnLoad,
        ...attribution,
      })
      triggerDownload(coercePdfBlob(blobRaw), resultPdfFilename)
      closePreview()
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'PDF 저장에 실패했습니다.'
      setPreviewError(message)
    } finally {
      setSaving(false)
    }
  }

  const prefillBanner = useMemo<ReactNode>(() => {
    if (sourcePrefill.kind !== 'ready') return null
    return (
      <>
        <div className="pdf-engine-prefill-banner" role="status">
          과거 작성한 신청서에서 불러온 내용입니다. 수정 후 다시 출력하면 새 발급 이력으로 저장됩니다.
        </div>
        {sourcePrefill.unassignedNotice ? (
          <div className="pdf-engine-prefill-banner pdf-engine-prefill-banner--notice" role="status">
            {sourcePrefill.unassignedNotice}
          </div>
        ) : null}
        {sourcePrefill.loadWarning ? (
          <div className="pdf-engine-prefill-banner pdf-engine-prefill-banner--warning" role="status">
            {sourcePrefill.loadWarning}
          </div>
        ) : null}
      </>
    )
  }, [sourcePrefill])

  const applicantViewProps = useMemo<PdfDocumentApplicantViewProps | null>(() => {
    if (state.status !== 'ready') return null
    return {
      template: state.template,
      fields: state.fields,
      pdfBuffer,
      values: applicantValues,
      fontOverrides,
      focusedFieldKey,
      prefillBanner,
      submitting,
      workspaceCustomerId: workspaceCustomerIdFromRoute,
      workspaceCustomerLabel,
      selectedCustomer: selectedCustomerCandidate,
      effectiveCustomerId,
      loadCustomerButtonLabel,
      customerLoadHint,
      loadingCustomerData,
      overwriteCustomerOnLoad,
      onToggleOverwriteCustomerOnLoad: () => setOverwriteCustomerOnLoad((v) => !v),
      onLoadCustomerData: handleLoadCustomerData,
      showCustomerSearch,
      onShowCustomerSearch: () => setShowCustomerSearch(true),
      onHideCustomerSearch: () => {
        setShowCustomerSearch(false)
        setCustomerSearchError(null)
      },
      customerSearchQuery,
      onCustomerSearchQueryChange: setCustomerSearchQuery,
      customerSearchBusy,
      customerSearchError,
      customerSearchResults,
      onCustomerSearchSubmit: handleCustomerSearchSubmit,
      onSelectSearchedCustomer: handleSelectSearchedCustomer,
      onClearSelectedCustomer: handleClearSelectedCustomer,
      documentsListPath: listPath,
      onChangeValues: setApplicantValues,
      onChangeFontOverrides: setFontOverrides,
      onFocusedFieldChange: setFocusedFieldKey,
      onSubmitApplicant: handleSubmitApplicant,
      pdfCarPicker:
        appliedCustomer != null && customerCarsFetchComplete && hasCarPdfMapping
          ? {
              cars: customerCars,
              selectedCarCandidateId: selectedCustomerCarCandidate,
              appliedCarId: appliedCustomerCar,
              hasCarMappedFields: hasCarPdfMapping,
              carLoadHint:
                customerCars.length > 0
                  ? '등록된 차량 정보가 있습니다. 이 신청서에 사용할 차량을 선택해 주세요.'
                  : null,
              carApplyHint,
              onSelectCarCandidate: handleSelectCarCandidate,
              onApplySelectedCar: handleApplySelectedCar,
            }
          : null,
    }
  }, [
    state,
    pdfBuffer,
    applicantValues,
    fontOverrides,
    focusedFieldKey,
    prefillBanner,
    submitting,
    listPath,
    handleSubmitApplicant,
    workspaceCustomerIdFromRoute,
    workspaceCustomerLabel,
    selectedCustomerCandidate,
    effectiveCustomerId,
    loadCustomerButtonLabel,
    customerLoadHint,
    loadingCustomerData,
    overwriteCustomerOnLoad,
    handleLoadCustomerData,
    showCustomerSearch,
    customerSearchQuery,
    customerSearchBusy,
    customerSearchError,
    customerSearchResults,
    handleCustomerSearchSubmit,
    handleSelectSearchedCustomer,
    handleClearSelectedCustomer,
    appliedCustomer,
    hasCarPdfMapping,
    customerCars,
    selectedCustomerCarCandidate,
    appliedCustomerCar,
    carApplyHint,
    customerCarsFetchComplete,
    handleSelectCarCandidate,
    handleApplySelectedCar,
  ])

  if (state.status === 'loading') {
    return (
      <main className="insurance-dark-forms pdf-engine-page pdf-document-detail-page pdf-document-detail-page--pc page--with-back">
        <p className="pdf-engine-page__hint">문서를 불러오는 중…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="insurance-dark-forms pdf-engine-page pdf-document-detail-page pdf-document-detail-page--pc page--with-back">
        <div className="pdf-engine-page__error">{state.message}</div>
        <div className="pdf-engine-page__toolbar">
          <Link to={listPath} className="pdf-engine-editor__btn">
            ← 문서 목록
          </Link>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="pdf-engine-editor__btn"
            onClick={() => navigate(0)}
          >
            다시 시도
          </FormButton>
        </div>
      </main>
    )
  }

  if (
    state.status === 'ready' &&
    sourceIssuanceId != null &&
    sourcePrefill.kind === 'loading'
  ) {
    return (
      <main className="insurance-dark-forms pdf-engine-page pdf-document-detail-page pdf-document-detail-page--mobile page--with-back">
        <div className="pdf-engine-page__toolbar">
          <Link to={listPath} className="pdf-engine-editor__btn">
            ← 문서 목록
          </Link>
        </div>
        <p className="pdf-engine-page__hint">과거 작성한 신청서에서 입력값을 불러오는 중…</p>
      </main>
    )
  }

  if (
    state.status === 'ready' &&
    sourceIssuanceId != null &&
    sourcePrefill.kind === 'error'
  ) {
    return (
      <main className="insurance-dark-forms pdf-engine-page pdf-document-detail-page pdf-document-detail-page--mobile page--with-back">
        <div className="pdf-engine-page__toolbar">
          <Link to={listPath} className="pdf-engine-editor__btn">
            ← 문서 목록
          </Link>
          <Link to={historyPath} className="pdf-engine-editor__btn">
            과거 작성 목록
          </Link>
        </div>
        <div className="pdf-engine-page__error">{sourcePrefill.message}</div>
        <div className="pdf-engine-page__toolbar">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="pdf-engine-editor__btn"
            onClick={() => navigate(0)}
          >
            다시 시도
          </FormButton>
        </div>
      </main>
    )
  }

  if (!applicantViewProps) {
    return null
  }

  return (
    <>
      <ResponsiveLayout<PdfDocumentApplicantViewProps>
        PC={PdfDocumentApplicantPCView}
        Mobile={PdfDocumentApplicantMobileView}
        viewProps={applicantViewProps}
      />
      <Modal
        open={previewOpen}
        onClose={() => {
          if (saving) return
          closePreview()
        }}
        ariaLabel={`PDF 결과 미리보기 · ${resultPdfFilename}`}
        panelClassName="pdf-engine-preview-modal"
      >
        <div className="pdf-engine-preview">
          <header className="pdf-engine-preview__header">
            <h3>결과 미리보기</h3>
            <div
              className="pdf-engine-preview__filename-chip"
              title={resultPdfFilename}
              aria-label={`발급 PDF 파일명 ${resultPdfFilename}`}
            >
              {resultPdfFilename}
            </div>
            <p className="pdf-engine-preview__subtitle">
              미리보기는 서버 인라인 URL로 열립니다. 저장·뷰어 내부 다운로드 파일명은 위와 같이 맞춰집니다.
            </p>
          </header>
          {previewError ? <div className="pdf-engine-page__error">{previewError}</div> : null}
          <div className="pdf-engine-preview__frame-wrap">
            {previewUrl ? (
              <iframe title={resultPdfFilename} src={previewUrl} className="pdf-engine-preview__frame" />
            ) : (
              <p className="pdf-engine-page__hint">미리보기 파일을 준비하지 못했습니다.</p>
            )}
          </div>
          <div className="pdf-engine-preview__actions">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="pdf-engine-editor__btn"
              onClick={closePreview}
              disabled={saving}
            >
              수정하기
            </FormButton>
            <FormButton
              htmlType="button"
              variant="primary"
              className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
              onClick={handleSaveFromPreview}
              disabled={saving || !previewValues}
            >
              {saving ? '저장 중…' : '저장하기'}
            </FormButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
