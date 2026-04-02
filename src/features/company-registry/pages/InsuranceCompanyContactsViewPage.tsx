import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ConfirmModal from '../../../components/common/ConfirmModal'
import { useAuth } from '../../auth/AuthProvider'
import { listCompanyDirectory } from '../api/companyRegistryApi'
import { normalizeInsuranceCategory } from '../domain/categoryUtils'
import {
  INSURANCE_TYPE_ORDER,
  isInsuranceCategory,
  type InsuranceCategory,
} from '../domain/insuranceConstants'
import { formatPhone } from '../../contacts/utils/phone'
import type { CompanyDirectoryEntry } from '../domain/types'
import { copyToClipboard } from '../utils/clipboard'
import { openCompanyContactVcard, toTelHref } from '../utils/contactActions'

type PendingContactAction = {
  name: string
  phone: string
  companyName: string
  position?: string
}

const TAB_SHORT_LABEL: Record<InsuranceCategory, string> = {
  LIFE: '생명',
  NON_LIFE: '손해',
  GENERAL: '일반',
}

const TAB_TITLE: Record<InsuranceCategory, string> = {
  LIFE: '생명보험',
  NON_LIFE: '손해보험',
  GENERAL: '일반보험',
}

function categoryForCompanyRow(row: CompanyDirectoryEntry, fallbackTab: InsuranceCategory): InsuranceCategory {
  const n = normalizeInsuranceCategory(row.category)
  if (n && isInsuranceCategory(n)) {
    return n
  }
  return fallbackTab
}

export default function InsuranceCompanyContactsViewPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const isStaff = isAuthenticated && !!user && ['staff', 'super_admin'].includes(user.role)

  const [activeTab, setActiveTab] = useState<InsuranceCategory>('LIFE')
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusText, setStatusText] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'call' | 'save' | null>(null)
  const [pendingContact, setPendingContact] = useState<PendingContactAction | null>(null)

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

  const filteredList = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    const byTab = list
      .filter((item) => normalizeInsuranceCategory(item.category) === activeTab)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

    if (!q) {
      return byTab
    }
    return byTab.filter((c) => {
      if (c.name.toLowerCase().includes(q)) {
        return true
      }
      if (
        (c.customerCenter && c.customerCenter.toLowerCase().includes(q)) ||
        (c.systemPhone && c.systemPhone.includes(q)) ||
        (c.incallNumber && c.incallNumber.includes(q))
      ) {
        return true
      }
      return (
        c.contacts?.some(
          (p) =>
            (p.name ?? '').toLowerCase().includes(q) ||
            (p.position ?? '').toLowerCase().includes(q) ||
            (p.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')),
        ) ?? false
      )
    })
  }, [list, activeTab, keyword])

  const openCompanyRegistryEdit = (row: CompanyDirectoryEntry) => {
    const cat = categoryForCompanyRow(row, activeTab)
    navigate(
      `/insurance/company-registry?type=${encodeURIComponent(cat)}&company=${encodeURIComponent(row.name)}`,
    )
  }

  const copy = (text: string) => {
    copyToClipboard(text)
  }

  const closeConfirmModal = useCallback(() => {
    setModalOpen(false)
    setModalType(null)
    setPendingContact(null)
  }, [])

  const openCallConfirm = (ctx: PendingContactAction) => {
    setPendingContact(ctx)
    setModalType('call')
    setModalOpen(true)
  }

  const openSaveConfirm = (ctx: PendingContactAction) => {
    setPendingContact(ctx)
    setModalType('save')
    setModalOpen(true)
  }

  const confirmModalAction = () => {
    if (!pendingContact || !modalType) {
      closeConfirmModal()
      return
    }
    const ctx = pendingContact
    const type = modalType
    navigator.vibrate?.(50)
    if (type === 'call') {
      window.location.href = toTelHref(ctx.phone)
    } else {
      openCompanyContactVcard({
        name: ctx.name,
        phone: ctx.phone,
        companyName: ctx.companyName,
        position: ctx.position,
      })
    }
    closeConfirmModal()
  }

  const saveMetaLine = [pendingContact?.companyName, pendingContact?.position?.trim()].filter(Boolean).join(' · ')

  const modalMessage =
    pendingContact && modalType === 'save' ? (
      <p className="modal-body-text">
        <strong>{pendingContact.name}</strong>
        {saveMetaLine ? (
          <>
            <br />
            <span className="modal-meta">{saveMetaLine}</span>
          </>
        ) : null}
        <br />
        <span className="modal-phone-emphasis">{formatPhone(pendingContact.phone)}</span>
        <br />
        연락처를 저장하시겠습니까?
      </p>
    ) : pendingContact ? (
      <p className="modal-body-text">
        <strong>{pendingContact.name}</strong>
        <br />
        <span className="modal-phone-emphasis">{formatPhone(pendingContact.phone)}</span>
        <br />
        전화를 거시겠습니까?
      </p>
    ) : null

  return (
    <main className="page company-registry-page insurance-contacts-view">
      <nav className="contacts-public-auth contacts-public-auth--compact" aria-label="이동">
        <button className="button button--small touch-nav-btn" type="button" onClick={() => navigate(-1)}>
          뒤로
        </button>
        <Link
          className="button button--small contacts-public-auth__link touch-nav-btn"
          to="/insurance/company-registry"
        >
          관리
        </Link>
        {isAuthenticated ? (
          <button className="button button--small touch-nav-btn" type="button" onClick={() => navigate('/dashboard')}>
            메뉴
          </button>
        ) : (
          <Link className="button button--small button--primary contacts-public-auth__link touch-nav-btn" to="/login">
            로그인
          </Link>
        )}
      </nav>

      <header className="page-header insurance-contacts-header">
        <h1>보험사 연락처</h1>
        {statusText ? <p className="insurance-contacts-status">{statusText}</p> : null}
      </header>

      <div className="tabs" role="tablist" aria-label="보험 종류">
        {INSURANCE_TYPE_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            title={TAB_TITLE[tab]}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_SHORT_LABEL[tab]}
          </button>
        ))}
      </div>

      <label className="insurance-contacts-search">
        <span className="visually-hidden">검색</span>
        <input
          className="insurance-contacts-search__input"
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="보험사 또는 담당자 검색 (선택)"
          enterKeyHint="search"
        />
      </label>

      <section className="insurance-contacts-list-wrap" aria-live="polite">
        {isLoading ? (
          <p className="insurance-contacts-loading">불러오는 중…</p>
        ) : filteredList.length === 0 ? (
          <div className="empty-box insurance-contacts-empty" role="status">
            {keyword.trim() ? (
              '검색 결과가 없습니다.'
            ) : (
              <>
                📭 이 분류에 등록된 보험사가 없습니다.
                <br />
                담당자에게 등록 요청하세요
              </>
            )}
          </div>
        ) : (
          <div className="insurance-contacts-cards">
            {filteredList.map((c) => (
              <article key={c.id} className="company-card">
                <h3 className="company-card__title">{c.name}</h3>

                <div className="company-info info">
                  <div className="company-info__row">
                    <div>
                      <span className="info__label">고객센터</span>{' '}
                      <span className="info__value">{c.customerCenter?.trim() || '—'}</span>
                      {c.customerCenter?.trim() ? (
                        <div className="actions-mini">
                          <a href={toTelHref(c.customerCenter)} aria-label="고객센터 전화">
                            📞
                          </a>
                          <button type="button" onClick={() => copy(c.customerCenter)} aria-label="고객센터 번호 복사">
                            📋
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="company-info__row">
                    <div>
                      <span className="info__label">전산문의</span>{' '}
                      <span className="info__value">{c.systemPhone?.trim() || '—'}</span>
                      {c.systemPhone?.trim() ? (
                        <div className="actions-mini">
                          <a href={toTelHref(c.systemPhone)} aria-label="전산문의 전화">
                            📞
                          </a>
                          <button type="button" onClick={() => copy(c.systemPhone)} aria-label="전산문의 번호 복사">
                            📋
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="company-info__row">
                    <div>
                      <span className="info__label">인콜</span>{' '}
                      <span className="info__value">{c.incallNumber?.trim() || '—'}</span>
                      {c.incallNumber?.trim() ? (
                        <div className="actions-mini">
                          <button type="button" onClick={() => copy(c.incallNumber)} aria-label="인콜 번호 복사">
                            📋 복사
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {c.visitInfo?.trim() ? (
                    <div className="company-info__row">
                      <span className="info__label">방문·기타</span>{' '}
                      <span className="info__value">{c.visitInfo}</span>
                    </div>
                  ) : null}
                </div>

                {c.contacts?.length ? (
                  c.contacts.map((p, idx) => (
                    <div key={p.id != null ? p.id : `new-${c.id}-${idx}`} className="contact-card">
                      <div className="position">{p.position?.trim() || '—'}</div>
                      <div className="name">{p.name?.trim() || '—'}</div>
                      {p.phone?.trim() ? (
                        <button
                          type="button"
                          className="phone phone-link"
                          aria-label={`${formatPhone(p.phone)} 전화 걸기`}
                          onClick={() =>
                            openCallConfirm({
                              name: p.name?.trim() || '담당자',
                              phone: p.phone,
                              companyName: c.name,
                              position: p.position,
                            })
                          }
                        >
                          {formatPhone(p.phone)}
                        </button>
                      ) : (
                        <div className="phone phone--muted">—</div>
                      )}

                      <div className="actions">
                        {p.phone?.trim() ? (
                          <button
                            type="button"
                            className="tel-action call-btn"
                            aria-label={`${p.name ?? '담당자'}에게 전화`}
                            onClick={() =>
                              openCallConfirm({
                                name: p.name?.trim() || '담당자',
                                phone: p.phone,
                                companyName: c.name,
                                position: p.position,
                              })
                            }
                          >
                            📞 전화
                          </button>
                        ) : (
                          <span className="actions__spacer" />
                        )}
                        {p.phone?.trim() ? (
                          <button
                            type="button"
                            className="btn-secondary save-btn"
                            onClick={() =>
                              openSaveConfirm({
                                name: p.name?.trim() || '담당자',
                                phone: p.phone,
                                companyName: c.name,
                                position: p.position,
                              })
                            }
                          >
                            💾 저장
                          </button>
                        ) : null}
                        {isStaff ? (
                          <button
                            type="button"
                            className="btn-secondary save-btn"
                            onClick={() => openCompanyRegistryEdit(c)}
                          >
                            ✏ 수정
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="contact-card contact-card--empty">
                    <div className="empty-box contact-card--empty-msg" role="status">
                      📭 등록된 담당자가 없습니다
                      <br />
                      담당자에게 등록 요청하세요
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="insurance-contacts-footer-links">
        <Link to="/insurance/history">업데이트 현황</Link>
      </footer>

      <ConfirmModal
        open={modalOpen}
        title={modalType === 'save' ? '연락처 저장' : '전화'}
        message={modalMessage}
        onCancel={closeConfirmModal}
        onConfirm={confirmModalAction}
      />
    </main>
  )
}
