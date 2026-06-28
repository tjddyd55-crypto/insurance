import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById, searchCustomers } from '../../customers/api/customersApi'
import {
  createClaimDraft,
  createClaimDraftsBatch,
  downloadClaimBundle,
  generateClaimDocuments,
  getClaimRequest,
  listClaimCompanies,
  listCustomerClaimAppAttachments,
  updateClaimDraft,
  uploadClaimAttachment,
  uploadClaimSignature,
  type ClaimAttachmentMetadata,
  type ClaimCompany,
  type ClaimRequestDraft,
  type ClaimSignatureData,
  type CustomerClaimAppAttachment,
} from '../api/claimRequestsApi'
import ClaimRequestExtrasSection from '../components/ClaimRequestExtrasSection'
import ClaimCompanyPickerPanel from '../components/ClaimCompanyPickerPanel'
import ClaimRequestPersonCustomerSearch from '../components/ClaimRequestPersonCustomerSearch'
import InsuranceClaimSubnav from '../components/InsuranceClaimSubnav'
import '../insurance-claim-form.css'

type Person = { name: string; ssn: string; phone: string; address: string; job: string }
type ClaimFormLocationState = { claimRequestSeed?: ClaimRequestDraft }

const emptyPerson = (): Person => ({ name: '', ssn: '', phone: '', address: '', job: '' })

function personFromCustomer(customer: {
  name?: string | null
  ssn?: string | null
  phone?: string | null
  address?: string | null
  job?: string | null
}): Person {
  return {
    name: customer.name ?? '',
    ssn: customer.ssn ?? '',
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    job: customer.job ?? '',
  }
}

function validateDraftInputs(same: boolean, insured: Person, contractor: Person): string | null {
  if (!insured.name.trim()) {
    return '피보험자 이름은 필수입니다.'
  }
  if (!same && !contractor.name.trim()) {
    return '계약자 정보를 입력해 주세요.'
  }
  return null
}

function contractorSnapshotReady(request: ClaimRequestDraft): boolean {
  if (request.contractorSameAsInsured !== false) {
    return true
  }
  return Boolean(request.contractorSnapshot?.name?.trim())
}

function normalizeSignatureData(raw: unknown): ClaimSignatureData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const data = raw as ClaimSignatureData
  return {
    insuredSignature: data.insuredSignature ?? null,
    contractorSignature: data.contractorSignature ?? null,
  }
}

function normalizeAttachmentList(raw: unknown): ClaimAttachmentMetadata[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .filter((item) => item && typeof item === 'object' && String((item as ClaimAttachmentMetadata).storageKey ?? '').trim())
    .map((item) => item as ClaimAttachmentMetadata)
}

function normalizeSelectedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
}

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  generated: '생성 완료',
  completed: '완료',
  failed: '실패',
}

