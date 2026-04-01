import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { fullSaveCompanyDirectory, listCompanyDirectory } from '../api/companyRegistryApi'
import { normalizeInsuranceCategory } from '../domain/categoryUtils'
import type { InsuranceCategory } from '../domain/insuranceConstants'
import {
  getInsuranceCompanyDefaultTel,
  insuranceCompanyMap,
  INSURANCE_TYPE_LABELS,
  INSURANCE_TYPE_ORDER,
  isInsuranceCategory,
  type InsuranceCompanyOption,
} from '../domain/insuranceConstants'
import type { CompanyDirectoryEntry, InsuranceCompanyContactDraft, InsuranceCompanyFormState } from '../domain/types'
const EMPTY_COMPANY_FIELDS: Omit<InsuranceCompanyFormState, 'id' | 'category' | 'name'> = {
  customerCenter: '',
  systemPhone: '',
  incallNumber: '',
  visitInfo: '',
}

const EMPTY_CONTACT: InsuranceCompanyContactDraft = { name: '', position: '', phone: '' }

function entryToFormState(entry: CompanyDirectoryEntry): InsuranceCompanyFormState {
  return {
    id: entry.id,
    category: normalizeInsuranceCategory(entry.category) || entry.category,
    name: entry.name,
    customerCenter: entry.customerCenter,
    systemPhone: entry.systemPhone,
    incallNumber: entry.incallNumber,
    visitInfo: entry.visitInfo,
  }
}

function entryContactsToDrafts(entry: CompanyDirectoryEntry): InsuranceCompanyContactDraft[] {
  if (!entry.contacts?.length) {
    return [{ ...EMPTY_CONTACT }]
  }
  return entry.contacts.map((c) => ({
    name: c.name ?? '',
    position: c.position ?? '',
    phone: c.phone ?? '',
  }))
}

