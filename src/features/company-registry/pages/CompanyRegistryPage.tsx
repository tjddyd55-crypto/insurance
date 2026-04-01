import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { fullSaveCompanyDirectory, listCompanyDirectory } from '../api/companyRegistryApi'
import { insuranceCategoryLabel, normalizeInsuranceCategory } from '../domain/categoryUtils'
import type { InsuranceCategory } from '../domain/insuranceConstants'
import {
  getInsuranceCompanyDefaultTel,
  INSURANCE_COMPANIES_BY_TYPE,
  INSURANCE_TYPE_LABELS,
  INSURANCE_TYPE_ORDER,
} from '../domain/insuranceConstants'
import type { CompanyDirectoryEntry, InsuranceCompanyContactDraft, InsuranceCompanyFormState } from '../domain/types'
import { downloadContactVcard, toTelHref } from '../utils/contactActions'

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
  const { user, token, isAuthenticated } = useAuth()
  const canEdit = isAuthenticated && !!user && ['staff', 'super_admin'].includes(user.role)

  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  const [selectedType, setSelectedType] = useState<InsuranceCategory | ''>('')
  const [selectedCompanyName, setSelectedCompanyName] = useState('')

  const [company, setCompany] = useState<InsuranceCompanyFormState>({
    id: null,
    category: '',
    name: '',
    ...EMPTY_COMPANY_FIELDS,
  })
  const [contacts, setContacts] = useState<InsuranceCompanyContactDraft[]>([{ ...EMPTY_CONTACT }])
  const [isSaving, setIsSaving] = useState(false)

  const companyNameOptions = useMemo(() => {
    if (!selectedType) {
      return []
    }
    return INSURANCE_COMPANIES_BY_TYPE[selectedType] ?? []
  }, [selectedType])

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
    setIsLoading(true)
    try {
      const rows = await listCompanyDirectory()
      setList(rows)
      setStatusText('')
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selectedType || !selectedCompanyName) {
      setCompany({
        id: null,
        category: selectedType || '',
        name: '',
        ...EMPTY_COMPANY_FIELDS,
      })
      setContacts([{ ...EMPTY_CONTACT }])
      return
    }

    const entry = list.find(
      (e) =>
        normalizeInsuranceCategory(e.category) === selectedType && e.name === selectedCompanyName,
    )

    if (entry) {
      setCompany(entryToFormState(entry))
      setContacts(entryContactsToDrafts(entry))
      return
    }

    setCompany({
      id: null,
      category: selectedType,
      name: selectedCompanyName,
      ...EMPTY_COMPANY_FIELDS,
    })
    setContacts([{ ...EMPTY_CONTACT }])
  }, [list, selectedType, selectedCompanyName])

  const groupedForDisplay = useMemo(() => {
    const byType = new Map<InsuranceCategory, CompanyDirectoryEntry[]>()
    for (const t of INSURANCE_TYPE_ORDER) {
      byType.set(t, [])
    }
    const uncategorized: CompanyDirectoryEntry[] = []
    for (const row of list) {
      const t = normalizeInsuranceCategory(row.category) as InsuranceCategory | ''
      if (t && byType.has(t)) {
        byType.get(t)!.push(row)
      } else {
        uncategorized.push(row)
      }
    }
    const groups: Array<{ groupId: InsuranceCategory | 'uncategorized'; label: string; companies: CompanyDirectoryEntry[] }> =
      INSURANCE_TYPE_ORDER.map((type) => ({
        groupId: type,
        label: INSURANCE_TYPE_LABELS[type],
        companies: (byType.get(type) ?? [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      })).filter((g) => g.companies.length > 0)

    if (uncategorized.length > 0) {
      groups.push({
        groupId: 'uncategorized',
        label: '기타 (분류 미정)',
        companies: uncategorized.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      })
    }
    return groups
  }, [list])

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
    <main className="page company-registry-page">
      <nav className="contacts-public-auth" aria-label="이동">
        <button className="button button--small" type="button" onClick={() => navigate(-1)}>
          뒤로
        </button>
        <Link className="button button--small contacts-public-auth__link" to="/menu/reinsurer-contacts">
          원수사 연락처(구)
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
        <h1>보험사 연락처</h1>
        <p>
          {statusText ||
            '보험 종류·보험사를 선택한 뒤 공통 정보와 담당자를 입력합니다. 목록은 보험 종류별로 묶어 표시합니다. 일반화재 설계의뢰는 별도 메뉴에서 등록합니다.'}
        </p>
      </header>

      {canEdit ? (
        <section className="card company-registry-form-card">
          <h2 className="dashboard-section-title">입력 · 수정 (관리자)</h2>

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
              onChange={(e) => setSelectedCompanyName(e.target.value)}
              disabled={!selectedType}
              required
            >
              <option value="">선택</option>
              {companyNameOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <h3 className="company-registry-subtitle">공통정보</h3>
          <div className="field-grid-customers">
            <label className="field">
              <span className="field__label">고객센터</span>
              {customerCenterMapHint ? (
                <p className="company-registry-field-hint">{customerCenterMapHint}</p>
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
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </section>
      ) : (
        <section className="card">
          <p className="empty-state">
            데이터 입력·수정은 <Link to="/login">로그인</Link> 후 staff / super_admin 권한이 필요합니다.{' '}
            <Link to="/insurance/general-request">일반화재 설계의뢰</Link>도 같은 권한으로 저장할 수 있습니다.
          </p>
        </section>
      )}

      <section className="list-section company-registry-output" style={{ marginTop: 24 }}>
        <h2>보험사별 보기</h2>
        {isLoading ? (
          <p>불러오는 중…</p>
        ) : groupedForDisplay.length === 0 ? (
          <p className="empty-state">등록된 보험사가 없습니다.</p>
        ) : (
          <div className="company-registry-type-groups">
            {groupedForDisplay.map((group) => (
              <section key={group.groupId} className="company-registry-type-section">
                <h3 className="company-registry-type-heading">{group.label}</h3>
                <ul className="company-registry-company-list">
                  {group.companies.map((c) => (
                    <li key={c.id} className="company-registry-company-block card">
                      <h4 className="company-registry-company-title">{c.name}</h4>
                      <p className="company-registry-meta-line">{insuranceCategoryLabel(c.category)}</p>
                      <dl className="company-registry-dl company-registry-dl--read">
                        <div>
                          <dt>고객센터</dt>
                          <dd>{c.customerCenter || '—'}</dd>
                        </div>
                        <div>
                          <dt>전산문의</dt>
                          <dd>{c.systemPhone || '—'}</dd>
                        </div>
                        <div>
                          <dt>인콜번호</dt>
                          <dd>{c.incallNumber || '—'}</dd>
                        </div>
                        <div>
                          <dt>방문안내</dt>
                          <dd>{c.visitInfo || '—'}</dd>
                        </div>
                      </dl>
                      <div className="company-registry-contact-cards" aria-label="담당자">
                        {c.contacts?.length ? (
                          c.contacts.map((p, idx) => (
                            <div key={p.id != null ? p.id : `new-${c.id}-${idx}`} className="company-registry-contact-card">
                              <p className="company-registry-contact-card__position">{p.position || '—'}</p>
                              <p className="company-registry-contact-card__name">{p.name || '—'}</p>
                              <p className="company-registry-contact-card__phone">{p.phone || '—'}</p>
                              <div className="company-registry-contact-card__actions">
                                {p.phone?.trim() ? (
                                  <a
                                    className="button button--primary company-registry-tel-btn"
                                    href={toTelHref(p.phone)}
                                  >
                                    전화하기
                                  </a>
                                ) : null}
                                {p.phone?.trim() ? (
                                  <button
                                    className="button company-registry-vcf-btn"
                                    type="button"
                                    onClick={() =>
                                      downloadContactVcard({
                                        name: p.name,
                                        phone: p.phone,
                                        companyName: c.name,
                                        position: p.position,
                                      })
                                    }
                                  >
                                    연락처 저장
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="company-registry-muted">등록된 담당자 없음</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
