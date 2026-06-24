import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { FormButton, FormInput, FormSelect } from '../../../components/form'
import { Modal } from '../../../components/ui'
import { useAuth } from '../../auth/AuthProvider'
import {
  createInsuranceClaimCompany,
  listInsuranceClaimCompanies,
  type InsuranceClaimCompanySummary,
  type InsuranceClaimCompanyType,
} from '../api/insuranceClaimAdminApi'
import {
  formatClaimSetupStatus,
  INSURANCE_CLAIM_COMPANY_TYPE_LABELS,
  INSURANCE_CLAIM_COMPANY_TYPE_ORDER,
} from '../insuranceClaimAdmin.config'
import '../insurance-claim-admin.css'

export default function InsuranceClaimCompanyListPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<InsuranceClaimCompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyType, setCompanyType] = useState<InsuranceClaimCompanyType>('non_life')
  const [faxNumber, setFaxNumber] = useState('')
  const [displayOrder, setDisplayOrder] = useState('0')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await listInsuranceClaimCompanies(token)
      setRows(res.companies)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<InsuranceClaimCompanyType, InsuranceClaimCompanySummary[]>()
    for (const type of INSURANCE_CLAIM_COMPANY_TYPE_ORDER) {
      map.set(type, [])
    }
    for (const row of rows) {
      const list = map.get(row.companyType) ?? []
      list.push(row)
      map.set(row.companyType, list)
    }
    return map
  }, [rows])

  const onCreate = async () => {
    if (!token?.trim()) return
    if (!companyName.trim()) {
      setCreateError('보험회사명을 입력해 주세요.')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await createInsuranceClaimCompany(token, {
        companyName: companyName.trim(),
        companyType,
        faxNumber: faxNumber.trim(),
        displayOrder: Number(displayOrder) || 0,
      })
      setCreateOpen(false)
      setCompanyName('')
      setFaxNumber('')
      setDisplayOrder('0')
      await load()
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : '등록에 실패했습니다.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="page insurance-claim-admin-page">
      <h1 className="insurance-claim-admin-page__title">보험회사 설정</h1>
      <p className="insurance-claim-admin-page__desc">
        보험회사별 청구서·동의서 PDF와 좌표를 관리합니다. 일반 PDF 문서 템플릿과 별도로 운영됩니다.
      </p>
      <div className="insurance-claim-admin-page__toolbar">
        <FormButton htmlType="button" variant="primary" onClick={() => setCreateOpen(true)}>
          보험회사 추가
        </FormButton>
        <FormButton htmlType="button" variant="secondary" onClick={() => void load()}>
          새로고침
        </FormButton>
      </div>
      {error ? (
        <p className="insurance-claim-admin-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="insurance-claim-admin-page__hint">불러오는 중…</p> : null}

      {INSURANCE_CLAIM_COMPANY_TYPE_ORDER.map((type) => {
        const items = grouped.get(type) ?? []
        if (items.length === 0) return null
        return (
          <section key={type} className="insurance-claim-admin-section" aria-label={INSURANCE_CLAIM_COMPANY_TYPE_LABELS[type]}>
            <h2 className="insurance-claim-admin-section__title">{INSURANCE_CLAIM_COMPANY_TYPE_LABELS[type]}</h2>
            <table className="insurance-claim-admin-table">
              <thead>
                <tr>
                  <th>회사명</th>
                  <th>팩스번호</th>
                  <th>청구서</th>
                  <th>동의서</th>
                  <th>좌표</th>
                  <th>사용</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={row.isActive ? '' : 'insurance-claim-admin-table__row--inactive'}>
                    <td>{row.companyName}</td>
                    <td>{row.faxNumber || '—'}</td>
                    <td>{formatClaimSetupStatus(row.claimFormConfigured)}</td>
                    <td>{formatClaimSetupStatus(row.consentFormConfigured)}</td>
                    <td>{formatClaimSetupStatus(row.coordinatesConfigured)}</td>
                    <td>{row.isActive ? '사용' : '비활성'}</td>
                    <td>
                      <Link to={`/admin/claim/insurance-companies/${row.id}`} className="insurance-claim-admin-link">
                        수정
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}

      <Modal open={createOpen} onClose={() => !creating && setCreateOpen(false)} ariaLabel="보험회사 추가" closeOnBackdrop={false}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">보험회사 추가</h2>
        <div className="insurance-claim-admin-form mt-4">
          <label className="insurance-claim-admin-form__label">
            회사명
            <FormInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={120} />
          </label>
          <label className="insurance-claim-admin-form__label">
            구분
            <FormSelect
              value={companyType}
              options={INSURANCE_CLAIM_COMPANY_TYPE_ORDER.map((t) => ({
                value: t,
                label: INSURANCE_CLAIM_COMPANY_TYPE_LABELS[t],
              }))}
              onChange={(e) => setCompanyType(e.target.value as InsuranceClaimCompanyType)}
            />
          </label>
          <label className="insurance-claim-admin-form__label">
            팩스번호
            <FormInput value={faxNumber} onChange={(e) => setFaxNumber(e.target.value)} placeholder="예: 02-1234-5678" />
          </label>
          <label className="insurance-claim-admin-form__label">
            표시 순서
            <FormInput type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
          </label>
          {createError ? (
            <p className="insurance-claim-admin-page__error" role="alert">
              {createError}
            </p>
          ) : null}
          <div className="insurance-claim-admin-page__toolbar">
            <FormButton htmlType="button" variant="primary" disabled={creating} onClick={() => void onCreate()}>
              {creating ? '등록 중…' : '등록'}
            </FormButton>
            <FormButton htmlType="button" variant="secondary" disabled={creating} onClick={() => setCreateOpen(false)}>
              취소
            </FormButton>
          </div>
        </div>
      </Modal>
    </main>
  )
}
