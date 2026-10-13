import { FormButton, FormInput } from '../../../components/form'
import { PageToolbar } from '../../../components/layout'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getInsuranceContacts } from '../../contacts/api/contactsApi'
import {
  buildPersonalContactsDirectoryView,
  filterDirectoryRowsForPersonalView,
} from '../../contacts/utils/personalContactsDirectoryView'
import { useAuth } from '../../auth/AuthProvider'
import { GaStaffOpsNav } from '../../auth/GaStaffOpsNav'
import '../../auth/ga-staff-ops-shell.css'
import { canMutateInsuranceDirectory, isInsuranceOpsRole } from '../../auth/roleGuards'
import { companyDirectoryRowMatchesSearchAlias } from '../domain/insuranceSearchAliases'
import { getCompanyRecentUpdates, listCompanyDirectory } from '../api/companyRegistryApi'
import {
  buildCompanyChangeSummaries,
  type CompanyDirectoryChangeSummary,
} from '../utils/companyDirectoryChanges'
import { resolveTabCategory } from '../domain/categoryUtils'
import {
  INSURANCE_TYPE_ORDER,
  isInsuranceCategory,
  type InsuranceCategory,
} from '../domain/insuranceConstants'
import { CompanyCard } from '../components/CompanyCard'
import type { CompanyDirectoryEntry } from '../domain/types'

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

export type InsuranceContactsOwnershipMode = 'ga' | 'personal'

type InsuranceCompanyContactsViewPageProps = {
  ownershipMode?: InsuranceContactsOwnershipMode
}

function categoryForCompanyRow(row: CompanyDirectoryEntry, fallbackTab: InsuranceCategory): InsuranceCategory {
  const n = resolveTabCategory(row.category, row.name)
  if (n && isInsuranceCategory(n)) {
    return n
  }
  return fallbackTab
}

