import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  listAdminUsers,
  listGaCompanies,
  patchAdminUser,
  type AdminUserRow,
  type GaCompanyRow,
  type UserRole,
} from '../../auth/authApi'
import { PageBackButton } from '../../../components/common/PageBackButton'

const EDIT_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'USER (일반)' },
  { value: 'GA_ADMIN', label: 'GA_ADMIN (GA 관리자)' },
  { value: 'GA_STAFF', label: 'GA_STAFF (직원)' },
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN (전체 관리자)' },
]

function formatCreatedAt(iso: string): string {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

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
      setRows(users)
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
      })
      setRows((prev) =>
        prev.map((row) =>
          row.id === updated.id
            ? {
                ...row,
                ga_id: updated.ga_id,
                ga_company_name: updated.ga_company_name,
                role: updated.role,
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
            minWidth: '520px',
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
                GA 회사
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
                역할
              </th>
              <th
                scope="col"
                style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                생성일
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
                <td colSpan={5} style={{ padding: '20px 14px', color: 'var(--text-sub)' }}>
                  표시할 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{r.ga_company_name}</td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', wordBreak: 'break-all' }}>
                    {r.username}
                  </td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{r.role}</td>
                  <td style={{ padding: '12px 14px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCreatedAt(r.created_at)}
                  </td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => openEdit(r)}
                      disabled={isLoading}
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))
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
