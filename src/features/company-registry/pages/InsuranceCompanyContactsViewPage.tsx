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
import { CompanyContactEditableCard } from '../components/CompanyContactEditableCard'
import type { CompanyDirectoryEntry } from '../domain/types'
import { fetchActiveInsurerSites, type InsurerSite } from '../../insurer-sites/api/insurerSitesApi'
import { filterInsurerCatalogForCategory } from '../domain/insuranceCompanyCatalogOptions'
import { groupCompanyDirectoryEntriesByMasterId } from '../utils/companyDirectoryViewGrouping'
import {
  directoryEntryToCardDraft,
  filterVisibleEditDrafts,
  prunePinnedEditCardKeys,
  findDuplicateCard,
  emptyContactRow,
  newCardKey,
  personalContactsToCardDrafts,
  type ContactCompanyCardDraft,
} from '../domain/contactCardWorkspaceModel'
import {
  applySuccessfulCardSaves,
  formatSaveResultsMessage,
  saveContactCardWorkspace,
} from '../utils/saveContactCardWorkspace'

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

function cloneDrafts(cards: ContactCompanyCardDraft[]): ContactCompanyCardDraft[] {
  return JSON.parse(JSON.stringify(cards)) as ContactCompanyCardDraft[]
}

function buildInitialCardDrafts(
  isPersonalMode: boolean,
  list: CompanyDirectoryEntry[],
  personalContacts: Awaited<ReturnType<typeof getInsuranceContacts>>['contacts'],
): ContactCompanyCardDraft[] {
  if (isPersonalMode) {
    return INSURANCE_TYPE_ORDER.flatMap((tab) => personalContactsToCardDrafts(personalContacts, tab))
  }
  return list.map((entry) => directoryEntryToCardDraft(entry))
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
  const canManageCards = isPersonalMode
    ? isAuthenticated && user?.role === 'USER'
    : !!user && canMutateInsuranceDirectory(user.role)

  const [activeTab, setActiveTab] = useState<InsuranceCategory>('LIFE')
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<CompanyDirectoryEntry[]>([])
  const directoryList = useMemo(() => groupCompanyDirectoryEntriesByMasterId(list), [list])
  const [personalContacts, setPersonalContacts] = useState<Awaited<ReturnType<typeof getInsuranceContacts>>['contacts']>([])
  const [changeSummaries, setChangeSummaries] = useState<Map<string, CompanyDirectoryChangeSummary>>(
    () => new Map(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [workspaceEdit, setWorkspaceEdit] = useState(false)
  const [cardDrafts, setCardDrafts] = useState<ContactCompanyCardDraft[]>([])
  const [baselineDrafts, setBaselineDrafts] = useState<ContactCompanyCardDraft[]>([])
  const [saveBusy, setSaveBusy] = useState(false)
  const [insurerCatalog, setInsurerCatalog] = useState<InsurerSite[]>([])
  const [insurerCatalogError, setInsurerCatalogError] = useState('')
  const [insurerCatalogLoading, setInsurerCatalogLoading] = useState(false)
  const [pinnedEditCardKeys, setPinnedEditCardKeys] = useState<Set<string>>(() => new Set())
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

  const loadInsurerCatalog = useCallback(async () => {
    if (!token || !canManageCards) {
      setInsurerCatalog([])
      setInsurerCatalogError('')
      return
    }
    setInsurerCatalogLoading(true)
    try {
      const response = await fetchActiveInsurerSites(token)
      const items = Array.isArray(response.items) ? response.items : []
      if (items.length === 0) {
        setInsurerCatalog([])
        setInsurerCatalogError('보험회사 카탈로그를 불러오지 못했습니다. 잠시 후 다시 시도하세요.')
        return
      }
      setInsurerCatalog(items)
      setInsurerCatalogError('')
    } catch (error) {
      setInsurerCatalog([])
      setInsurerCatalogError(
        error instanceof Error ? error.message : '보험회사 카탈로그를 불러오지 못했습니다.',
      )
    } finally {
      setInsurerCatalogLoading(false)
    }
  }, [canManageCards, token])

  useEffect(() => {
    void loadInsurerCatalog()
  }, [loadInsurerCatalog])

  const directoryForTab = useMemo(() => {
    const byTab = directoryList
      .filter((item) => {
        const tab = resolveTabCategory(item.category, item.name)
        if (tab) {
          return tab === activeTab
        }
        return activeTab === 'LIFE'
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    if (!isPersonalMode) {
      return byTab
    }
    return buildPersonalContactsDirectoryView(byTab, personalContacts, activeTab)
  }, [activeTab, isPersonalMode, directoryList, personalContacts])

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
  }, [directoryForTab, isPersonalMode, keyword])

  const visibleEditDrafts = useMemo(() => {
    return filterVisibleEditDrafts(cardDrafts, activeTab, keyword, pinnedEditCardKeys)
  }, [activeTab, cardDrafts, keyword, pinnedEditCardKeys])

  useEffect(() => {
    if (!workspaceEdit) {
      return
    }
    setPinnedEditCardKeys((prev) => prunePinnedEditCardKeys(prev, cardDrafts, activeTab))
  }, [activeTab, cardDrafts, workspaceEdit])

  const catalogRequiredForTab = activeTab === 'LIFE' || activeTab === 'NON_LIFE'
  const catalogUnavailable =
    workspaceEdit &&
    catalogRequiredForTab &&
    !insurerCatalogLoading &&
    (insurerCatalogError !== '' || filterInsurerCatalogForCategory(insurerCatalog, activeTab).length === 0)

  const enterWorkspaceEdit = () => {
    const initial = buildInitialCardDrafts(isPersonalMode, directoryList, personalContacts)
    setBaselineDrafts(cloneDrafts(initial))
    setCardDrafts(cloneDrafts(initial))
    setPinnedEditCardKeys(new Set())
    setWorkspaceEdit(true)
    setErrorText('')
  }

  const cancelWorkspaceEdit = () => {
    setCardDrafts(cloneDrafts(baselineDrafts))
    setPinnedEditCardKeys(new Set())
    setWorkspaceEdit(false)
    setErrorText('')
  }

  const addCompanyCard = () => {
    const entry = directoryList.find(
      (row) => resolveTabCategory(row.category, row.name) === activeTab,
    )
    const cardKey = newCardKey()
    setPinnedEditCardKeys((prev) => new Set(prev).add(cardKey))
    setCardDrafts((rows) => [
      ...rows,
      {
        cardKey,
        category: activeTab,
        companyCode: '',
        companyId: null,
        companyName: '',
        customerCenter: entry?.customerCenter ?? '',
        systemPhone: entry?.systemPhone ?? '',
        incallNumber: entry?.incallNumber ?? '',
        visitInfo: entry?.visitInfo ?? '',
        contacts: [emptyContactRow()],
        isNew: true,
        markedForDeletion: false,
      },
    ])
  }

  const updateDraft = (cardKey: string, next: ContactCompanyCardDraft) => {
    if (next.isNew && next.companyCode.trim()) {
      const duplicate = findDuplicateCard(
        cardDrafts,
        next.category,
        next.companyCode,
        cardKey,
        next.companyName,
      )
      if (duplicate) {
        setErrorText(`「${duplicate.companyName}」 카드가 이미 있습니다. 해당 카드에서 담당자를 추가하세요.`)
        return
      }
    }
    const prev = cardDrafts.find((row) => row.cardKey === cardKey)
    if (prev && prev.category !== next.category) {
      setPinnedEditCardKeys((keys) => new Set(keys).add(cardKey))
    }
    setCardDrafts((rows) => rows.map((row) => (row.cardKey === cardKey ? next : row)))
    setErrorText('')
  }

  const markCardRemoved = (cardKey: string) => {
    setPinnedEditCardKeys((prev) => {
      const next = new Set(prev)
      next.delete(cardKey)
      return next
    })
    setCardDrafts((rows) =>
      rows.map((row) => {
        if (row.cardKey !== cardKey) return row
        if (row.isNew) return null
        return { ...row, markedForDeletion: true }
      }).filter((row): row is ContactCompanyCardDraft => row != null),
    )
  }

  const saveWorkspace = async () => {
    if (!token || !canManageCards) return
    setSaveBusy(true)
    setErrorText('')
    try {
      const results = await saveContactCardWorkspace({
        token,
        mode: isPersonalMode ? 'personal' : 'ga',
        drafts: cardDrafts,
        baseline: baselineDrafts,
        personalContacts,
      })
      const message = formatSaveResultsMessage(results)
      const failed = results.some((row) => !row.ok)
      if (results.length === 0) {
        showCopyFeedback(message)
        setPinnedEditCardKeys(new Set())
        setWorkspaceEdit(false)
        await loadList()
        return
      }
      if (failed) {
        setErrorText(message)
        const merged = applySuccessfulCardSaves(baselineDrafts, cardDrafts, results)
        setBaselineDrafts(merged.baseline)
        setCardDrafts(merged.drafts)
        if (results.some((row) => row.ok)) {
          await loadList()
        }
      } else {
        setCopyStatus(message)
        setPinnedEditCardKeys(new Set())
        setWorkspaceEdit(false)
        await loadList()
      }
    } catch (reason) {
      setErrorText(reason instanceof Error ? reason.message : '저장에 실패했습니다.')
    } finally {
      setSaveBusy(false)
    }
  }

  const showEmpty = !isLoading && (workspaceEdit ? visibleEditDrafts.length === 0 : filteredList.length === 0)

  return (
    <main
      className={`page page--with-back company-registry-page insurance-contacts-view company-directory-read-ui user-page${opsShellClass}${workspaceEdit ? ' insurance-contacts-view--editing' : ''}`}
    >
      <div className={isStaff ? 'admin-page-shell__inner' : undefined}>
      {isGaStaff ? <GaStaffOpsNav /> : null}
      <nav className="contacts-public-auth contacts-public-auth--compact admin-toolbar" aria-label="이동">
        {isStaff && !isGaStaff && !isPersonalMode && !workspaceEdit ? (
          <Link
            className="button button--small contacts-public-auth__link touch-nav-btn"
            to="/insurance/company-registry"
          >
            관리 (전체 폼)
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
          {canManageCards && !workspaceEdit ? (
            <FormButton variant="primary" size="sm" onClick={enterWorkspaceEdit}>
              편집
            </FormButton>
          ) : null}
          {workspaceEdit ? (
            <div className="insurance-contacts-workspace-actions">
              <FormButton variant="secondary" size="sm" disabled={saveBusy} onClick={cancelWorkspaceEdit}>
                취소
              </FormButton>
              <FormButton variant="primary" size="sm" loading={saveBusy} onClick={() => void saveWorkspace()}>
                변경사항 저장
              </FormButton>
            </div>
          ) : null}
        </div>
        {errorText ? (
          <p className="insurance-contacts-status insurance-contacts-status--error" role="alert">
            {errorText}
          </p>
        ) : null}
        {catalogUnavailable ? (
          <p className="insurance-contacts-status insurance-contacts-status--error" role="alert">
            {insurerCatalogError || '보험회사 카탈로그를 사용할 수 없습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.'}
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
            {!workspaceEdit ? (
              <>
                <FormButton className="button" htmlType="button" variant="action" onClick={() => navigate('/insurance/history')}>
                  업데이트 현황
                </FormButton>
                <FormButton className="button" htmlType="button" variant="action" onClick={() => navigate('/insurance/print')}>
                  출력
                </FormButton>
              </>
            ) : (
              <FormButton className="button" htmlType="button" variant="secondary" onClick={addCompanyCard}>
                + 보험회사 추가
              </FormButton>
            )}
          </>
        }
      />

      <section className="insurance-contacts-list-wrap" aria-live="polite">
        {isLoading ? (
          <p className="insurance-contacts-loading">불러오는 중…</p>
        ) : showEmpty ? (
          <div className="empty-box insurance-contacts-empty" role="status">
            {keyword.trim() ? (
              '검색 결과가 없습니다.'
            ) : workspaceEdit ? (
              <>
                📭 이 분류에 편집할 카드가 없습니다.
                <br />
                「+ 보험회사 추가」로 카드를 만든 뒤 담당자를 입력하세요.
              </>
            ) : isPersonalMode ? (
              <>
                📭 등록한 연락처가 없습니다.
                <br />
                「편집」에서 보험회사 카드를 추가하세요.
              </>
            ) : (
              <>
                📭 이 분류에 등록된 보험사가 없습니다.
                <br />
                담당자에게 등록 요청하세요
              </>
            )}
          </div>
        ) : workspaceEdit ? (
          <div className="insurance-contacts-cards">
            {visibleEditDrafts.map((draft) => (
              <CompanyContactEditableCard
                key={draft.cardKey}
                draft={draft}
                editingTab={activeTab}
                directory={directoryList}
                insurerCatalog={insurerCatalog}
                allowExistingCompanyEdit={isPersonalMode}
                onChange={(next) => updateDraft(draft.cardKey, next)}
                onRemoveCard={() => markCardRemoved(draft.cardKey)}
              />
            ))}
          </div>
        ) : (
          <div className="insurance-contacts-cards">
            {filteredList.map((c) => (
              <CompanyCard
                key={`${c.companyCode}:${c.id}`}
                variant="directory"
                entry={c}
                showEditButton={false}
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
