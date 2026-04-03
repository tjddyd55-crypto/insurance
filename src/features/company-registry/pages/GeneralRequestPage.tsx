import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { isInsuranceOpsRole } from '../../auth/roleGuards'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { listCompanyDirectory, saveGeneralRequest } from '../api/companyRegistryApi'
import { normalizeInsuranceCategory } from '../domain/categoryUtils'
import type { InsuranceCategory } from '../domain/insuranceConstants'
import {
  insuranceCompanyMap,
  INSURANCE_TYPE_LABELS,
  INSURANCE_TYPE_ORDER,
  type InsuranceCompanyOption,
} from '../domain/insuranceConstants'
import type { CompanyDirectoryEntry, InsuranceGeneralDraft } from '../domain/types'

const EMPTY_GENERAL: InsuranceGeneralDraft = { description: '', phone: '', fax: '', email: '' }

export default function GeneralRequestPage() {
  const { user, token, isAuthenticated } = useAuth()
  const canEdit = isAuthenticated && !!user && isInsuranceOpsRole(user.role)

  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  const [selectedType, setSelectedType] = useState<InsuranceCategory | ''>('')
  const [selectedCompanyName, setSelectedCompanyName] = useState('')
  const [general, setGeneral] = useState<InsuranceGeneralDraft>({ ...EMPTY_GENERAL })
  const [isSaving, setIsSaving] = useState(false)

  const companyOptions = useMemo((): InsuranceCompanyOption[] => {
    if (!selectedType) {
      return []
    }
    return insuranceCompanyMap[selectedType] ?? []
  }, [selectedType])

  const loadList = useCallback(async () => {
    if (!token) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const rows = await listCompanyDirectory(token)
      setList(rows)
      setStatusText('')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selectedType || !selectedCompanyName) {
      setGeneral({ ...EMPTY_GENERAL })
      return
    }
    if (typeof selectedCompanyName !== 'string') {
      return
    }
    const entry = list.find(
      (e) =>
        normalizeInsuranceCategory(e.category) === selectedType && e.name === selectedCompanyName,
    )
    const g = entry?.general
    if (g) {
      setGeneral({
        description: g.description ?? '',
        phone: g.phone ?? '',
        fax: g.fax ?? '',
        email: g.email ?? '',
      })
    } else {
      setGeneral({ ...EMPTY_GENERAL })
    }
  }, [list, selectedType, selectedCompanyName])

  const handleSave = async () => {
    if (!canEdit || !token) {
      setStatusText('저장은 GA 관리자 이상만 가능합니다.')
      return
    }
    if (!selectedType || !selectedCompanyName.trim()) {
      setStatusText('보험 종류와 보험사를 선택하세요.')
      return
    }

    setIsSaving(true)
    setStatusText('')
    try {
      await saveGeneralRequest(
        {
          company: { category: selectedType, name: selectedCompanyName.trim() },
          general,
        },
        token,
      )
      window.alert('일반화재 설계의뢰 정보를 저장했습니다.')
      await loadList()
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page page--with-back company-registry-page">
      <PageBackButton />
      <nav className="contacts-public-auth" aria-label="이동">
        {canEdit ? (
          <Link className="button button--small contacts-public-auth__link" to="/insurance/company-registry">
            연락처 입력/관리
          </Link>
        ) : null}
        <Link className="button button--small contacts-public-auth__link" to="/insurance/contacts">
          연락처 조회
        </Link>
        <Link className="button button--small contacts-public-auth__link" to="/insurance/history">
          업데이트 현황
        </Link>
        {!isAuthenticated ? (
          <Link className="button button--small button--primary contacts-public-auth__link" to="/login">
            로그인
          </Link>
        ) : null}
      </nav>

      <header className="page-header">
        <h1>일반화재 설계의뢰</h1>
        <p>
          {statusText ||
            '해당 보험사가 「보험사 연락처」에 먼저 등록되어 있어야 합니다. 설명·전화·팩스·이메일은 선택 입력입니다.'}
        </p>
      </header>

      {isLoading ? (
        <p>불러오는 중…</p>
      ) : canEdit ? (
        <section className="card company-registry-form-card">
          <label className="field">
            <span className="field__label">보험 종류</span>
            <select
              className="field__control"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as InsuranceCategory | '')
                setSelectedCompanyName('')
              }}
            >
              <option value="">선택</option>
              {INSURANCE_TYPE_ORDER.map((v) => (
                <option key={v} value={v}>
                  {INSURANCE_TYPE_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">보험사</span>
            <select
              className="field__control"
              value={selectedCompanyName}
              onChange={(e) => setSelectedCompanyName(String(e.target.value ?? ''))}
              disabled={!selectedType}
            >
              <option value="">선택</option>
              {companyOptions.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          <h3 className="company-registry-subtitle">의뢰 연락처 (선택)</h3>
          <div className="field-grid-customers">
            <label className="field field--wide">
              <span className="field__label">설명</span>
              <input
                className="field__control"
                value={general.description}
                onChange={(e) => setGeneral({ ...general, description: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">전화</span>
              <input
                className="field__control"
                value={general.phone}
                onChange={(e) => setGeneral({ ...general, phone: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">팩스</span>
              <input
                className="field__control"
                value={general.fax}
                onChange={(e) => setGeneral({ ...general, fax: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">이메일</span>
              <input
                className="field__control"
                value={general.email}
                onChange={(e) => setGeneral({ ...general, email: e.target.value })}
              />
            </label>
          </div>

          <button
            className="button button--primary button--full"
            type="button"
            disabled={isSaving || !selectedType || !selectedCompanyName}
            onClick={() => void handleSave()}
          >
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </section>
      ) : (
        <section className="card">
          <p className="empty-state">
            저장은 <Link to="/login">로그인</Link> 후 GA 관리자(GA_ADMIN) 이상 권한이 필요합니다.
          </p>
        </section>
      )}
    </main>
  )
}
