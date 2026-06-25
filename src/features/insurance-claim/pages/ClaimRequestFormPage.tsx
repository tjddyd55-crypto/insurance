import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById, searchCustomers } from '../../customers/api/customersApi'
import {
  createClaimDraft,
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
  type ClaimSignatureData,
  type CustomerClaimAppAttachment,
} from '../api/claimRequestsApi'
import ClaimRequestExtrasSection from '../components/ClaimRequestExtrasSection'
import ClaimRequestPersonCustomerSearch from '../components/ClaimRequestPersonCustomerSearch'
import '../insurance-claim-form.css'

type Person = { name: string; ssn: string; phone: string; address: string; job: string }
const emptyPerson = (): Person => ({ name: '', ssn: '', phone: '', address: '', job: '' })

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
  const { token } = useAuth()
  const navigate = useNavigate()
  const { id: requestIdParam } = useParams<{ id: string }>()
  const parsedRequestId = Number(requestIdParam)
  const requestId = Number.isInteger(parsedRequestId) && parsedRequestId > 0 ? parsedRequestId : null
  const [params] = useSearchParams()

  const [companies, setCompanies] = useState<ClaimCompany[]>([])
  const [companyId, setCompanyId] = useState('')
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

  const draftSaved = requestId != null
  const isDraft = status === 'draft'

  const buildBody = useCallback(
    () => ({
      customerId,
      insuranceCompanyId: Number(companyId),
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
      companyId,
      contractor,
      customerId,
      insured,
      paymentData,
      same,
      selectedCustomerAttachmentIds,
      signatureData,
    ],
  )

  const fillCustomer = useCallback(
    async (id: number) => {
      if (!token) return
      const customer = await getCustomerById(token, id)
      if (!customer) return
      setCustomerId(customer.id)
      setInsured({
        name: customer.name ?? '',
        ssn: customer.ssn ?? '',
        phone: customer.phone ?? '',
        address: customer.address ?? '',
        job: customer.job ?? '',
      })
      setPaymentData((prev) => ({ ...prev, accountHolder: prev.accountHolder || customer.name || '' }))
      setMatches([])
      setCustomerQuery('')
    },
    [token],
  )

  const fillContractor = useCallback(
    async (id: number) => {
      if (!token) return
      const customer = await getCustomerById(token, id)
      if (!customer) return
      setContractor({
        name: customer.name ?? '',
        ssn: customer.ssn ?? '',
        phone: customer.phone ?? '',
        address: customer.address ?? '',
        job: customer.job ?? '',
      })
      setContractorMatches([])
      setContractorQuery('')
    },
    [token],
  )

  const persistDraft = useCallback(
    async (
      draftId: number,
      patch: {
        additionalAttachments?: ClaimAttachmentMetadata[]
        signatureData?: ClaimSignatureData
        selectedCustomerAttachmentIds?: number[]
      },
    ) => {
      if (!token) {
        return
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
    },
    [applyRequest, buildBody, token],
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

  const applyRequest = useCallback((request: Awaited<ReturnType<typeof getClaimRequest>>['request']) => {
    setCompanyId(String(request.insuranceCompanyId))
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

  useEffect(() => {
    if (!token) return
    void listClaimCompanies(token)
      .then((r) => setCompanies(r.companies))
      .catch((e) => setMessage(e instanceof Error ? e.message : '보험회사를 불러오지 못했습니다.'))
    const id = Number(params.get('customerId'))
    if (Number.isInteger(id) && id > 0) void fillCustomer(id)
  }, [fillCustomer, params, token])

  useEffect(() => {
    if (!token || requestId == null) return
    void getClaimRequest(token, requestId)
      .then(({ request }) => applyRequest(request))
      .catch((e) => setMessage(e instanceof Error ? e.message : '청구 내역을 불러오지 못했습니다.'))
  }, [applyRequest, requestId, token])

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
      const hits = await searchCustomers(token, query, { limit: 10 })
      if (target === 'insured') {
        setMatches(hits)
      } else {
        setContractorMatches(hits)
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '고객 검색에 실패했습니다.')
    }
  }

  const save = async () => {
    if (!token || !companyId || !insured.name.trim()) {
      setMessage('보험회사와 피보험자 이름은 필수입니다.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const body = buildBody()
      const { request } =
        requestId != null ? await updateClaimDraft(token, requestId, body) : await createClaimDraft(token, body)
      applyRequest(request)
      if (requestId == null) {
        navigate(`/insurance-claim/requests/${request.id}`, { replace: true })
      } else {
        setMessage('저장했습니다.')
      }
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : '청구 초안 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const ensureDraftId = async (): Promise<number | null> => {
    if (requestId != null) {
      return requestId
    }
    if (!token || !companyId || !insured.name.trim()) {
      setMessage('첨부/서명 업로드 전에 보험회사와 피보험자 이름을 입력하고 저장해 주세요.')
      return null
    }
    setSaving(true)
    try {
      const { request } = await createClaimDraft(token, buildBody())
      applyRequest(request)
      navigate(`/insurance-claim/requests/${request.id}`, { replace: true })
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
      await persistDraft(id, { additionalAttachments: nextAttachments })
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
      await persistDraft(id, { signatureData: nextSignatureData })
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
      await save()
      const { request } = await generateClaimDocuments(token, requestId)
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
    <>
      {(['name', 'ssn', 'phone', 'address', 'job'] as const).map((key) => (
        <label key={key}>
          {({ name: '이름', ssn: '주민등록번호', phone: '연락처', address: '주소', job: '직업' }[key])}
          <FormInput value={value[key]} onChange={(e) => setValue({ ...value, [key]: e.target.value })} />
        </label>
      ))}
    </>
  )

  return (
    <main className="page page--with-back insurance-claim-form">
      <header className="page-header">
        <h1>{requestId != null ? `보험청구 #${requestId}` : '보험청구 작성'}</h1>
        <p>고객 등록 없이 직접 입력할 수 있으며, 고객 불러오기는 입력 보조 기능입니다.</p>
        {requestId != null ? <p className="insurance-claim-form__status">상태: {formatStatus(status)}</p> : null}
      </header>

      <section className="insurance-claim-form__section">
        <h2>1. 보험회사</h2>
        <FormSelect
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          options={[{ value: '', label: '보험회사 선택' }, ...companies.map((c) => ({ value: String(c.id), label: c.companyName }))]}
        />
      </section>

      <section className="insurance-claim-form__section">
        <h2>2. 피보험자 정보</h2>
        <ClaimRequestPersonCustomerSearch
          query={customerQuery}
          matches={matches}
          onQueryChange={setCustomerQuery}
          onSearch={() => void findCustomers('insured')}
          onSelect={(id) => void fillCustomer(id)}
        />
        {personInputFields(insured, setInsured)}
      </section>

      <section className="insurance-claim-form__section">
        <h2>3. 계약자와 피보험자 동일 여부</h2>
        <FormSelect
          value={same ? 'yes' : 'no'}
          onChange={(e) => setSame(e.target.value === 'yes')}
          options={[
            { value: 'yes', label: '예' },
            { value: 'no', label: '아니오' },
          ]}
        />
      </section>

      {!same ? (
        <section className="insurance-claim-form__section">
          <h2>4. 계약자 정보</h2>
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

      <section className="insurance-claim-form__section">
        <h2>5. 진료 / 사고 정보</h2>
        <FormSelect
          value={claimData.claimType}
          onChange={(e) => setClaimData({ ...claimData, claimType: e.target.value })}
          options={[
            { value: 'disease', label: '질병' },
            { value: 'injury', label: '상해' },
            { value: 'traffic', label: '교통사고' },
          ]}
        />
        <FormInput
          type="date"
          value={claimData.treatmentDate}
          onChange={(e) => setClaimData({ ...claimData, treatmentDate: e.target.value })}
        />
        <FormTextarea
          value={claimData.claimDescription}
          onChange={(e) => setClaimData({ ...claimData, claimDescription: e.target.value })}
          placeholder="질병/사고 내용"
        />
      </section>

      <section className="insurance-claim-form__section">
        <h2>6. 계좌정보</h2>
        <FormSelect
          value={paymentData.accountType}
          onChange={(e) => setPaymentData({ ...paymentData, accountType: e.target.value })}
          options={[
            { value: 'normal', label: '일반' },
            { value: 'auto_debit', label: '자동이체' },
          ]}
        />
        {(['bankName', 'accountNumber', 'accountHolder'] as const).map((key) => (
          <FormInput
            key={key}
            value={paymentData[key]}
            onChange={(e) => setPaymentData({ ...paymentData, [key]: e.target.value })}
            placeholder={key === 'bankName' ? '은행명' : key === 'accountNumber' ? '계좌번호' : '예금주'}
          />
        ))}
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
      />

      {message ? (
        <p className="insurance-claim-form__message" role="alert">
          {message}
        </p>
      ) : null}

      <div className="insurance-claim-form__actions">
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
    </main>
  )
}
