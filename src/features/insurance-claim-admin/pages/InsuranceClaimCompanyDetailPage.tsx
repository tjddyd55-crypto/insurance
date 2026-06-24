import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  getInsuranceClaimCompany,
  patchInsuranceClaimCompany,
  uploadInsuranceClaimDocument,
  type InsuranceClaimCompanySummary,
  type InsuranceClaimDocumentSummary,
  type InsuranceClaimDocumentType,
} from '../api/insuranceClaimAdminApi'
import {
  INSURANCE_CLAIM_COMPANY_TYPE_LABELS,
  INSURANCE_CLAIM_COMPANY_TYPE_ORDER,
  INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS,
  formatClaimSetupStatus,
} from '../insuranceClaimAdmin.config'
import '../insurance-claim-admin.css'

const PRIMARY_DOC_TYPES: InsuranceClaimDocumentType[] = ['claim_form', 'consent_form']

export default function InsuranceClaimCompanyDetailPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const companyId = Number(idParam)
  const navigate = useNavigate()
  const { token } = useAuth()

  const [company, setCompany] = useState<InsuranceClaimCompanySummary | null>(null)
  const [documents, setDocuments] = useState<InsuranceClaimDocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveInfo, setSaveInfo] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [companyType, setCompanyType] = useState(company?.companyType ?? 'non_life')
  const [faxNumber, setFaxNumber] = useState('')
  const [displayOrder, setDisplayOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [memo, setMemo] = useState('')

  const [uploadType, setUploadType] = useState<InsuranceClaimDocumentType | null>(null)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim() || !Number.isInteger(companyId) || companyId < 1) return
    setLoading(true)
    setError('')
    try {
      const res = await getInsuranceClaimCompany(token, companyId)
      setCompany(res.company)
      setDocuments(res.documents)
      setCompanyName(res.company.companyName)
      setCompanyType(res.company.companyType)
      setFaxNumber(res.company.faxNumber)
      setDisplayOrder(String(res.company.displayOrder))
      setIsActive(res.company.isActive)
      setMemo(res.company.memo)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [companyId, token])

  useEffect(() => {
    void load()
  }, [load])

  const docByType = (type: InsuranceClaimDocumentType) =>
    documents.find((d) => d.documentType === type) ?? null

  const onSaveBasic = async () => {
    if (!token?.trim() || !company) return
    setSaving(true)
    setSaveInfo('')
    try {
      const res = await patchInsuranceClaimCompany(token, company.id, {
        companyName: companyName.trim(),
        companyType,
        faxNumber: faxNumber.trim(),
        displayOrder: Number(displayOrder) || 0,
        isActive,
        memo: memo.trim(),
      })
      setCompany(res.company)
      setSaveInfo('저장되었습니다.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const onUpload = async () => {
    if (!token?.trim() || !uploadType || uploadFiles.length === 0) return
    setUploading(true)
    setUploadError('')
    try {
      const res = await uploadInsuranceClaimDocument(token, companyId, {
        documentType: uploadType,
        files: uploadFiles,
        title: INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS[uploadType].replace(' PDF', ''),
      })
      setUploadType(null)
      setUploadFiles([])
      await load()
      navigate(`/admin/claim/insurance-companies/${companyId}/documents/${res.document.id}`)
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  if (!Number.isInteger(companyId) || companyId < 1) {
    return (
      <main className="page insurance-claim-admin-page">
        <p className="insurance-claim-admin-page__error">잘못된 경로입니다.</p>
      </main>
    )
  }

  return (
    <main className="page insurance-claim-admin-page">
      <div className="insurance-claim-admin-page__toolbar">
        <Link to="/admin/claim/insurance-companies" className="insurance-claim-admin-link">
          ← 보험회사 목록
        </Link>
      </div>
      <h1 className="insurance-claim-admin-page__title">{company?.companyName ?? '보험회사 상세'}</h1>
      {error ? (
        <p className="insurance-claim-admin-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="insurance-claim-admin-page__hint">불러오는 중…</p> : null}

      {company ? (
        <>
          <section className="insurance-claim-admin-card">
            <h2 className="insurance-claim-admin-card__title">기본정보</h2>
            <div className="insurance-claim-admin-form">
              <label className="insurance-claim-admin-form__label">
                회사명
                <FormInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </label>
              <label className="insurance-claim-admin-form__label">
                회사구분
                <FormSelect
                  value={companyType}
                  options={INSURANCE_CLAIM_COMPANY_TYPE_ORDER.map((t) => ({
                    value: t,
                    label: INSURANCE_CLAIM_COMPANY_TYPE_LABELS[t],
                  }))}
                  onChange={(e) => setCompanyType(e.target.value as typeof companyType)}
                />
              </label>
              <label className="insurance-claim-admin-form__label">
                팩스번호
                <FormInput value={faxNumber} onChange={(e) => setFaxNumber(e.target.value)} />
              </label>
              <label className="insurance-claim-admin-form__label">
                표시 순서
                <FormInput type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
              </label>
              <label className="insurance-claim-admin-form__label insurance-claim-admin-form__label--row">
                <FormInput type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span>사용 여부</span>
              </label>
              <label className="insurance-claim-admin-form__label">
                메모
                <FormTextarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
              </label>
              {saveInfo ? (
                <p className="insurance-claim-admin-page__info" role="status">
                  {saveInfo}
                </p>
              ) : null}
              <FormButton htmlType="button" variant="primary" disabled={saving} onClick={() => void onSaveBasic()}>
                {saving ? '저장 중…' : '기본정보 저장'}
              </FormButton>
            </div>
          </section>

          {PRIMARY_DOC_TYPES.map((docType) => {
            const doc = docByType(docType)
            const configured = Boolean(doc && doc.pageCount > 0 && doc.storageKey)
            return (
              <section key={docType} className="insurance-claim-admin-card">
                <h2 className="insurance-claim-admin-card__title">{INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS[docType]}</h2>
                <p className="insurance-claim-admin-page__hint">
                  설정: {formatClaimSetupStatus(configured)}
                  {doc ? ` · ${doc.pageCount}페이지` : ''}
                  {doc && doc.fieldCount > 0 ? ` · 좌표 ${doc.fieldCount}개` : ''}
                </p>
                <div className="insurance-claim-admin-page__toolbar">
                  {doc ? (
                    <Link
                      to={`/admin/claim/insurance-companies/${companyId}/documents/${doc.id}`}
                      className="insurance-claim-admin-link insurance-claim-admin-link--button"
                    >
                      좌표 설정
                    </Link>
                  ) : null}
                  <FormButton htmlType="button" variant="secondary" onClick={() => setUploadType(docType)}>
                    {configured ? 'PDF 다시 업로드' : 'PDF 업로드'}
                  </FormButton>
                </div>
                {uploadType === docType ? (
                  <div className="insurance-claim-admin-upload-box">
                    <p className="insurance-claim-admin-page__hint">
                      여러 PDF를 선택하면 순서대로 병합됩니다. 좌표는 병합된 PDF 기준 page index(0부터)로 설정합니다.
                    </p>
                    <FormInput
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      onChange={(e) => setUploadFiles(e.target.files ? Array.from(e.target.files) : [])}
                    />
                    {uploadError ? (
                      <p className="insurance-claim-admin-page__error" role="alert">
                        {uploadError}
                      </p>
                    ) : null}
                    <div className="insurance-claim-admin-page__toolbar">
                      <FormButton htmlType="button" variant="primary" disabled={uploading} onClick={() => void onUpload()}>
                        {uploading ? '업로드 중…' : '업로드 후 좌표 설정'}
                      </FormButton>
                      <FormButton
                        htmlType="button"
                        variant="secondary"
                        disabled={uploading}
                        onClick={() => {
                          setUploadType(null)
                          setUploadFiles([])
                          setUploadError('')
                        }}
                      >
                        취소
                      </FormButton>
                    </div>
                  </div>
                ) : null}
              </section>
            )
          })}
        </>
      ) : null}
    </main>
  )
}
