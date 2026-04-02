import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { fullSaveCompanyDirectory, listCompanyDirectory } from '../api/companyRegistryApi'
import { insuranceCategoryLabel, insuranceTypeSortRank, resolveTabCategory } from '../domain/categoryUtils'
import type { InsuranceCategory } from '../domain/insuranceConstants'
import {
  insuranceCompanyMap,
  INSURANCE_TYPE_LABELS,
  INSURANCE_TYPE_ORDER,
  isInsuranceCategory,
  type InsuranceCompanyOption,
} from '../domain/insuranceConstants'
import {
  EMPTY_CONTACT,
  findSavedEntryForSelection,
  formStateFromDirectoryEntry,
  loadCompanyData,
} from '../domain/loadCompanyData'
import type {
  CompanyDirectoryEntry,
  InsuranceCompanyContactDraft,
  InsuranceCompanyFormState,
} from '../domain/types'

const EMPTY_COMPANY_FIELDS: Omit<InsuranceCompanyFormState, 'id' | 'category' | 'name'> = {
  customerCenter: '',
  systemPhone: '',
  incallNumber: '',
  visitInfo: '',
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
  /** 목록만 갱신됐을 때 사용자가 이미 칸을 수정 중이면 폼을 덮어쓰지 않음 */
  const pendingLocalEditRef = useRef(false)

  const companyOptions = useMemo((): InsuranceCompanyOption[] => {
    if (!selectedType) {
      return []
    }
    const fromMap = insuranceCompanyMap[selectedType] ?? []
    const mapNames = new Set(fromMap.map((o) => o.name))
    const extras: InsuranceCompanyOption[] = []
    for (const e of list) {
      if (resolveTabCategory(e.category, e.name) !== selectedType) {
        continue
      }
      if (mapNames.has(e.name)) {
        continue
      }
      extras.push({ name: e.name, tel: e.customerCenter || '' })
    }
    extras.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return [...fromMap, ...extras]
  }, [selectedType, list])

  const sortedDirectoryList = useMemo(() => {
    return [...list].sort((a, b) => {
      const ra = resolveTabCategory(a.category, a.name)
      const rb = resolveTabCategory(b.category, b.name)
      const sa = insuranceTypeSortRank(ra || '')
      const sb = insuranceTypeSortRank(rb || '')
      if (sa !== sb) {
        return sa - sb
      }
      return a.name.localeCompare(b.name, 'ko')
    })
  }, [list])

  const prevSelectionRef = useRef<{ type: string; company: string }>({ type: '', company: '' })
  const prevListForSyncRef = useRef(list)

  /** 보험 종류·보험사 선택 — 목록 클릭·드롭다운 모두 이후 loadCompanyData 이펙트로 폼 동기화 */
  const commitDirectorySelection = useCallback((type: InsuranceCategory | '', companyName: string) => {
    pendingLocalEditRef.current = false
    setSelectedType(type)
    setSelectedCompanyName(companyName)
  }, [])

  const hasDirectoryEntryForSelection = useMemo(() => {
    if (!selectedType || !selectedCompanyName) {
      return false
    }
    return findSavedEntryForSelection(list, selectedType, selectedCompanyName) != null
  }, [list, selectedType, selectedCompanyName])

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
      commitDirectorySelection(t, name)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, commitDirectorySelection])

  useEffect(() => {
    if (typeof selectedCompanyName !== 'string') {
      return
    }

    const listIdentityChanged = prevListForSyncRef.current !== list
    prevListForSyncRef.current = list
    if (listIdentityChanged && pendingLocalEditRef.current) {
      return
    }

    const result = loadCompanyData(list, selectedType, selectedCompanyName, prevSelectionRef.current)
    if (!result) {
      return
    }

    prevSelectionRef.current = result.prevSelection
    if (result.syncForm) {
      pendingLocalEditRef.current = false
      setCompany(result.company)
      setContacts(result.contacts)
    } else {
      const name = selectedCompanyName.trim()
      const category = selectedType
      setCompany((prev) => {
        if (prev.name === name && prev.category === category) {
          return prev
        }
        return { ...prev, name, category }
      })
    }
  }, [list, selectedType, selectedCompanyName])

  /**
   * 등록 목록 클릭: 분류 확정 시에는 드롭다운과 같이 선택값만 바꾸고,
   * 폼/연락처 반영은 loadCompanyData 동기화 useEffect 한 경로에서 처리합니다.
   */
  const applyDirectoryEntry = useCallback((entry: CompanyDirectoryEntry) => {
    const nameTrim = entry.name.trim()
    const cat = resolveTabCategory(entry.category, entry.name)
    if (!cat || !isInsuranceCategory(cat)) {
      const { company: loaded, contacts: nextContacts } = formStateFromDirectoryEntry(entry)
      setStatusText(
        '보험 종류를 자동 인식하지 못했습니다. 아래에서「보험 종류」를 선택하면 같은 이름의 등록 데이터와 맞춰집니다.',
      )
      commitDirectorySelection('', nameTrim)
      prevSelectionRef.current = { type: '', company: nameTrim }
      setCompany({ ...loaded, name: nameTrim })
      setContacts(nextContacts)
      return
    }
    setStatusText('')
    commitDirectorySelection(cat, nameTrim)
  }, [commitDirectorySelection])

  const addContactRow = () => {
    pendingLocalEditRef.current = true
    setContacts((prev) => [...prev, { ...EMPTY_CONTACT }])
  }

  const removeContactRow = (index: number) => {
    pendingLocalEditRef.current = true
    setContacts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const updateContact = (index: number, patch: Partial<InsuranceCompanyContactDraft>) => {
    pendingLocalEditRef.current = true
    setContacts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const handleSave = async () => {
    if (!canEdit || !token) {
      setStatusText('연락처 저장은 staff 또는 super_admin만 가능합니다.')
      return
    }
    if (!isInsuranceCategory(company.category)) {
      setStatusText('보험 종류를 선택하세요.')
      return
    }
    if (!company.name.trim()) {
      setStatusText('보험사를 선택하세요.')
      return
    }

    setIsSaving(true)
    setStatusText('')
    try {
      const body = {
        company: {
          ...(company.id != null ? { id: company.id } : {}),
          category: company.category,
          name: company.name.trim(),
          customerCenter: company.customerCenter.trim(),
          systemPhone: company.systemPhone.trim(),
          incallNumber: company.incallNumber.trim(),
          visitInfo: company.visitInfo.trim(),
        },
        contacts,
      }
      await fullSaveCompanyDirectory(body, token)
      window.alert('저장했습니다.')
      pendingLocalEditRef.current = false
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
        <Link className="button button--small contacts-public-auth__link" to="/insurance/history">
          업데이트 현황
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
            '보험 종류·보험사를 선택하면 이미 저장된 동일 보험사 데이터가 있으면 자동으로 불러옵니다. 등록된 목록은 「연락처 조회」에서 확인할 수 있습니다.'}
        </p>
      </header>

      {canEdit ? (
        <section className="card company-registry-directory-card">
          <h2 className="dashboard-section-title">등록된 보험사</h2>
          <p className="company-registry-field-hint" style={{ marginTop: 0 }}>
            항목을 누르면 아래 폼에 불러옵니다. 바로 입력·저장할 수 있습니다.
          </p>
          {list.length === 0 ? (
            <p className="company-registry-muted">아직 등록된 보험사가 없습니다.</p>
          ) : (
            <ul className="company-registry-pick-list">
              {sortedDirectoryList.map((e) => {
                const tabCat = resolveTabCategory(e.category, e.name)
                const label = tabCat ? insuranceCategoryLabel(tabCat) : '분류 미정'
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="company-registry-pick-list__btn"
                      onClick={() => applyDirectoryEntry(e)}
                    >
                      <span className="company-registry-pick-list__badge">{label}</span>
                      <span className="company-registry-pick-list__name">{e.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      {canEdit ? (
        <section className="card company-registry-form-card" aria-busy={isSaving}>
          <h2 className="dashboard-section-title">입력 · 수정 (staff / super_admin)</h2>

          <label className="field">
            <span className="field__label">보험 종류 (필수)</span>
            <select
              className="field__control"
              value={selectedType}
              onChange={(e) => {
                const v = e.target.value as InsuranceCategory | ''
                commitDirectorySelection(v, '')
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
              onChange={(e) => {
                commitDirectorySelection(selectedType, String(e.target.value ?? ''))
              }}
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

          {hasDirectoryEntryForSelection ? (
            <p className="company-registry-field-hint" style={{ margin: '0 0 10px' }}>
              ✓ 저장된 동일 보험사 데이터를 불러왔습니다. 수정 후 저장하면 갱신됩니다.
            </p>
          ) : selectedType && selectedCompanyName.trim() ? (
            <p className="company-registry-field-hint" style={{ margin: '0 0 10px' }}>
              ℹ 등록된 데이터가 없습니다. 공통정보·담당자는 비어 있는 상태에서 입력할 수 있습니다.
            </p>
          ) : null}

          <h3 className="company-registry-subtitle">공통정보</h3>
          <div className="field-grid-customers">
            <label className="field">
              <span className="field__label">고객센터</span>
              <input
                className="field__control"
                value={company.customerCenter}
                onChange={(e) => {
                  pendingLocalEditRef.current = true
                  setCompany({ ...company, customerCenter: e.target.value })
                }}
                placeholder="고객센터 번호 (직접 입력)"
                autoComplete="tel"
              />
            </label>
            <label className="field">
              <span className="field__label">전산문의</span>
              <input
                className="field__control"
                value={company.systemPhone}
                onChange={(e) => {
                  pendingLocalEditRef.current = true
                  setCompany({ ...company, systemPhone: e.target.value })
                }}
              />
            </label>
            <label className="field">
              <span className="field__label">인콜번호</span>
              <input
                className="field__control"
                value={company.incallNumber}
                onChange={(e) => {
                  pendingLocalEditRef.current = true
                  setCompany({ ...company, incallNumber: e.target.value })
                }}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">방문일 / 카톡 / 기타</span>
              <input
                className="field__control"
                value={company.visitInfo}
                onChange={(e) => {
                  pendingLocalEditRef.current = true
                  setCompany({ ...company, visitInfo: e.target.value })
                }}
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
            <Link to="/insurance/contacts">연락처 조회</Link>는 로그인 없이도 볼 수 있습니다.
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