export default function CompanyRegistryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token, isAuthenticated } = useAuth()
  const canEdit = isAuthenticated && !!user && ['staff', 'super_admin'].includes(user.role)

  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const [statusText, setStatusText] = useState('')

  const [selectedType, setSelectedType] = useState<InsuranceCategory | ''>('')
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('')

  const [company, setCompany] = useState<InsuranceCompanyFormState>({
    id: null,
    category: '',
    name: '',
    ...EMPTY_COMPANY_FIELDS,
  })
  const [contacts, setContacts] = useState<InsuranceCompanyContactDraft[]>([{ ...EMPTY_CONTACT }])
  const [isSaving, setIsSaving] = useState(false)

  const companyOptions = useMemo((): InsuranceCompanyOption[] => {
    if (!selectedType) {
      return []
    }
    return insuranceCompanyMap[selectedType] ?? []
  }, [selectedType])

  const prevSelectionRef = useRef<{ type: string; company: string }>({ type: '', company: '' })
  const lastAutoCustomerCenterKeyRef = useRef<string>('')

  const hasDirectoryEntryForSelection = useMemo(() => {
    if (!selectedType || !selectedCompanyName) {
      return false
    }
    return list.some(
      (e) =>
        normalizeInsuranceCategory(e.category) === selectedType && e.name === selectedCompanyName,
    )
  }, [list, selectedType, selectedCompanyName])

  const customerCenterMapHint = useMemo(() => {
    if (!selectedType || !selectedCompanyName || hasDirectoryEntryForSelection) {
      return null
    }
    const tel = getInsuranceCompanyDefaultTel(selectedType, selectedCompanyName)
    return tel
      ? '표준 고객센터 번호를 넣었습니다. 필요 시 수정할 수 있습니다.'
      : '전화번호 없음 (직접 입력)'
  }, [hasDirectoryEntryForSelection, selectedCompanyName, selectedType])

  const loadList = useCallback(async () => {
    try {
      const rows = await listCompanyDirectory()
      setList(rows)
      setStatusText('')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    const t = searchParams.get('type')
    const c = searchParams.get('company')
    const name = c != null ? String(c).trim() : ''
    if (t && isInsuranceCategory(t) && name) {
      setSelectedType(t)
      setSelectedCompanyName(name)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!selectedType || !selectedCompanyName) {
      prevSelectionRef.current = { type: '', company: '' }
      lastAutoCustomerCenterKeyRef.current = ''
      setCompany({
        id: null,
        category: selectedType || '',
        name: '',
        ...EMPTY_COMPANY_FIELDS,
      })
      setContacts([{ ...EMPTY_CONTACT }])
      return
    }

    if (typeof selectedCompanyName !== 'string') {
      return
    }

    const entry = list.find(
      (e) =>
        normalizeInsuranceCategory(e.category) === selectedType && e.name === selectedCompanyName,
    )

    if (entry) {
      prevSelectionRef.current = { type: selectedType, company: selectedCompanyName }
      setCompany(entryToFormState(entry))
      setContacts(entryContactsToDrafts(entry))
      return
    }

    const selChanged =
      prevSelectionRef.current.type !== selectedType ||
      prevSelectionRef.current.company !== selectedCompanyName
    prevSelectionRef.current = { type: selectedType, company: selectedCompanyName }

    if (selChanged) {
      lastAutoCustomerCenterKeyRef.current = ''
      setCompany({
        id: null,
        category: selectedType,
        name: selectedCompanyName,
        ...EMPTY_COMPANY_FIELDS,
        customerCenter: '',
      })
      setContacts([{ ...EMPTY_CONTACT }])
    }
  }, [list, selectedType, selectedCompanyName])

  useEffect(() => {
    if (!selectedType || !selectedCompanyName) {
      return
    }
    if (typeof selectedCompanyName !== 'string') {
      return
    }
    if (import.meta.env.DEV) {
      console.log('selectedCompanyName:', selectedCompanyName, typeof selectedCompanyName)
    }

    const entry = list.find(
      (e) =>
        normalizeInsuranceCategory(e.category) === selectedType && e.name === selectedCompanyName,
    )
    if (entry) {
      return
    }

    const key = `${selectedType}::${selectedCompanyName}`
    if (lastAutoCustomerCenterKeyRef.current === key) {
      return
    }
    lastAutoCustomerCenterKeyRef.current = key

    const defaultTel = getInsuranceCompanyDefaultTel(selectedType, selectedCompanyName)
    setCompany((prev) => ({ ...prev, customerCenter: defaultTel || '' }))
  }, [list, selectedType, selectedCompanyName])

  const addContactRow = () => {
    setContacts((prev) => [...prev, { ...EMPTY_CONTACT }])
  }

  const removeContactRow = (index: number) => {
    setContacts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const updateContact = (index: number, patch: Partial<InsuranceCompanyContactDraft>) => {
    setContacts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const handleSave = async () => {
    if (!canEdit || !token) {
      setStatusText('연락처 저장은 staff 또는 super_admin만 가능합니다.')
      return
    }
    if (!selectedType) {
      setStatusText('보험 종류를 선택하세요.')
      return
    }
    if (!selectedCompanyName.trim()) {
      setStatusText('보험사를 선택하세요.')
      return
    }

    setIsSaving(true)
    setStatusText('')
    try {
      const body = {
        company: {
          ...(company.id != null ? { id: company.id } : {}),
          category: selectedType,
          name: selectedCompanyName.trim(),
          customerCenter: company.customerCenter.trim(),
          systemPhone: company.systemPhone.trim(),
          incallNumber: company.incallNumber.trim(),
          visitInfo: company.visitInfo.trim(),
        },
        contacts,
      }
      await fullSaveCompanyDirectory(body, token)
      window.alert('저장했습니다.')
      await loadList()
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page company-registry-page registry-form-touch">
      <nav className="contacts-public-auth" aria-label="이동">
        <button className="button button--small" type="button" onClick={() => navigate(-1)}>
          뒤로
        </button>
        <Link className="button button--small contacts-public-auth__link" to="/insurance/contacts">
          연락처 조회
        </Link>
        <Link className="button button--small contacts-public-auth__link" to="/menu/reinsurer-contacts">
          원수사 연락처(별도)
        </Link>
        <Link className="button button--small contacts-public-auth__link" to="/insurance/general-request">
          일반화재 설계의뢰
        </Link>
        {isAuthenticated ? (
          <button className="button button--small" type="button" onClick={() => navigate('/dashboard')}>
            메뉴
          </button>
        ) : (
          <Link className="button button--small button--primary contacts-public-auth__link" to="/login">
            로그인
          </Link>
        )}
      </nav>

      <header className="page-header">
        <h1>연락처 입력/관리</h1>
        <p>
          {statusText ||
            '보험 종류·보험사를 선택한 뒤 공통 정보와 담당자를 저장합니다. 등록된 목록은 「연락처 조회」 탭 화면에서 확인하세요. 일반화재 설계의뢰는 별도 메뉴입니다.'}
        </p>
      </header>

      {canEdit ? (
        <section className="card company-registry-form-card">
          <h2 className="dashboard-section-title">입력 · 수정 (staff / super_admin)</h2>
          {company.id != null && selectedCompanyName ? (
            <div className="edit-banner" role="status">
              ✏ 수정 중입니다 — 저장 시 보험사·담당자 정보가 갱신됩니다.
            </div>
          ) : null}

          <label className="field">
            <span className="field__label">보험 종류 (필수)</span>
            <select
              className="field__control"
              value={selectedType}
              onChange={(e) => {
                const v = e.target.value as InsuranceCategory | ''
                setSelectedType(v)
                setSelectedCompanyName('')
              }}
              required
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
            <span className="field__label">보험사 선택 (필수)</span>
            <select
              className="field__control"
              value={selectedCompanyName}
              onChange={(e) => setSelectedCompanyName(String(e.target.value ?? ''))}
              disabled={!selectedType}
              required
            >
              <option value="">선택</option>
              {companyOptions.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          <h3 className="company-registry-subtitle">공통정보</h3>
          <div className="field-grid-customers">
            <label className="field">
              <span className="field__label">고객센터</span>
              {customerCenterMapHint ? (
                <div className="hint">
                  {getInsuranceCompanyDefaultTel(selectedType, selectedCompanyName)
                    ? '✔ 표준 번호 자동 입력됨 (수정 가능)'
                    : 'ℹ 표준 번호 없음 — 직접 입력해 주세요'}
                </div>
              ) : null}
              <input
                className="field__control"
                value={company.customerCenter}
                onChange={(e) => setCompany({ ...company, customerCenter: e.target.value })}
                placeholder="고객센터 번호 (자동입력 / 수정가능)"
                autoComplete="tel"
              />
            </label>
            <label className="field">
              <span className="field__label">전산문의</span>
              <input
                className="field__control"
                value={company.systemPhone}
                onChange={(e) => setCompany({ ...company, systemPhone: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">인콜번호</span>
              <input
                className="field__control"
                value={company.incallNumber}
                onChange={(e) => setCompany({ ...company, incallNumber: e.target.value })}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">방문일 / 카톡 / 기타</span>
              <input
                className="field__control"
                value={company.visitInfo}
                onChange={(e) => setCompany({ ...company, visitInfo: e.target.value })}
              />
            </label>
          </div>

          <h3 className="company-registry-subtitle">담당자</h3>
          <ul className="company-registry-contact-editor-list">
            {contacts.map((row, index) => (
              <li key={index} className="company-registry-contact-editor-row">
                <input
                  className="field__control"
                  placeholder="이름"
                  value={row.name}
                  onChange={(e) => updateContact(index, { name: e.target.value })}
                />
                <input
                  className="field__control"
                  placeholder="직책"
                  value={row.position}
                  onChange={(e) => updateContact(index, { position: e.target.value })}
                />
                <input
                  className="field__control"
                  placeholder="전화"
                  value={row.phone}
                  onChange={(e) => updateContact(index, { phone: e.target.value })}
                />
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => removeContactRow(index)}
                  disabled={contacts.length <= 1}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <button className="button button--secondary" type="button" onClick={addContactRow}>
            담당자 추가
          </button>

          <button
            className="button button--primary button--full"
            style={{ marginTop: 16 }}
            type="button"
            disabled={isSaving || !selectedType || !selectedCompanyName}
            onClick={() => void handleSave()}
          >
            {isSaving ? '저장 중…' : company.id != null ? '수정 저장' : '신규 저장'}
          </button>
        </section>
      ) : (
        <section className="card">
          <p className="empty-state">
            데이터 입력·수정은 <Link to="/login">로그인</Link> 후 staff / super_admin 권한이 필요합니다.{' '}
            <Link to="/insurance/contacts">연락처 조회</Link>는 로그인 없이도 볼 수 있습니다.{' '}
            <Link to="/insurance/general-request">일반화재 설계의뢰</Link> 저장도 같은 권한입니다.
          </p>
        </section>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <p className="empty-state" style={{ margin: 0 }}>
          <Link to="/insurance/contacts">→ 보험사 연락처 조회 (탭)</Link>
        </p>
      </section>
    </main>
  )
}
