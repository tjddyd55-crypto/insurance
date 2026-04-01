import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { fullSaveCompanyDirectory, listCompanyDirectory } from '../api/companyRegistryApi'
import type {
  CompanyDirectoryEntry,
  InsuranceCompanyContactDraft,
  InsuranceCompanyFormState,
  InsuranceGeneralDraft,
} from '../domain/types'

const EMPTY_COMPANY: InsuranceCompanyFormState = {
  id: null,
  category: '',
  name: '',
  customerCenter: '',
  systemPhone: '',
  incallNumber: '',
  visitInfo: '',
}

const EMPTY_CONTACT: InsuranceCompanyContactDraft = { name: '', position: '', phone: '' }

const EMPTY_GENERAL: InsuranceGeneralDraft = { description: '', phone: '', fax: '', email: '' }

function entryToFormState(entry: CompanyDirectoryEntry): InsuranceCompanyFormState {
  return {
    id: entry.id,
    category: entry.category,
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

function entryGeneralToDraft(entry: CompanyDirectoryEntry): InsuranceGeneralDraft {
  const g = entry.general
  if (!g) {
    return { ...EMPTY_GENERAL }
  }
  return {
    description: g.description ?? '',
    phone: g.phone ?? '',
    fax: g.fax ?? '',
    email: g.email ?? '',
  }
}

export default function CompanyRegistryPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const canEdit = isAuthenticated && !!user && ['staff', 'super_admin'].includes(user.role)

  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  const [company, setCompany] = useState<InsuranceCompanyFormState>({ ...EMPTY_COMPANY })
  const [contacts, setContacts] = useState<InsuranceCompanyContactDraft[]>([{ ...EMPTY_CONTACT }])
  const [general, setGeneral] = useState<InsuranceGeneralDraft>({ ...EMPTY_GENERAL })
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

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

  const applySelection = (value: string) => {
    setSelectedCompanyId(value)
    if (!value) {
      setCompany({ ...EMPTY_COMPANY })
      setContacts([{ ...EMPTY_CONTACT }])
      setGeneral({ ...EMPTY_GENERAL })
      return
    }
    const id = Number(value)
    const entry = list.find((x) => x.id === id)
    if (!entry) {
      return
    }
    setCompany(entryToFormState(entry))
    setContacts(entryContactsToDrafts(entry))
    setGeneral(entryGeneralToDraft(entry))
  }

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
    const name = company.name.trim()
    if (!name) {
      setStatusText('보험사명을 입력하세요.')
      return
    }

    setIsSaving(true)
    setStatusText('')
    try {
      const body = {
        company: {
          ...(company.id != null ? { id: company.id } : {}),
          category: company.category.trim(),
          name,
          customerCenter: company.customerCenter.trim(),
          systemPhone: company.systemPhone.trim(),
          incallNumber: company.incallNumber.trim(),
          visitInfo: company.visitInfo.trim(),
        },
        contacts,
        general,
      }
      await fullSaveCompanyDirectory(body, token)
      window.alert('저장했습니다.')
      await loadList()
      setSelectedCompanyId('')
      setCompany({ ...EMPTY_COMPANY })
      setContacts([{ ...EMPTY_CONTACT }])
      setGeneral({ ...EMPTY_GENERAL })
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
        <h1>보험사 연락처 (마스터)</h1>
        <p>
          {statusText ||
            '보험사 공통정보 · 담당자(복수) · 일반화재 설계의뢰를 한 묶음으로 관리합니다. 목록은 누구나 조회할 수 있습니다.'}
        </p>
      </header>

      {canEdit ? (
        <section className="card company-registry-form-card">
          <h2 className="dashboard-section-title">입력 · 수정 (관리자)</h2>

          <label className="field">
            <span className="field__label">보험사 선택</span>
            <select
              className="field__control"
              value={selectedCompanyId}
              onChange={(e) => applySelection(e.target.value)}
            >
              <option value="">신규 보험사</option>
              {list.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  [{c.category || '미분류'}] {c.name}
                </option>
              ))}
            </select>
          </label>

          <h3 className="company-registry-subtitle">공통정보</h3>
          <div className="field-grid-customers">
            <label className="field">
              <span className="field__label">구분 (생명/손해 등)</span>
              <input
                className="field__control"
                value={company.category}
                onChange={(e) => setCompany({ ...company, category: e.target.value })}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">보험사명</span>
              <input
                className="field__control"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">고객센터</span>
              <input
                className="field__control"
                value={company.customerCenter}
                onChange={(e) => setCompany({ ...company, customerCenter: e.target.value })}
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
              <span className="field__label">방문일 / 카톡 / 요일 (자유 입력)</span>
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

          <h3 className="company-registry-subtitle">일반화재 설계의뢰 (선택)</h3>
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
            style={{ marginTop: 16 }}
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? '저장 중…' : '통합 저장'}
          </button>
        </section>
      ) : (
        <section className="card">
          <p className="empty-state">
            데이터 입력·수정은 <Link to="/login">로그인</Link> 후 staff / super_admin 권한이 필요합니다.
          </p>
        </section>
      )}

      <section className="list-section company-registry-output" style={{ marginTop: 24 }}>
        <h2>보험사별 보기</h2>
        {isLoading ? (
          <p>불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="empty-state">등록된 보험사가 없습니다.</p>
        ) : (
          <ul className="company-registry-company-list">
            {list.map((c) => (
              <li key={c.id} className="company-registry-company-block card">
                <h3 className="company-registry-company-title">
                  [{c.category || '—'}] {c.name}
                </h3>
                <dl className="company-registry-dl">
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
                    <dt>방문일</dt>
                    <dd>{c.visitInfo || '—'}</dd>
                  </div>
                </dl>

                {c.contacts?.length ? (
                  <ul className="company-registry-contact-display">
                    {c.contacts.map((p) => (
                      <li key={p.id}>
                        {p.position ? `${p.position} ` : ''}
                        {p.name}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="company-registry-muted">등록된 담당자 없음</p>
                )}

                <div className="company-registry-general-box">
                  <h4>일반화재</h4>
                  {c.general &&
                  (c.general.description ||
                    c.general.phone ||
                    c.general.fax ||
                    c.general.email) ? (
                    <dl className="company-registry-dl">
                      <div>
                        <dt>설명</dt>
                        <dd>{c.general.description || '—'}</dd>
                      </div>
                      <div>
                        <dt>전화</dt>
                        <dd>{c.general.phone || '—'}</dd>
                      </div>
                      <div>
                        <dt>팩스</dt>
                        <dd>{c.general.fax || '—'}</dd>
                      </div>
                      <div>
                        <dt>이메일</dt>
                        <dd>{c.general.email || '—'}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="company-registry-muted">미등록</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
