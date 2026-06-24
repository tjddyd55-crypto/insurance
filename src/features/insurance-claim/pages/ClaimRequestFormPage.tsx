import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById, searchCustomers } from '../../customers/api/customersApi'
import { createClaimDraft, getClaimRequest, listClaimCompanies, updateClaimDraft, type ClaimCompany } from '../api/claimRequestsApi'

type Person = { name: string; ssn: string; phone: string; address: string; job: string }
const emptyPerson = (): Person => ({ name: '', ssn: '', phone: '', address: '', job: '' })

export default function ClaimRequestFormPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { id: requestIdParam } = useParams<{ id: string }>()
  const requestId = Number(requestIdParam)
  const [params] = useSearchParams()
  const [companies, setCompanies] = useState<ClaimCompany[]>([])
  const [companyId, setCompanyId] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [matches, setMatches] = useState<{ id: number; name: string; phone?: string }[]>([])
  const [insured, setInsured] = useState<Person>(emptyPerson)
  const [same, setSame] = useState(true)
  const [contractor, setContractor] = useState<Person>(emptyPerson)
  const [claimData, setClaimData] = useState({ claimType: 'disease', treatmentDate: '', claimDescription: '' })
  const [paymentData, setPaymentData] = useState({ accountType: 'normal', bankName: '', accountNumber: '', accountHolder: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fillCustomer = useCallback(async (id: number) => {
    if (!token) return
    const customer = await getCustomerById(token, id)
    if (!customer) return
    setCustomerId(customer.id)
    setInsured({ name: customer.name ?? '', ssn: customer.ssn ?? '', phone: customer.phone ?? '', address: customer.address ?? '', job: customer.job ?? '' })
    setPaymentData((prev) => ({ ...prev, accountHolder: prev.accountHolder || customer.name || '' }))
    setMatches([])
  }, [token])

  useEffect(() => {
    if (!token) return
    void listClaimCompanies(token).then((r) => setCompanies(r.companies)).catch((e) => setMessage(e instanceof Error ? e.message : '보험회사를 불러오지 못했습니다.'))
    const id = Number(params.get('customerId'))
    if (Number.isInteger(id) && id > 0) void fillCustomer(id)
  }, [fillCustomer, params, token])

  useEffect(() => {
    if (!token || !Number.isInteger(requestId) || requestId < 1) return
    void getClaimRequest(token, requestId).then(({ request }) => {
      setCompanyId(String(request.insuranceCompanyId)); setCustomerId(request.customerId); setInsured(request.insuredSnapshot as Person)
      setSame(request.contractorSameAsInsured); setContractor((request.contractorSnapshot ?? emptyPerson()) as Person)
      setClaimData({ claimType: request.claimData.claimType ?? 'disease', treatmentDate: request.claimData.treatmentDate ?? '', claimDescription: request.claimData.claimDescription ?? '' })
      setPaymentData({ accountType: request.paymentData.accountType ?? 'normal', bankName: request.paymentData.bankName ?? '', accountNumber: request.paymentData.accountNumber ?? '', accountHolder: request.paymentData.accountHolder ?? '' })
    }).catch((e) => setMessage(e instanceof Error ? e.message : '청구 내역을 불러오지 못했습니다.'))
  }, [requestId, token])

  const findCustomers = async () => {
    if (!token || !customerQuery.trim()) return
    try { setMatches(await searchCustomers(token, customerQuery, { limit: 10 })) } catch (e) { setMessage(e instanceof Error ? e.message : '고객 검색에 실패했습니다.') }
  }

  const save = async () => {
    if (!token || !companyId || !insured.name.trim()) { setMessage('보험회사와 피보험자 이름은 필수입니다.'); return }
    setSaving(true); setMessage('')
    try {
      const body = {
        customerId, insuranceCompanyId: Number(companyId), insuredSnapshot: insured,
        contractorSnapshot: same ? null : contractor, contractorSameAsInsured: same,
        claimData, paymentData, signatureData: {}, selectedCustomerAttachmentIds: [], additionalAttachmentMetadata: [],
      }
      const { request } = Number.isInteger(requestId) && requestId > 0 ? await updateClaimDraft(token, requestId, body) : await createClaimDraft(token, body)
      navigate(`/insurance-claim/requests/${request.id}`)
    } catch (e) { setMessage(e instanceof ApiError ? e.message : '청구 초안 저장에 실패했습니다.') } finally { setSaving(false) }
  }

  const personFields = (value: Person, setValue: (value: Person) => void, title: string) => <section className="insurance-claim-form__section"><h2>{title}</h2>{(['name', 'ssn', 'phone', 'address', 'job'] as const).map((key) => <label key={key}>{({ name: '이름', ssn: '주민등록번호', phone: '연락처', address: '주소', job: '직업' }[key])}<FormInput value={value[key]} onChange={(e) => setValue({ ...value, [key]: e.target.value })} /></label>)}</section>

  return <main className="page insurance-claim-form"><header className="page-header"><h1>보험청구 작성</h1><p>고객 등록 없이 직접 입력할 수 있으며, 고객 불러오기는 입력 보조 기능입니다.</p></header>
    <section className="insurance-claim-form__section"><h2>1. 보험회사</h2><FormSelect value={companyId} onChange={(e) => setCompanyId(e.target.value)} options={[{ value: '', label: '보험회사 선택' }, ...companies.map((c) => ({ value: String(c.id), label: c.companyName }))]} /></section>
    <section className="insurance-claim-form__section"><h2>2. 피보험자 정보</h2><div className="insurance-claim-form__customer-search"><FormInput value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="고객명 또는 연락처 검색 (선택)" /><FormButton htmlType="button" onClick={() => void findCustomers()}>고객 불러오기</FormButton></div>{matches.map((m) => <FormButton key={m.id} htmlType="button" onClick={() => void fillCustomer(m.id)}>{m.name} {m.phone ?? ''}</FormButton>)}{personFields(insured, setInsured, '피보험자 직접 입력')}</section>
    <section className="insurance-claim-form__section"><h2>3. 계약자와 피보험자 동일 여부</h2><FormSelect value={same ? 'yes' : 'no'} onChange={(e) => setSame(e.target.value === 'yes')} options={[{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }]} /></section>
    {!same ? personFields(contractor, setContractor, '4. 계약자 정보') : null}
    <section className="insurance-claim-form__section"><h2>5. 진료 / 사고 정보</h2><FormSelect value={claimData.claimType} onChange={(e) => setClaimData({ ...claimData, claimType: e.target.value })} options={[{ value: 'disease', label: '질병' }, { value: 'injury', label: '상해' }, { value: 'traffic', label: '교통사고' }]} /><FormInput type="date" value={claimData.treatmentDate} onChange={(e) => setClaimData({ ...claimData, treatmentDate: e.target.value })} /><FormTextarea value={claimData.claimDescription} onChange={(e) => setClaimData({ ...claimData, claimDescription: e.target.value })} placeholder="질병/사고 내용" /></section>
    <section className="insurance-claim-form__section"><h2>6. 계좌정보</h2><FormSelect value={paymentData.accountType} onChange={(e) => setPaymentData({ ...paymentData, accountType: e.target.value })} options={[{ value: 'normal', label: '일반' }, { value: 'auto_debit', label: '자동이체' }]} />{(['bankName', 'accountNumber', 'accountHolder'] as const).map((key) => <FormInput key={key} value={paymentData[key]} onChange={(e) => setPaymentData({ ...paymentData, [key]: e.target.value })} placeholder={key === 'bankName' ? '은행명' : key === 'accountNumber' ? '계좌번호' : '예금주'} />)}</section>
    <section className="insurance-claim-form__section"><h2>7. 서명 · 8. 첨부파일</h2><p>다음 단계에서 서명·첨부파일·생성/다운로드를 연결합니다.</p></section>
    {message ? <p role="alert">{message}</p> : null}<FormButton htmlType="button" variant="primary" disabled={saving} onClick={() => void save()}>{saving ? '저장 중…' : '청구 초안 저장'}</FormButton> <Link to="/insurance-claim/requests">청구 내역</Link>
  </main>
}
