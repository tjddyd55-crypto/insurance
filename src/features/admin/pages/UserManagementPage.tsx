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
  active: { label: '정상', fg: '#15803d', bg: 'rgba(22, 101, 52, 0.14)' },
  blocked: { label: '접근금지', fg: '#b91c1c', bg: 'rgba(185, 28, 28, 0.14)' },
  inactive: { label: '비활성', fg: '#4b5563', bg: 'rgba(75, 85, 99, 0.18)' },
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

      <section className="admin-user-management__toolbar card auth-card" style={{ maxWidth: 960, margin: '0 auto' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field__label">GA 선택</span>
          <select
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

      <div
        className="admin-user-management__table-wrap card"
        style={{
          maxWidth: 960,
          margin: '16px auto 0',
          padding: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          className="admin-user-table"
          style={{
            width: '100%',
            minWidth: '720px',
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                이름
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                아이디
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                GA
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                역할
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                상태
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
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
              rows.map((r) => {
                const st = normalizeUserStatus(r.status as string)
                const displayName = String(r.display_name ?? '').trim()
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      {displayName || '—'}
                    </td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle', wordBreak: 'break-all' }}>
                      {r.username}
                    </td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>{r.ga_company_name}</td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>{r.role}</td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                      <StatusBadge status={st} />
                    </td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                          <span className="visually-hidden">상태 변경</span>
                          <select
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
                        </label>
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => openEdit(r)}
                          disabled={isLoading}
                        >
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
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div
          className="admin-user-edit-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
          role="presentation"
          onClick={closeEdit}
        >
          <div
            className="card auth-card"
            role="dialog"
            aria-labelledby="user-edit-title"
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '90vh',
              overflow: 'auto',
              marginBottom: 'env(safe-area-inset-bottom, 0)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="user-edit-title" style={{ marginTop: 0 }}>
              유저 수정
            </h2>
            <p style={{ marginTop: 0, wordBreak: 'break-all' }}>
              <strong>{editing.username}</strong>
            </p>
            {saveError ? (
              <p style={{ color: 'var(--danger, #c0392b)', marginTop: 0 }}>{saveError}</p>
            ) : null}
            <label className="field">
              <span className="field__label">GA 회사</span>
              <select
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
            <label className="field">
              <span className="field__label">역할</span>
              <select
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
            <label className="field">
              <span className="field__label">상태</span>
              <select
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
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void submitEdit()}
                disabled={isSaving}
              >
                {isSaving ? '저장 중…' : '저장'}
              </button>
              <button type="button" className="button button--secondary" onClick={closeEdit} disabled={isSaving}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