function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export default function ClaimRequestFormPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const hydratedRequestIdRef = useRef<number | null>(null)
  const { id: requestIdParam } = useParams<{ id: string }>()
  const parsedRequestId = Number(requestIdParam)
  const requestId = Number.isInteger(parsedRequestId) && parsedRequestId > 0 ? parsedRequestId : null
  const [params] = useSearchParams()

  const [companies, setCompanies] = useState<ClaimCompany[]>([])
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [matches, setMatches] = useState<{ id: number; name: string; phone?: string }[]>([])
  const [contractorQuery, setContractorQuery] = useState('')
  const [contractorMatches, setContractorMatches] = useState<{ id: number; name: string; phone?: string }[]>([])
  const [insured, setInsured] = useState<Person>(emptyPerson)
  const [same, setSame] = useState(true)
  const [contractor, setContractor] = useState<Person>(emptyPerson)
  const [claimData, setClaimData] = useState({ claimType: 'disease', treatmentDate: '', claimDescription: '' })
  const [paymentData, setPaymentData] = useState({
    accountType: 'normal',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  })
  const [signatureData, setSignatureData] = useState<ClaimSignatureData>({})
  const [additionalAttachments, setAdditionalAttachments] = useState<ClaimAttachmentMetadata[]>([])
  const [selectedCustomerAttachmentIds, setSelectedCustomerAttachmentIds] = useState<number[]>([])
  const [customerAttachments, setCustomerAttachments] = useState<CustomerClaimAppAttachment[]>([])
  const [customerAttachmentsLoading, setCustomerAttachmentsLoading] = useState(false)
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [uploadingSignatureRole, setUploadingSignatureRole] = useState<'insured' | 'contractor' | null>(null)
  const [message, setMessage] = useState('')
  const [formReady, setFormReady] = useState(requestId == null)

  const draftSaved = requestId != null
  const isDraft = status === 'draft'

  const buildDraftPayload = useCallback(
    () => ({
      customerId,
      insuredSnapshot: insured,
      contractorSnapshot: same ? null : contractor,
      contractorSameAsInsured: same,
      claimData,
      paymentData,
      signatureData,
      selectedCustomerAttachmentIds,
      additionalAttachmentMetadata: additionalAttachments,
    }),
    [
      additionalAttachments,
      claimData,
      contractor,
      customerId,
      insured,
      paymentData,
      same,
      selectedCustomerAttachmentIds,
      signatureData,
    ],
  )

  const buildBody = useCallback(
    () => ({
      ...buildDraftPayload(),
      insuranceCompanyId: Number(selectedCompanyIds[0]),
    }),
    [buildDraftPayload, selectedCompanyIds],
  )

  const toggleCompanyId = useCallback(
    (companyId: string) => {
      if (!isDraft) {
        return
      }
      setSelectedCompanyIds((prev) => {
        if (requestId != null) {
          return prev.includes(companyId) ? [] : [companyId]
        }
        return prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
      })
    },
    [isDraft, requestId],
  )

  const fillCustomer = useCallback(
    async (id: number) => {
      if (!token) return false
      const customer = await getCustomerById(token, id)
      if (!customer) return false
      setCustomerId(customer.id)
      setInsured(personFromCustomer(customer))
      setPaymentData((prev) => ({ ...prev, accountHolder: prev.accountHolder || customer.name || '' }))
      setMatches([])
      setCustomerQuery('')
      return true
    },
    [token],
  )

  const fillContractor = useCallback(
    async (id: number) => {
      if (!token) return false
      const customer = await getCustomerById(token, id)
      if (!customer) return false
      setContractor(personFromCustomer(customer))
      setContractorMatches([])
      setContractorQuery('')
      return true
    },
    [token],
  )

  const applyRequest = useCallback((request: Awaited<ReturnType<typeof getClaimRequest>>['request']) => {
    setSelectedCompanyIds([String(request.insuranceCompanyId)])
    setCustomerId(request.customerId)
    setInsured(request.insuredSnapshot as Person)
    setSame(request.contractorSameAsInsured)
    setContractor((request.contractorSnapshot ?? emptyPerson()) as Person)
    setClaimData({
      claimType: request.claimData.claimType ?? 'disease',
      treatmentDate: request.claimData.treatmentDate ?? '',
      claimDescription: request.claimData.claimDescription ?? '',
    })
    setPaymentData({
      accountType: request.paymentData.accountType ?? 'normal',
      bankName: request.paymentData.bankName ?? '',
      accountNumber: request.paymentData.accountNumber ?? '',
      accountHolder: request.paymentData.accountHolder ?? '',
    })
    setSignatureData(normalizeSignatureData(request.signatureData))
    setAdditionalAttachments(normalizeAttachmentList(request.additionalAttachmentMetadata))
    setSelectedCustomerAttachmentIds(normalizeSelectedIds(request.selectedCustomerAttachmentIds))
    setStatus(request.status)
  }, [])

  const navigateToSavedDraft = useCallback(
    (request: ClaimRequestDraft) => {
      navigate(`/insurance-claim/requests/${request.id}`, {
        replace: true,
        state: { claimRequestSeed: request } satisfies ClaimFormLocationState,
      })
    },
    [navigate],
  )

  const persistDraft = useCallback(
    async (
      draftId: number,
      patch: {
        additionalAttachments?: ClaimAttachmentMetadata[]
        signatureData?: ClaimSignatureData
        selectedCustomerAttachmentIds?: number[]
      },
    ): Promise<ClaimRequestDraft | null> => {
      if (!token || !formReady) {
        return null
      }
      const validationError = validateDraftInputs(same, insured, contractor)
      if (validationError) {
        setMessage(validationError)
        return null
      }
      const currentBody = buildBody()
      const { request } = await updateClaimDraft(token, draftId, {
        ...currentBody,
        additionalAttachmentMetadata: patch.additionalAttachments ?? currentBody.additionalAttachmentMetadata,
        signatureData: patch.signatureData ?? currentBody.signatureData,
        selectedCustomerAttachmentIds:
          patch.selectedCustomerAttachmentIds ?? currentBody.selectedCustomerAttachmentIds,
      })
      applyRequest(request)
      return request
    },
    [applyRequest, buildBody, contractor, formReady, insured, same, token],
  )

  const loadCustomerAttachments = useCallback(
    async (id: number) => {
      if (!token) return
      setCustomerAttachmentsLoading(true)
      try {
        const { attachments } = await listCustomerClaimAppAttachments(token, id)
        setCustomerAttachments(attachments)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '고객앱 첨부파일을 불러오지 못했습니다.')
      } finally {
        setCustomerAttachmentsLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    if (!token) return
    void listClaimCompanies(token)
      .then((r) => setCompanies(r.companies))
      .catch((e) => setMessage(e instanceof Error ? e.message : '보험회사를 불러오지 못했습니다.'))
    const id = Number(params.get('customerId'))
    if (Number.isInteger(id) && id > 0) void fillCustomer(id)
  }, [fillCustomer, params, token])

  useEffect(() => {
    if (!token || requestId == null) {
      setFormReady(true)
      return
    }

    setFormReady(false)
    const seed = (location.state as ClaimFormLocationState | null)?.claimRequestSeed
    if (seed?.id === requestId && hydratedRequestIdRef.current !== requestId) {
      applyRequest(seed)
      hydratedRequestIdRef.current = requestId
      setFormReady(true)
      return
    }

    if (hydratedRequestIdRef.current === requestId) {
      setFormReady(true)
      return
    }

    void getClaimRequest(token, requestId)
      .then(({ request }) => {
        applyRequest(request)
        hydratedRequestIdRef.current = requestId
        setFormReady(true)
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : '청구 내역을 불러오지 못했습니다.')
        setFormReady(true)
      })
  }, [applyRequest, location.state, requestId, token])

  useEffect(() => {
    if (!token || customerId == null) {
      setCustomerAttachments([])
      return
    }
    void loadCustomerAttachments(customerId)
  }, [customerId, loadCustomerAttachments, token])

  const findCustomers = async (target: 'insured' | 'contractor') => {
    const query = target === 'insured' ? customerQuery : contractorQuery
    if (!token || !query.trim()) return
    try {
      const scopeGaId =
        user?.gaId != null && Number.isFinite(Number(user.gaId)) && Number(user.gaId) > 0
          ? Number(user.gaId)
          : null
      const hits = await searchCustomers(token, query, { limit: 10, scopeGaId })
      if (target === 'insured') {
        setMatches(hits)
      } else {
        setContractorMatches(hits)
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '고객 검색에 실패했습니다.')
    }
  }

  const save = async (): Promise<ClaimRequestDraft | null> => {
    if (!token || selectedCompanyIds.length === 0) {
      setMessage('보험회사를 하나 이상 선택하고 피보험자 이름을 입력해 주세요.')
      return null
    }
    const validationError = validateDraftInputs(same, insured, contractor)
    if (validationError) {
      setMessage(validationError)
      return null
    }
    setSaving(true)
    setMessage('')
    try {
      if (requestId != null) {
        const { request } = await updateClaimDraft(token, requestId, buildBody())
        applyRequest(request)
        setMessage('저장했습니다.')
        return request
      }

      const payload = buildDraftPayload()
      const companyIds = selectedCompanyIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)

      if (companyIds.length === 1) {
        const { request } = await createClaimDraft(token, { ...payload, insuranceCompanyId: companyIds[0] })
        applyRequest(request)
        navigateToSavedDraft(request)
        return request
      }

      const { requests } = await createClaimDraftsBatch(token, payload, companyIds)
      setMessage(`${requests.length}건의 청구 초안을 저장했습니다.`)
      navigate('/insurance-claim/requests')
      return requests[0] ?? null
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : '청구 초안 저장에 실패했습니다.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const ensureDraftId = async (): Promise<number | null> => {
    if (requestId != null) {
      return requestId
    }
    if (!token || selectedCompanyIds.length === 0) {
      setMessage('첨부/서명 업로드 전에 보험회사와 피보험자 이름을 입력하고 저장해 주세요.')
      return null
    }
    if (selectedCompanyIds.length > 1) {
      setMessage('여러 보험회사 선택 시 먼저 [청구 초안 저장]을 눌러 주세요.')
      return null
    }
    const validationError = validateDraftInputs(same, insured, contractor)
    if (validationError) {
      setMessage(validationError)
      return null
    }
    setSaving(true)
    try {
      const { request } = await createClaimDraft(token, buildBody())
      applyRequest(request)
      navigateToSavedDraft(request)
      return request.id
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : '청구 초안 저장에 실패했습니다.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleUploadAttachment = async (file: File) => {
    if (!token) return
    const id = await ensureDraftId()
    if (id == null) return
    setUploadingAttachment(true)
    setMessage('')
    try {
      const { attachment } = await uploadClaimAttachment(token, id, file)
      const nextAttachments = [...additionalAttachments, attachment]
      setAdditionalAttachments(nextAttachments)
      const persisted = await persistDraft(id, { additionalAttachments: nextAttachments })
      if (persisted == null) {
        return
      }
      setMessage('첨부파일을 저장했습니다.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '첨부파일 업로드에 실패했습니다.')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleSaveSignature = async (role: 'insured' | 'contractor', pngBlob: Blob) => {
    if (!token) return
    const id = await ensureDraftId()
    if (id == null) return
    setUploadingSignatureRole(role)
    setMessage('')
    try {
      const { signature } = await uploadClaimSignature(token, id, role, pngBlob)
      const nextSignatureData: ClaimSignatureData = {
        ...signatureData,
        [role === 'contractor' ? 'contractorSignature' : 'insuredSignature']: signature,
      }
      setSignatureData(nextSignatureData)
      const persisted = await persistDraft(id, { signatureData: nextSignatureData })
      if (persisted == null) {
        return
      }
      setMessage('서명을 저장했습니다.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '서명 저장에 실패했습니다.')
    } finally {
      setUploadingSignatureRole(null)
    }
  }

  const handleGenerate = async () => {
    if (!token || requestId == null) return
    setGenerating(true)
    setMessage('')
    try {
      const saved = await save()
      if (saved == null) {
        return
      }
      if (!contractorSnapshotReady(saved)) {
        setMessage('계약자 정보가 저장되지 않았습니다. 계약자 정보 확인 후 다시 저장해 주세요.')
        return
      }
      const { request } = await generateClaimDocuments(token, saved.id)
      applyRequest(request)
      setMessage('청구서·동의서 PDF를 생성했습니다.')
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'PDF 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!token || requestId == null) return
    setDownloading(true)
    setMessage('')
    try {
      await downloadClaimBundle(token, requestId)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'ZIP 다운로드에 실패했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  const personInputFields = (value: Person, setValue: (value: Person) => void) => (
    <div className="insurance-claim-form__field-grid insurance-claim-form__field-grid--person claim-person-grid">
      {(['name', 'ssn', 'phone', 'address', 'job'] as const).map((key) => (
        <label
          key={key}
          className={`insurance-claim-form__field${
            key === 'address'
              ? ' insurance-claim-form__field--address claim-person-address'
              : key === 'job'
                ? ' insurance-claim-form__field--job claim-person-job'
                : ''
          }`}
        >
          <span className="insurance-claim-form__label">
            {({ name: '이름', ssn: '주민등록번호', phone: '연락처', address: '주소', job: '직업' }[key])}
          </span>
          <FormInput value={value[key]} onChange={(e) => setValue({ ...value, [key]: e.target.value })} />
        </label>
      ))}
    </div>
  )

  return (
    <main className="page page--with-back insurance-claim-form insurance-claim-form-page insurance-claim-page">
      <header className="page-header">
        <h1>{requestId != null ? `보험청구 #${requestId}` : '보험청구'}</h1>
        <p>고객 등록 없이 직접 입력할 수 있으며, 고객 불러오기는 입력 보조 기능입니다.</p>
        {requestId != null ? <p className="insurance-claim-form__status">상태: {formatStatus(status)}</p> : null}
      </header>

      <InsuranceClaimSubnav />

      <div className="insurance-claim-compose-layout">
        <div className="insurance-claim-main-form">
          <section className="insurance-claim-form__section claim-form-section">
            <h2>1. 피보험자 정보</h2>
            <p className="insurance-claim-form__section-desc">직접 입력하거나 고객 불러오기로 정보를 채울 수 있습니다.</p>
            <ClaimRequestPersonCustomerSearch
              query={customerQuery}
              matches={matches}
              onQueryChange={setCustomerQuery}
              onSearch={() => void findCustomers('insured')}
              onSelect={(id) => void fillCustomer(id)}
            />
            {personInputFields(insured, setInsured)}
          </section>

          <section className="insurance-claim-form__section claim-form-section">
            <h2>2. 계약자와 피보험자 동일 여부</h2>
            <label className="insurance-claim-form__field insurance-claim-form__field--same">
              <span className="insurance-claim-form__label">동일 여부</span>
              <FormSelect
                value={same ? 'yes' : 'no'}
                onChange={(e) => setSame(e.target.value === 'yes')}
                options={[
                  { value: 'yes', label: '예' },
                  { value: 'no', label: '아니오' },
                ]}
              />
            </label>
          </section>

          {!same ? (
            <section className="insurance-claim-form__section claim-form-section">
              <h2>3. 계약자 정보</h2>
              <ClaimRequestPersonCustomerSearch
                query={contractorQuery}
                matches={contractorMatches}
                onQueryChange={setContractorQuery}
                onSearch={() => void findCustomers('contractor')}
                onSelect={(id) => void fillContractor(id)}
                searchLabel="고객 검색"
              />
              {personInputFields(contractor, setContractor)}
            </section>
          ) : null}

          <section className="insurance-claim-form__section claim-form-section">
            <h2>{same ? '3' : '4'}. 진료 / 사고 정보</h2>
            <p className="insurance-claim-form__section-desc">청구 유형과 진료·사고 내용을 입력합니다.</p>
            <div className="insurance-claim-form__field-grid insurance-claim-form__field-grid--treatment claim-treatment-grid">
              <label className="insurance-claim-form__field">
                <span className="insurance-claim-form__label">청구유형</span>
                <FormSelect
                  value={claimData.claimType}
                  onChange={(e) => setClaimData({ ...claimData, claimType: e.target.value })}
                  options={[
                    { value: 'disease', label: '질병' },
                    { value: 'injury', label: '상해' },
                    { value: 'traffic', label: '교통사고' },
                  ]}
                />
              </label>
              <label className="insurance-claim-form__field">
                <span className="insurance-claim-form__label">진료/사고일자</span>
                <FormInput
                  type="date"
                  value={claimData.treatmentDate}
                  onChange={(e) => setClaimData({ ...claimData, treatmentDate: e.target.value })}
                />
              </label>
              <label className="insurance-claim-form__field insurance-claim-form__field--description">
                <span className="insurance-claim-form__label">질병/사고 내용</span>
                <FormTextarea
                  value={claimData.claimDescription}
                  onChange={(e) => setClaimData({ ...claimData, claimDescription: e.target.value })}
                  placeholder="질병/사고 내용"
                />
              </label>
            </div>
          </section>

          <section className="insurance-claim-form__section claim-form-section">
            <h2>{same ? '4' : '5'}. 계좌정보</h2>
            <p className="insurance-claim-form__section-desc">보험금 수령 계좌 정보를 입력합니다.</p>
            <div className="insurance-claim-form__field-grid insurance-claim-form__field-grid--payment claim-bank-grid">
              <label className="insurance-claim-form__field">
                <span className="insurance-claim-form__label">계좌 유형</span>
                <FormSelect
                  value={paymentData.accountType}
                  onChange={(e) => setPaymentData({ ...paymentData, accountType: e.target.value })}
                  options={[
                    { value: 'normal', label: '일반' },
                    { value: 'auto_debit', label: '자동이체' },
                  ]}
                />
              </label>
              {(['bankName', 'accountNumber', 'accountHolder'] as const).map((key) => (
                <label key={key} className="insurance-claim-form__field">
                  <span className="insurance-claim-form__label">
                    {key === 'bankName' ? '은행명' : key === 'accountNumber' ? '계좌번호' : '예금주'}
                  </span>
                  <FormInput
                    value={paymentData[key]}
                    onChange={(e) => setPaymentData({ ...paymentData, [key]: e.target.value })}
                    placeholder={key === 'bankName' ? '은행명' : key === 'accountNumber' ? '계좌번호' : '예금주'}
                  />
                </label>
              ))}
            </div>
          </section>

          <ClaimRequestExtrasSection
            customerId={customerId}
            draftSaved={draftSaved}
            additionalAttachments={additionalAttachments}
            selectedCustomerAttachmentIds={selectedCustomerAttachmentIds}
            customerAttachments={customerAttachments}
            customerAttachmentsLoading={customerAttachmentsLoading}
            signatureData={signatureData}
            contractorSameAsInsured={same}
            uploadingAttachment={uploadingAttachment}
            uploadingSignatureRole={uploadingSignatureRole}
            onUploadAttachment={(file) => void handleUploadAttachment(file)}
            onRemoveAttachment={(storageKey) => {
              const nextAttachments = additionalAttachments.filter((item) => item.storageKey !== storageKey)
              setAdditionalAttachments(nextAttachments)
              if (requestId != null) {
                void persistDraft(requestId, { additionalAttachments: nextAttachments })
              }
            }}
            onToggleCustomerAttachment={(id, checked) => {
              const next = checked
                ? [...new Set([...selectedCustomerAttachmentIds, id])]
                : selectedCustomerAttachmentIds.filter((value) => value !== id)
              setSelectedCustomerAttachmentIds(next)
              if (requestId != null) {
                void persistDraft(requestId, { selectedCustomerAttachmentIds: next })
              }
            }}
            onSaveSignature={handleSaveSignature}
            onClearSignature={(role) => {
              const nextSignatureData: ClaimSignatureData = {
                ...signatureData,
                [role === 'contractor' ? 'contractorSignature' : 'insuredSignature']: null,
              }
              setSignatureData(nextSignatureData)
              if (requestId != null) {
                void persistDraft(requestId, { signatureData: nextSignatureData })
              }
            }}
            sectionsStartAt={same ? 5 : 6}
          />

          {message ? (
            <p className="insurance-claim-form__message" role="alert">
              {message}
            </p>
          ) : null}

          <div className="insurance-claim-form__actions-bar claim-form-actions">
            <FormButton htmlType="button" variant="primary" disabled={saving || !isDraft} onClick={() => void save()}>
              {saving ? '저장 중…' : '청구 초안 저장'}
            </FormButton>
            {requestId != null ? (
              <>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  disabled={generating || !isDraft}
                  onClick={() => void handleGenerate()}
                >
                  {generating ? '생성 중…' : 'PDF 생성'}
                </FormButton>
                {status !== 'draft' ? (
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    disabled={downloading}
                    onClick={() => void handleDownload()}
                  >
                    {downloading ? '다운로드 중…' : 'ZIP 다운로드'}
                  </FormButton>
                ) : null}
              </>
            ) : null}
            <Link className="button button--secondary" to="/insurance-claim/requests">
              청구 내역
            </Link>
          </div>
        </div>

        <ClaimCompanyPickerPanel
          companies={companies}
          selectedCompanyIds={selectedCompanyIds}
          onToggle={toggleCompanyId}
          disabled={!isDraft}
          multiSelect={requestId == null}
        />
      </div>
    </main>
  )
}
