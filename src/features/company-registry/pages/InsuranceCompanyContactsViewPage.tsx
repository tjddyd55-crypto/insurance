import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { listCompanyDirectory } from '../api/companyRegistryApi'
import { resolveTabCategory } from '../domain/categoryUtils'
import {
  INSURANCE_TYPE_ORDER,
  isInsuranceCategory,
  type InsuranceCategory,
} from '../domain/insuranceConstants'
import { cleanPhone, formatPhone } from '../../contacts/utils/phone'
import type { CompanyDirectoryEntry } from '../domain/types'
import { copyToClipboard } from '../utils/clipboard'

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
  const n = resolveTabCategory(row.category, row.name)
  if (n && isInsuranceCategory(n)) {
    return n
  }
  return fallbackTab
}

function telHref(raw: string): string {
  const d = cleanPhone(raw)
  return d ? `tel:${d}` : '#'
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
      .filter((item) => {
        const tab = resolveTabCategory(item.category, item.name)
        if (tab) {
          return tab === activeTab
        }
        // DB 분류 없음·맵에도 없음 → 생명 탭에만 표시(누락 방지). 관리 화면에서 종류 지정 권장.
        return activeTab === 'LIFE'
      })
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

  return (
    <main className="page company-registry-page insurance-contacts-view company-directory-read-ui">
      <nav className="contacts-public-auth contacts-public-auth--compact" aria-label="이동">
        <button className="button button--small touch-nav-btn" type="button" onClick={() => navigate(-1)}>
          뒤로
        </button>
        {isStaff ? (
          <Link
            className="button button--small contacts-public-auth__link touch-nav-btn"
            to="/insurance/company-registry"
          >
            관리
          </Link>
        ) : null}
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

      <header className="page-header insurance-contacts-header contact-header">
        <div className="contact-header__row">
          <h1>원수사 연락처</h1>
          {!isStaff ? (
            <button
              type="button"
              className="update-btn"
              onClick={() => navigate('/updates')}
            >
              업데이트 현황
            </button>
          ) : null}
        </div>
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
            {filteredList.map((c) => {
              const customerCenter = c.customerCenter?.trim() ?? ''
              const systemPhone = c.systemPhone?.trim() ?? ''
              const incallNumber = c.incallNumber?.trim() ?? ''
              const visitInfo = c.visitInfo?.trim() ?? ''

              return (
                <article key={c.id} className="company-card">
                  <div className="company-card__header">
                    <h3 className="company-card__title">{c.name}</h3>
                    {isStaff ? (
                      <button
                        type="button"
                        className="button button--small company-card__edit"
                        onClick={() => openCompanyRegistryEdit(c)}
                      >
                        수정
                      </button>
                    ) : null}
                  </div>

                  <div className="company-info-block">
                    <div className="info-row">
                      <span className="label">고객센터</span>
                      <span className="value">{customerCenter ? formatPhone(customerCenter) : '—'}</span>
                      <div className="info-row-actions">
                        {customerCenter ? (
                          <div className="actions-mini">
                            <a href={telHref(customerCenter)} aria-label="고객센터 전화">
                              📞
                            </a>
                            <button type="button" onClick={() => copy(customerCenter)} aria-label="고객센터 번호 복사">
                              📋
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="info-row">
                      <span className="label">전산문의</span>
                      <span className="value">{systemPhone ? formatPhone(systemPhone) : '—'}</span>
                      <div className="info-row-actions">
                        {systemPhone ? (
                          <div className="actions-mini">
                            <a href={telHref(systemPhone)} aria-label="전산문의 전화">
                              📞
                            </a>
                            <button type="button" onClick={() => copy(systemPhone)} aria-label="전산문의 번호 복사">
                              📋
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="info-row">
                      <span className="label">인콜</span>
                      <span className="value">{incallNumber ? formatPhone(incallNumber) : '—'}</span>
                      <div className="info-row-actions">
                        {incallNumber ? (
                          <div className="actions-mini">
                            <button type="button" onClick={() => copy(incallNumber)} aria-label="인콜 번호 복사">
                              📋
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {visitInfo ? (
                      <div className="info-row">
                        <span className="label">방문일</span>
                        <span className="value">{visitInfo}</span>
                        <div className="info-row-actions" aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>

                  {c.contacts?.length ? (
                    <div className="company-contacts-block">
                      {c.contacts.map((p, idx) => {
                        const name = p.name?.trim() ?? ''
                        const position = p.position?.trim() ?? ''
                        const phoneRaw = p.phone?.trim() ?? ''

                        return (
                          <div key={p.id != null ? p.id : `new-${c.id}-${idx}`} className="contact-row">
                            <div className="position">{position || '—'}</div>
                            <div className="name">{name || '—'}</div>
                            <div className={phoneRaw ? 'phone' : 'phone phone--empty'}>
                              {phoneRaw ? formatPhone(phoneRaw) : '—'}
                            </div>
                            <div className="actions actions-mini">
                              {phoneRaw ? (
                                <a href={telHref(phoneRaw)} aria-label={`${formatPhone(phoneRaw)} 전화`}>
                                  📞
                                </a>
                              ) : null}
                              {phoneRaw ? (
                                <button type="button" onClick={() => copy(phoneRaw)} aria-label="담당자 번호 복사">
                                  📋
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="contact-card--empty">
                      <div className="empty-box contact-card--empty-msg" role="status">
                        📭 등록된 담당자가 없습니다
                        <br />
                        담당자에게 등록 요청하세요
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <footer className="insurance-contacts-footer-links">
        <Link to="/insurance/history">업데이트 현황</Link>
      </footer>
    </main>
  )
}
