import { useCallback, useEffect, useState } from 'react'
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
import { PageBackButton } from '../../../components/common/PageBackButton'

const STATUS_META: Record<EntityStatus, { label: string; fg: string; bg: string }> = {
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

const STATUS_SELECT_OPTIONS: { value: EntityStatus; label: string }[] = [
  { value: 'active', label: '정상' },
  { value: 'blocked', label: '접근금지' },
  { value: 'inactive', label: '비활성' },
]

function normalizeUserStatus(s: string | undefined): EntityStatus {
  const v = String(s ?? '').toLowerCase()
  if (v === 'blocked' || v === 'inactive') {
    return v
  }
  return 'active'
}

function StatusBadge({ status }: { status: EntityStatus }) {
  const m = STATUS_META[status]
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

const EDIT_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'USER (일반)' },
  { value: 'GA_ADMIN', label: 'GA_ADMIN (GA 관리자)' },
  { value: 'GA_STAFF', label: 'GA_STAFF (직원)' },
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN (전체 관리자)' },
]

export default function UserManagementPage() {
  const { user, token } = useAuth()
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [gaFilter, setGaFilter] = useState<number | 'all'>('all')
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editing, setEditing] = useState<AdminUserRow | null>(null)
  const [editGaId, setEditGaId] = useState<number>(0)
  const [editRole, setEditRole] = useState<UserRole>('USER')
  const [editStatus, setEditStatus] = useState<EntityStatus>('active')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' || !token?.trim()) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const gas = await listGaCompanies(token)
        if (!cancelled) {
          setGaList(gas)
        }
      } catch {
        if (!cancelled) {
          setLoadError('GA 목록을 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.role, token])

  const loadUsers = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setLoadError('')
    setIsLoading(true)
    try {
      const users = await listAdminUsers(token, gaFilter === 'all' ? undefined : gaFilter)
      setRows(users.map((u) => ({ ...u, status: normalizeUserStatus(u.status as string) })))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '사용자 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role, gaFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const openEdit = (r: AdminUserRow) => {
    setSaveOk('')
    setSaveError('')
    setEditing(r)
    setEditGaId(r.ga_id)
    setEditRole(r.role)
    setEditStatus(normalizeUserStatus(r.status as string))
  }

  const closeEdit = () => {
    if (isSaving) {
      return
    }
    setEditing(null)
    setSaveError('')
  }

  const submitEdit = async () => {
    if (!editing || !token?.trim()) {
      return
    }
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

  const applyUserStatus = async (row: AdminUserRow, status: EntityStatus) => {
    if (!token?.trim()) {
      return
    }
    if (normalizeUserStatus(row.status as string) === status) {
      return
    }
    try {
      const updated = await patchAdminUser(token, row.id, { status })
      setRows((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, ...updated, status: normalizeUserStatus(updated.status as string) }
            : u,
        ),
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    }
  }

  const confirmDeleteUser = async (row: AdminUserRow) => {
    if (!token?.trim()) {
      return
    }
    if (!window.confirm('해당 사용자를 삭제하시겠습니까?')) {
      return
    }
    try {
      await deleteAdminUser(token, row.id)
      setRows((prev) => prev.filter((u) => u.id !== row.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const renderRowCells = (r: AdminUserRow) => {
    const st = normalizeUserStatus(r.status as string)
    const displayName = String(r.display_name ?? '').trim()
    return (
      <>
        <td>{r.ga_company_name}</td>
        <td>{displayName || '—'}</td>
        <td>{r.username}</td>
        <td>{r.role}</td>
        <td>
          <StatusBadge status={st} />
        </td>
        <td className="admin-table-cell--actions">
          <div className="admin-table-actions">
            <select
              className="admin-form-input"
              style={{ width: 'auto', minWidth: 100 }}
              value={st}
              onChange={(e) => void applyUserStatus(r, e.target.value as EntityStatus)}
              disabled={isLoading}
              aria-label={`${r.username} 상태 변경`}
            >
              {STATUS_SELECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" className="button button--secondary" onClick={() => openEdit(r)} disabled={isLoading}>
              수정
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void confirmDeleteUser(r)}
              disabled={isLoading}
            >
              삭제
            </button>
          </div>
        </td>
      </>
    )
  }

  const renderUserCard = (r: AdminUserRow) => {
    const st = normalizeUserStatus(r.status as string)
    const displayName = String(r.display_name ?? '').trim()
    return (
      <article key={r.id} className="admin-user-card">
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
          <span className="admin-user-card__label">역할</span>
          <span className="admin-user-card__value">{r.role}</span>
        </div>
        <div className="admin-user-card__row">
          <span className="admin-user-card__label">상태</span>
          <span className="admin-user-card__value">
            <StatusBadge status={st} />
          </span>
        </div>
        <div className="admin-user-card__actions">
          <select
            className="admin-form-input"
            style={{ flex: '1 1 120px', minWidth: 0 }}
            value={st}
            onChange={(e) => void applyUserStatus(r, e.target.value as EntityStatus)}
            disabled={isLoading}
            aria-label={`${r.username} 상태`}
          >
            {STATUS_SELECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button type="button" className="button button--secondary" onClick={() => openEdit(r)} disabled={isLoading}>
            수정
          </button>
          <button type="button" className="button button--secondary" onClick={() => void confirmDeleteUser(r)} disabled={isLoading}>
            삭제
          </button>
        </div>
      </article>
    )
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>유저 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-user-management">
      <PageBackButton />
      <header className="page-header">
        <h1>유저 관리</h1>
        <p>{loadError || saveOk || 'GA별로 사용자를 조회합니다.'}</p>
      </header>

      <section className="admin-toolbar admin-user-management__toolbar card auth-card" style={{ maxWidth: 960, margin: '0 auto' }}>
        <label className="field admin-modal-field" style={{ marginBottom: 0 }}>
          <span className="field__label">GA 선택</span>
          <select
            className="admin-form-input"
            value={gaFilter === 'all' ? '' : String(gaFilter)}
            onChange={(e) => {
              setSaveOk('')
              const v = e.target.value
              setGaFilter(v === '' ? 'all' : Number(v))
            }}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            <option value="">전체</option>
            {gaList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="card admin-user-management__table-wrap" style={{ maxWidth: 960, margin: '16px auto 0', padding: 0 }}>
        <div className="table-container table-container--desktop">
          <table className="admin-user-table admin-data-table">
            <thead>
              <tr>
                <th scope="col">GA</th>
                <th scope="col">이름</th>
                <th scope="col">아이디</th>
                <th scope="col">역할</th>
                <th scope="col">상태</th>
                <th scope="col" className="admin-table-cell--actions">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px 14px', color: 'var(--text-sub)' }}>
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
            <p style={{ margin: 0, color: 'var(--text-sub)', padding: '8px 4px' }}>표시할 사용자가 없습니다.</p>
          ) : (
            rows.map((r) => renderUserCard(r))
          )}
        </div>
      </div>

      {editing ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeEdit}>
          <div className="admin-modal-panel" role="dialog" aria-labelledby="user-edit-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="user-edit-title" style={{ marginTop: 0 }}>
              유저 수정
            </h2>
            <div className="admin-modal-content">
              <p style={{ margin: 0, wordBreak: 'break-all', fontSize: 14 }}>
                <strong>{editing.username}</strong>
              </p>
              {saveError ? (
                <p className="status status--error" style={{ margin: 0 }}>
                  {saveError}
                </p>
              ) : null}
              <label className="field admin-modal-field">
                <span className="field__label">GA 회사</span>
                <select
                  className="admin-form-input"
                  value={String(editGaId)}
                  onChange={(e) => setEditGaId(Number(e.target.value))}
                  disabled={isSaving}
                >
                  {gaList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">역할</span>
                <select
                  className="admin-form-input"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  disabled={isSaving}
                >
                  {EDIT_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">상태</span>
                <select
                  className="admin-form-input"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as EntityStatus)}
                  disabled={isSaving}
                >
                  {STATUS_SELECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="button button--secondary" onClick={closeEdit} disabled={isSaving}>
                취소
              </button>
              <button type="button" className="button button--primary" onClick={() => void submitEdit()} disabled={isSaving}>
                {isSaving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
