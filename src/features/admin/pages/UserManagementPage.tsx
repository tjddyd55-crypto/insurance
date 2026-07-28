import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { EmptyState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { formatKrMobileDisplay } from '../../sms/smsDisplayUtils'
import { useAuth } from '../../auth/AuthProvider'
import {
  deleteAdminUser,
  listAdminUsers,
  listGaCompanies,
  patchAdminUser,
  type AdminUserRow,
  type EntityStatus,
  type GaCompanyRow,
  type UserRole,
} from '../../auth/authApi'
import {
  fetchCrmUserBulkSmsRuntime,
  listCrmUserBulkSmsHistory,
  type CrmUserBulkSmsCampaign,
  type CrmUserBulkSmsRuntime,
} from '../api/crmUserBulkSmsApi'
import {
  ADMIN_USER_SUBSCRIPTION_FILTER_OPTIONS,
  formatAdminUserLastLogin,
  formatAdminUserSubscriptionListLabel,
  resolveAdminUserSubscriptionBadgeClass,
  type AdminUserSubscriptionFilter,
} from '../adminUserPresentation'
import CrmUserBulkSmsComposerDialog from '../components/CrmUserBulkSmsComposerDialog'
import CrmUserBulkSmsHistoryDetailDialog from '../components/CrmUserBulkSmsHistoryDetailDialog'

const ACCOUNT_STATUS_META: Record<EntityStatus, { label: string; fg: string; bg: string }> = {
  active: {
    label: '정상',
    fg: 'var(--success)',
    bg: 'color-mix(in srgb, var(--success) 20%, transparent)',
  },
  blocked: {
    label: '접근금지',
    fg: 'var(--danger)',
    bg: 'color-mix(in srgb, var(--danger) 20%, transparent)',
  },
  inactive: {
    label: '비활성',
    fg: 'var(--text-secondary)',
    bg: 'color-mix(in srgb, var(--text-secondary) 18%, transparent)',
  },
}

const ACCOUNT_STATUS_OPTIONS: { value: EntityStatus; label: string }[] = [
  { value: 'active', label: '정상' },
  { value: 'blocked', label: '접근금지' },
  { value: 'inactive', label: '비활성' },
]

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'USER', label: 'USER (일반)' },
  { value: 'GA_ADMIN', label: 'GA_ADMIN' },
  { value: 'GA_STAFF', label: 'GA_STAFF' },
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN' },
  { value: 'INSURER_MANAGER', label: 'INSURER_MANAGER' },
  { value: 'LOSS_ADJUSTER', label: 'LOSS_ADJUSTER' },
]

function normalizeUserStatus(s: string | undefined): EntityStatus {
  const v = String(s ?? '').toLowerCase()
  if (v === 'blocked' || v === 'inactive') return v
  return 'active'
}

function hasSendablePhone(row: AdminUserRow): boolean {
  const digits = String(row.phone_number ?? '').replace(/\D/g, '')
  return /^01[0-9]\d{7,8}$/.test(digits)
}

function formatPhoneCell(row: AdminUserRow): string {
  if (!row.phone_number?.trim()) return '연락처 없음'
  return formatKrMobileDisplay(row.phone_number)
}

function AccountStatusBadge({ status }: { status: EntityStatus }) {
  const m = ACCOUNT_STATUS_META[status]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: m.fg,
        background: m.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  )
}

function SubscriptionStatusBadge({ row }: { row: AdminUserRow }) {
  const badgeClass = resolveAdminUserSubscriptionBadgeClass(row.subscription_status)
  const label = formatAdminUserSubscriptionListLabel(row)
  return <span className={`admin-subscription-badge ${badgeClass}`}>{label}</span>
}

function formatReferrer(row: AdminUserRow): string {
  const displayName = String(row.referrer_display_name ?? '').trim()
  const username = String(row.referrer_username ?? '').trim()
  const gaName = String(row.referrer_ga_company_name ?? '').trim()
  if (!displayName && !username) return '—'
  const name = displayName || username
  const userSuffix = displayName && username ? ` (${username})` : ''
  return gaName ? `${name}${userSuffix} / ${gaName}` : `${name}${userSuffix}`
}