export default function InsuranceCompanyContactsViewPage({
  ownershipMode = 'ga',
}: InsuranceCompanyContactsViewPageProps) {
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()
  const isPersonalMode = ownershipMode === 'personal'
  const isStaff = isAuthenticated && !!user && isInsuranceOpsRole(user.role)
  const isGaStaff = user?.role === 'GA_STAFF'
  const opsShellClass = isStaff ? ' admin-page-shell ga-staff-ops-page' : ''
  const canEditFromCard = isPersonalMode
    ? isAuthenticated && user?.role === 'USER'
    : !!user && canMutateInsuranceDirectory(user.role)

  const [activeTab, setActiveTab] = useState<InsuranceCategory>('LIFE')
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const [personalContacts, setPersonalContacts] = useState<Awaited<ReturnType<typeof getInsuranceContacts>>['contacts']>([])
  const [changeSummaries, setChangeSummaries] = useState<Map<string, CompanyDirectoryChangeSummary>>(
    () => new Map(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const copyNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showCopyFeedback = useCallback((message: string) => {
    if (copyNoticeTimerRef.current) {
      clearTimeout(copyNoticeTimerRef.current)
    }
    setCopyStatus(message)
    copyNoticeTimerRef.current = setTimeout(() => {
      setCopyStatus('')
      copyNoticeTimerRef.current = null
    }, 3000)
  }, [])

  useEffect(
    () => () => {
      if (copyNoticeTimerRef.current) {
        clearTimeout(copyNoticeTimerRef.current)
      }
    },
    [],
  )

  const loadList = useCallback(async () => {
    if (!token) {
      return
    }
    setIsLoading(true)
    try {
      // 연락처 목록과 최근 변경 이력을 함께 로드한다.
      // 이력 조회는 배지/강조용 부가 데이터이므로 실패해도 목록 표시는 막지 않는다.
      const [rows, history, personal] = await Promise.all([
        listCompanyDirectory(token),
        isPersonalMode ? Promise.resolve([]) : getCompanyRecentUpdates(token).catch(() => []),
        isPersonalMode ? getInsuranceContacts(token).catch(() => ({ contacts: [], lastUpdatedAt: '' })) : Promise.resolve(null),
      ])
      setList(rows)
      if (isPersonalMode && personal) {
        setPersonalContacts(personal.contacts)
      }
      setChangeSummaries(isPersonalMode ? new Map() : buildCompanyChangeSummaries(history))
      setErrorText('')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [isPersonalMode, token])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const directoryForTab = useMemo(() => {
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
    if (!isPersonalMode) {
      return byTab
    }
    return buildPersonalContactsDirectoryView(byTab, personalContacts, activeTab)
  }, [activeTab, isPersonalMode, list, personalContacts])

  const filteredList = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    const byTab = directoryForTab

    if (isPersonalMode) {
      return filterDirectoryRowsForPersonalView(byTab, keyword)
    }

    if (!q) {
      return byTab
    }
    return byTab.filter((c) => {
      if (c.name.toLowerCase().includes(q)) {
        return true
      }
      if (companyDirectoryRowMatchesSearchAlias(c.name, q)) {
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
  }, [activeTab, directoryForTab, isPersonalMode, keyword])

  const openCompanyRegistryEdit = (row: CompanyDirectoryEntry) => {
    const cat = categoryForCompanyRow(row, activeTab)
    navigate(
      `/insurance/company-registry?type=${encodeURIComponent(cat)}&code=${encodeURIComponent(row.companyCode)}`,
    )
  }

  return (
    <main
      className={`page page--with-back company-registry-page insurance-contacts-view company-directory-read-ui user-page${opsShellClass}`}
    >
      <div className={isStaff ? 'admin-page-shell__inner' : undefined}>
      {isGaStaff ? <GaStaffOpsNav /> : null}
      <nav className="contacts-public-auth contacts-public-auth--compact admin-toolbar" aria-label="이동">
        {isPersonalMode && isAuthenticated ? (
          <Link
            className="button button--small button--primary contacts-public-auth__link touch-nav-btn"
            to="/insurance/company-registry"
          >
            연락처 등록
          </Link>
        ) : null}
        {isStaff && !isGaStaff && !isPersonalMode ? (
          <Link
            className="button button--small contacts-public-auth__link touch-nav-btn"
            to="/insurance/company-registry"
          >
            관리
          </Link>
        ) : null}
        {!isAuthenticated ? (
          <Link className="button button--small button--primary contacts-public-auth__link touch-nav-btn" to="/login">
            로그인
          </Link>
        ) : null}
      </nav>

      <header className="page-header insurance-contacts-header contact-header">
        <div className="contact-header__row">
          <h1>원수사 연락처</h1>
        </div>
        {errorText ? (
          <p className="insurance-contacts-status insurance-contacts-status--error" role="alert">
            {errorText}
          </p>
        ) : null}
        {copyStatus ? (
          <p className="insurance-contacts-status" role="status" aria-live="polite">
            {copyStatus}
          </p>
        ) : null}
      </header>

      <div className="tabs" role="tablist" aria-label="보험 종류">
        {INSURANCE_TYPE_ORDER.map((tab) => (
          <FormButton
            key={tab}
            htmlType="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            title={TAB_TITLE[tab]}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_SHORT_LABEL[tab]}
          </FormButton>
        ))}
      </div>

      <PageToolbar
        search={
          <label className="insurance-contacts-search">
            <span className="visually-hidden">검색</span>
            <FormInput
              className="insurance-contacts-search__input user-form-control"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="보험사 또는 담당자 검색 (선택)"
              enterKeyHint="search"
            />
          </label>
        }
        actions={
          <>
            <FormButton className="button" htmlType="button" variant="action" onClick={() => navigate('/insurance/history')}>
              업데이트 현황
            </FormButton>
            <FormButton className="button" htmlType="button" variant="action" onClick={() => navigate('/insurance/print')}>
              출력
            </FormButton>
          </>
        }
      />

      <section className="insurance-contacts-list-wrap" aria-live="polite">
        {isLoading ? (
          <p className="insurance-contacts-loading">불러오는 중…</p>
        ) : filteredList.length === 0 ? (
          <div className="empty-box insurance-contacts-empty" role="status">
            {keyword.trim() ? (
              '검색 결과가 없습니다.'
            ) : isPersonalMode ? (
              <>
                📭 등록한 연락처가 없습니다.
                <br />
                상단 「연락처 등록」에서 보험회사를 선택해 추가하세요.
              </>
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
              <CompanyCard
                key={`${c.companyCode}:${c.id}`}
                variant="directory"
                entry={c}
                showEditButton={canEditFromCard}
                onEdit={openCompanyRegistryEdit}
                onCopyFeedback={showCopyFeedback}
                changeSummary={isPersonalMode ? undefined : changeSummaries.get(String(c.id))}
              />
            ))}
          </div>
        )}
      </section>
      </div>
    </main>
  )
}