const EDIT_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'USER (일반)' },
  { value: 'GA_ADMIN', label: 'GA_ADMIN (GA 관리자)' },
  { value: 'GA_STAFF', label: 'GA_STAFF (직원)' },
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN (전체 관리자)' },
]

export default function UserManagementPage() {
  const { user, token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [gaFilter, setGaFilter] = useState<number | 'all'>('all')
  const [subscriptionFilter, setSubscriptionFilter] = useState<AdminUserSubscriptionFilter>('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<EntityStatus | ''>('')
  const [hasPhoneFilter, setHasPhoneFilter] = useState<'' | 'yes' | 'no'>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [listActionError, setListActionError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editing, setEditing] = useState<AdminUserRow | null>(null)
  const [editGaId, setEditGaId] = useState<number>(0)
  const [editRole, setEditRole] = useState<UserRole>('USER')
  const [editStatus, setEditStatus] = useState<EntityStatus>('active')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [composerOpen, setComposerOpen] = useState(false)
  const [runtime, setRuntime] = useState<CrmUserBulkSmsRuntime | null>(null)
  const [history, setHistory] = useState<CrmUserBulkSmsCampaign[]>([])
  const [historyError, setHistoryError] = useState('')
  const [historyDetailId, setHistoryDetailId] = useState<number | null>(null)

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' || !token?.trim()) return
    let cancelled = false
    ;(async () => {
      try {
        const gas = await listGaCompanies(token)
        if (!cancelled) setGaList(gas)
      } catch {
        if (!cancelled) setLoadError('GA 목록을 불러오지 못했습니다.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.role, token])

  const loadUsers = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
    setLoadError('')
    setIsLoading(true)
    try {
      const users = await listAdminUsers(token, {
        gaId: gaFilter === 'all' ? undefined : gaFilter,
        subscriptionStatus: subscriptionFilter || undefined,
        q: searchQuery.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        hasPhone: hasPhoneFilter || undefined,
      })
      setRows(users.map((u) => ({ ...u, status: normalizeUserStatus(u.status as string) })))
      setSelectedIds(new Set())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '사용자 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [
    token,
    user?.role,
    gaFilter,
    subscriptionFilter,
    searchQuery,
    roleFilter,
    statusFilter,
    hasPhoneFilter,
  ])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const loadHistory = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') return
    setHistoryError('')
    try {
      const [rt, items] = await Promise.all([
        fetchCrmUserBulkSmsRuntime(token),
        listCrmUserBulkSmsHistory(token),
      ])
      setRuntime(rt)
      setHistory(items)
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '문자 발송 이력을 불러오지 못했습니다.')
    }
  }, [token, user?.role])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const selectableRows = useMemo(() => rows.filter((r) => hasSendablePhone(r)), [rows])
  const selectedSendableCount = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id) && hasSendablePhone(r)).length,
    [rows, selectedIds],
  )
  const selectedNoPhoneCount = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id) && !hasSendablePhone(r)).length,
    [rows, selectedIds],
  )
  const selectedDuplicatePhoneCount = useMemo(() => {
    const phoneCounts = new Map<string, number>()
    for (const row of rows) {
      if (!selectedIds.has(row.id) || !hasSendablePhone(row)) continue
      const digits = String(row.phone_number ?? '').replace(/\D/g, '')
      phoneCounts.set(digits, (phoneCounts.get(digits) ?? 0) + 1)
    }
    let duplicateExcluded = 0
    for (const count of phoneCounts.values()) {
      if (count > 1) duplicateExcluded += count - 1
    }
    return duplicateExcluded
  }, [rows, selectedIds])
  const estimatedUniqueSendCount = Math.max(0, selectedSendableCount - selectedDuplicatePhoneCount)
  const selectedSendableUserIds = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id) && hasSendablePhone(r)).map((r) => r.id),
    [rows, selectedIds],
  )

  const toggleSelect = (id: string, enabled: boolean) => {
    if (!enabled) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectCurrentPageSendable = () => {
    setSelectedIds(new Set(selectableRows.map((r) => r.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const openEdit = (r: AdminUserRow) => {
    setSaveOk('')
    setSaveError('')
    setEditing(r)
    setEditGaId(r.ga_id)
    setEditRole(r.role)
    setEditStatus(normalizeUserStatus(r.status as string))
  }

  const closeEdit = () => {
    if (isSaving) return
    setEditing(null)
    setSaveError('')
  }

  const submitEdit = async () => {
    if (!editing || !token?.trim()) return
    setSaveError('')
    setSaveOk('')
    setIsSaving(true)
    try {
      const updated = await patchAdminUser(token, editing.id, {
        ga_id: editGaId,
        role: editRole,
        status: editStatus,
      })
      setRows((prev) =>
        prev.map((row) =>
          row.id === updated.id
            ? {
                ...row,
                ga_id: updated.ga_id,
                ga_company_name: updated.ga_company_name,
                role: updated.role,
                display_name: updated.display_name,
                phone_number: updated.phone_number ?? row.phone_number,
                status: normalizeUserStatus(updated.status as string),
              }
            : row,
        ),
      )
      setSaveOk('저장되었습니다.')
      setEditing(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDeleteUser = async (row: AdminUserRow) => {
    if (!token?.trim()) return
    const confirmed = await confirm({
      title: '사용자 삭제',
      message: '해당 사용자를 삭제하시겠습니까?',
      tone: 'danger',
    })
    if (!confirmed) return
    setListActionError('')
    try {
      await deleteAdminUser(token, row.id)
      setRows((prev) => prev.filter((u) => u.id !== row.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    } catch (e) {
      setListActionError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const renderRowCells = (r: AdminUserRow) => {
    const displayName = String(r.display_name ?? '').trim()
    const canSms = hasSendablePhone(r)
    return (
      <>
        <td className="admin-user-table__select">
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            disabled={!canSms}
            title={canSms ? '문자 발송 대상' : '등록된 연락처가 없어 문자를 보낼 수 없습니다.'}
            onChange={() => toggleSelect(r.id, canSms)}
            aria-label={`${displayName || r.username} 선택`}
          />
        </td>
        <td>{r.ga_company_name}</td>
        <td>{displayName || '—'}</td>
        <td>{r.username}</td>
        <td>{formatPhoneCell(r)}</td>
        <td>{formatReferrer(r)}</td>
        <td>{r.role}</td>
        <td>
          <AccountStatusBadge status={normalizeUserStatus(r.status as string)} />
        </td>
        <td>
          <SubscriptionStatusBadge row={r} />
        </td>
        <td className="admin-user-table__last-login">
          <span className="admin-user-table__last-login-full">{formatAdminUserLastLogin(r.last_login_at)}</span>
          <span className="admin-user-table__last-login-compact">
            {formatAdminUserLastLogin(r.last_login_at, true)}
          </span>
        </td>
        <td className="admin-table-cell--actions">
          <div className="admin-table-actions">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="button button--secondary"
              onClick={() => openEdit(r)}
              disabled={isLoading}
            >
              수정
            </FormButton>
            <FormButton
              htmlType="button"
              variant="danger"
              className="button button--danger"
              onClick={() => void confirmDeleteUser(r)}
              disabled={isLoading}
            >
              삭제
            </FormButton>
          </div>
        </td>
      </>
    )
  }

  const renderUserCard = (r: AdminUserRow) => {
    const displayName = String(r.display_name ?? '').trim()
    const canSms = hasSendablePhone(r)
    return (
      <article key={r.id} className="admin-user-card">
        <div className="admin-user-card__row admin-user-card__row--select">
          <label className="admin-user-card__select">
            <input
              type="checkbox"
              checked={selectedIds.has(r.id)}
              disabled={!canSms}
              title={canSms ? '문자 발송 대상' : '등록된 연락처가 없어 문자를 보낼 수 없습니다.'}
              onChange={() => toggleSelect(r.id, canSms)}
            />
            <span>선택</span>
          </label>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">GA</span>
          <span className="admin-user-card__value">{r.ga_company_name}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">이름</span>
          <span className="admin-user-card__value">{displayName || '—'}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">아이디</span>
          <span className="admin-user-card__value">{r.username}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">연락처</span>
          <span className="admin-user-card__value">{formatPhoneCell(r)}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">추천인</span>
          <span className="admin-user-card__value">{formatReferrer(r)}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">역할</span>
          <span className="admin-user-card__value">{r.role}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">상태</span>
          <span className="admin-user-card__value">
            <AccountStatusBadge status={normalizeUserStatus(r.status as string)} />
          </span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">구독 상태</span>
          <span className="admin-user-card__value">
            <SubscriptionStatusBadge row={r} />
          </span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">최근 접속일</span>
          <span className="admin-user-card__value">{formatAdminUserLastLogin(r.last_login_at, true)}</span>
        </div>
        <div className="admin-user-card__actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={() => openEdit(r)}
            disabled={isLoading}
          >
            수정
          </FormButton>
          <FormButton
            htmlType="button"
            variant="danger"
            className="button button--danger"
            onClick={() => void confirmDeleteUser(r)}
            disabled={isLoading}
          >
            삭제
          </FormButton>
        </div>
      </article>
    )
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>유저 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-user-management">
      <header className="page-header">
        <h1>유저 관리</h1>
        <p>{loadError || saveOk || 'GA별로 사용자를 조회하고 안내 문자를 발송합니다.'}</p>
      </header>

      <StatusMessage message={listActionError} tone="error" className="m-0" />

      <section
        className="admin-toolbar admin-user-management__toolbar card auth-card"
        style={{ maxWidth: 'none', margin: 0 }}
      >
        <FieldWrapper label="GA 선택" className="admin-modal-field">
          <FormSelect
            className="admin-form-input"
            value={gaFilter === 'all' ? '' : String(gaFilter)}
            onChange={(e) => {
              setSaveOk('')
              const v = e.target.value
              setGaFilter(v === '' ? 'all' : Number(v))
            }}
            disabled={isLoading}
            aria-busy={isLoading}
            options={[
              { value: '', label: '전체' },
              ...gaList.map((g) => ({ value: String(g.id), label: g.name })),
            ]}
          />
        </FieldWrapper>
        <FieldWrapper label="역할" className="admin-modal-field">
          <FormSelect
            className="admin-form-input"
            value={roleFilter}
            onChange={(e) => {
              setSaveOk('')
              setRoleFilter(e.target.value)
            }}
            disabled={isLoading}
            options={ROLE_FILTER_OPTIONS}
          />
        </FieldWrapper>
        <FieldWrapper label="계정 상태" className="admin-modal-field">
          <FormSelect
            className="admin-form-input"
            value={statusFilter}
            onChange={(e) => {
              setSaveOk('')
              setStatusFilter(e.target.value as EntityStatus | '')
            }}
            disabled={isLoading}
            options={[
              { value: '', label: '전체' },
              ...ACCOUNT_STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
            ]}
          />
        </FieldWrapper>
        <FieldWrapper label="연락처" className="admin-modal-field">
          <FormSelect
            className="admin-form-input"
            value={hasPhoneFilter}
            onChange={(e) => {
              setSaveOk('')
              setHasPhoneFilter(e.target.value as '' | 'yes' | 'no')
            }}
            disabled={isLoading}
            options={[
              { value: '', label: '전체' },
              { value: 'yes', label: '연락처 있음' },
              { value: 'no', label: '연락처 없음' },
            ]}
          />
        </FieldWrapper>
        <FieldWrapper label="구독 상태" className="admin-modal-field">
          <FormSelect
            className="admin-form-input"
            value={subscriptionFilter}
            onChange={(e) => {
              setSaveOk('')
              setSubscriptionFilter(e.target.value as AdminUserSubscriptionFilter)
            }}
            disabled={isLoading}
            options={ADMIN_USER_SUBSCRIPTION_FILTER_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          />
        </FieldWrapper>
        <FieldWrapper label="이름 / 아이디 / 연락처 검색" className="admin-modal-field admin-user-management__search">
          <FormInput
            className="admin-form-input"
            value={searchQuery}
            onChange={(e) => {
              setSaveOk('')
              setSearchQuery(e.target.value)
            }}
            placeholder="이름, 아이디, 연락처"
            disabled={isLoading}
          />
        </FieldWrapper>
      </section>

      <section className="admin-user-management__bulk-bar card auth-card">
        <p className="admin-user-management__bulk-summary">
          {selectedIds.size}명 선택 · 발송 가능 {estimatedUniqueSendCount}명
          {selectedNoPhoneCount > 0 ? ` · 연락처 없음 ${selectedNoPhoneCount}명` : ''}
          {selectedDuplicatePhoneCount > 0
            ? ` · 중복 연락처 ${selectedDuplicatePhoneCount}명 제외`
            : ''}
          <span className="admin-user-management__bulk-note">
            {' '}
            (현재 화면에 표시된 사용자만 선택합니다)
          </span>
        </p>
        <div className="admin-user-management__bulk-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={selectCurrentPageSendable}
            disabled={isLoading || selectableRows.length === 0}
          >
            현재 목록 전체 선택
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={clearSelection}
            disabled={selectedIds.size === 0}
          >
            선택 해제
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            className="button button--primary"
            onClick={() => setComposerOpen(true)}
            disabled={selectedSendableCount < 1}
          >
            문자 보내기 ({estimatedUniqueSendCount})
          </FormButton>
        </div>
      </section>

      <div
        className="card admin-user-management__table-wrap"
        style={{ maxWidth: 'none', margin: '16px 0 0', padding: 0 }}
      >
        <div className="table-container table-container--desktop">
          <table className="admin-user-table admin-data-table">
            <thead>
              <tr>
                <th scope="col">선택</th>
                <th scope="col">GA</th>
                <th scope="col">이름</th>
                <th scope="col">아이디</th>
                <th scope="col">연락처</th>
                <th scope="col">추천인</th>
                <th scope="col">역할</th>
                <th scope="col">상태</th>
                <th scope="col">구독 상태</th>
                <th scope="col">최근 접속일</th>
                <th scope="col" className="admin-table-cell--actions">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={11} style={{ padding: '20px 14px', color: 'var(--text-sub)' }}>
                    표시할 사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => <tr key={r.id}>{renderRowCells(r)}</tr>)
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-responsive-card-list" style={{ padding: 12 }}>
          {rows.length === 0 && !isLoading ? (
            <EmptyState message="표시할 사용자가 없습니다." className="m-0 px-1 py-2 text-[var(--text-sub)]" />
          ) : (
            rows.map((r) => renderUserCard(r))
          )}
        </div>
      </div>

      <section className="card admin-user-management__history" style={{ maxWidth: 'none', margin: '16px 0 0' }}>
        <header className="admin-user-management__history-header">
          <h2>문자 발송 이력</h2>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={() => void loadHistory()}
          >
            새로고침
          </FormButton>
        </header>
        <StatusMessage message={historyError} tone="error" className="m-0" />
        {history.length === 0 ? (
          <EmptyState message="발송 이력이 없습니다." className="m-0 px-1 py-2 text-[var(--text-sub)]" />
        ) : (
          <ul className="admin-user-management__history-list">
            {history.map((c) => (
              <li key={c.id}>
                <div className="admin-user-management__history-row">
                  <div className="admin-user-management__history-main">
                    <strong>{c.title}</strong>
                    <span>
                      #{c.id} · {c.status}
                      {c.dryRun ? ' · dry-run' : ''} · {c.smsType} · 대상 {c.targetCount} · 성공{' '}
                      {c.successCount} · 실패 {c.failedCount} · 제외 {c.excludedCount}
                    </span>
                    <span className="admin-user-management__history-meta">
                      {c.requestedByDisplayName || c.requestedByUsername || c.requestedBy || '—'} ·{' '}
                      {c.createdAt ? String(c.createdAt).slice(0, 19).replace('T', ' ') : '—'}
                    </span>
                  </div>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    className="button button--secondary"
                    onClick={() => setHistoryDetailId(c.id)}
                  >
                    상세보기
                  </FormButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <FormDialog
          open={Boolean(editing)}
          onClose={closeEdit}
          title="유저 수정"
          panelClassName="admin-modal-panel"
          overlayClassName="admin-modal-backdrop"
          closeOnBackdrop={!isSaving}
          closeOnEsc={!isSaving}
        >
          <div className="admin-modal-content">
            <p style={{ margin: 0, wordBreak: 'break-all', fontSize: 14 }}>
              <strong>{editing.username}</strong>
            </p>
            <StatusMessage message={saveError} tone="error" className="m-0" />
            <FieldWrapper label="GA 회사" className="admin-modal-field">
              <FormSelect
                className="admin-form-input"
                value={String(editGaId)}
                onChange={(e) => setEditGaId(Number(e.target.value))}
                disabled={isSaving}
                options={gaList.map((g) => ({ value: String(g.id), label: g.name }))}
              />
            </FieldWrapper>
            <FieldWrapper label="역할" className="admin-modal-field">
              <FormSelect
                className="admin-form-input"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                disabled={isSaving}
                options={EDIT_ROLE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              />
            </FieldWrapper>
            <FieldWrapper label="계정 상태" className="admin-modal-field">
              <FormSelect
                className="admin-form-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as EntityStatus)}
                disabled={isSaving}
                options={ACCOUNT_STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              />
            </FieldWrapper>
            <div className="admin-modal-field">
              <span className="admin-user-card__label">연락처</span>
              <div style={{ marginTop: 6, color: 'var(--text-primary)' }}>{formatPhoneCell(editing)}</div>
            </div>
            <div className="admin-modal-field">
              <span className="admin-user-card__label">현재 구독 상태</span>
              <div style={{ marginTop: 6 }}>
                <SubscriptionStatusBadge row={editing} />
              </div>
            </div>
            <div className="admin-modal-field">
              <span className="admin-user-card__label">최근 접속일</span>
              <div style={{ marginTop: 6, color: 'var(--text-primary)' }}>
                {formatAdminUserLastLogin(editing.last_login_at)}
              </div>
            </div>
            <div className="admin-modal-field">
              <span className="admin-user-card__label">계정 상태 표시</span>
              <div style={{ marginTop: 6 }}>
                <AccountStatusBadge status={editStatus} />
              </div>
            </div>
          </div>
          <div className="admin-modal-actions">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="button button--secondary"
              onClick={closeEdit}
              disabled={isSaving}
            >
              취소
            </FormButton>
            <FormButton
              htmlType="button"
              variant="primary"
              className="button button--primary"
              loading={isSaving}
              loadingText="저장 중…"
              onClick={() => void submitEdit()}
            >
              저장
            </FormButton>
          </div>
        </FormDialog>
      ) : null}

      {token ? (
        <CrmUserBulkSmsComposerDialog
          open={composerOpen}
          token={token}
          selectedUserIds={selectedSendableUserIds}
          runtime={runtime}
          onClose={() => setComposerOpen(false)}
          onSent={() => {
            clearSelection()
            void loadHistory()
          }}
        />
      ) : null}
      {token ? (
        <CrmUserBulkSmsHistoryDetailDialog
          open={historyDetailId != null}
          token={token}
          campaignId={historyDetailId}
          onClose={() => setHistoryDetailId(null)}
        />
      ) : null}
      {confirmDialog}
    </main>
  )
}
