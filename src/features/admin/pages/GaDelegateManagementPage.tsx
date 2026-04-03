import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  createGaDelegate,
  deleteAdminUser,
  listGaCompanies,
  listGaDelegates,
  patchGaDelegate,
  type EntityStatus,
  type GaCompanyRow,
  type GaDelegateRole,
  type GaDelegateRow,
} from '../../auth/authApi'
import { PageBackButton } from '../../../components/common/PageBackButton'

const STATUS_META: Record<string, { label: string; fg: string; bg: string }> = {
  ACTIVE: { label: 'ACTIVE', fg: '#15803d', bg: 'rgba(22, 101, 52, 0.14)' },
  BLOCKED: { label: 'BLOCKED', fg: '#b91c1c', bg: 'rgba(185, 28, 28, 0.14)' },
  INACTIVE: { label: 'INACTIVE', fg: '#4b5563', bg: 'rgba(75, 85, 99, 0.18)' },
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

function StatusBadge({ labelKey }: { labelKey: string }) {
  const m = STATUS_META[labelKey] ?? STATUS_META.ACTIVE
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

export default function GaDelegateManagementPage() {
  const { user, token } = useAuth()
  const [rows, setRows] = useState<GaDelegateRow[]>([])
  const [gaList, setGaList] = useState<GaCompanyRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createGaId, setCreateGaId] = useState<number | ''>('')
  const [createRole, setCreateRole] = useState<GaDelegateRole>('GA_ADMIN')
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const [editing, setEditing] = useState<GaDelegateRow | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editStatus, setEditStatus] = useState<EntityStatus>('active')
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setLoadError('')
    setIsLoading(true)
    try {
      const [list, gas] = await Promise.all([listGaDelegates(token), listGaCompanies(token)])
      setRows(list)
      setGaList(gas)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!createOpen || gaList.length === 0) {
      return
    }
    if (createGaId === '' && gaList.length === 1) {
      setCreateGaId(gaList[0].id)
    }
  }, [createOpen, gaList, createGaId])

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      return
    }
    if (createGaId === '' || !Number.isInteger(Number(createGaId))) {
      setCreateErr('GA를 선택하세요.')
      return
    }
    setCreateErr('')
    setCreateBusy(true)
    try {
      const row = await createGaDelegate(token, {
        gaId: Number(createGaId),
        username: createUsername,
        password: createPassword,
        name: createName,
        role: createRole,
      })
      setRows((prev) => [...prev, row].sort((a, b) => a.gaName.localeCompare(b.gaName) || a.username.localeCompare(b.username)))
      setCreateGaId('')
      setCreateUsername('')
      setCreatePassword('')
      setCreateName('')
      setCreateOpen(false)
      await load()
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setCreateBusy(false)
    }
  }

  const applyStatus = async (row: GaDelegateRow, status: EntityStatus) => {
    if (!token?.trim()) {
      return
    }
    if (normalizeUserStatus(row.status) === status) {
      return
    }
    try {
      const updated = await patchGaDelegate(token, row.id, { status })
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...updated, status: normalizeUserStatus(updated.status) } : r)),
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    }
  }

  const openEdit = (r: GaDelegateRow) => {
    setEditErr('')
    setEditing(r)
    setEditUsername(r.username)
    setEditPassword('')
    setEditStatus(normalizeUserStatus(r.status))
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !token?.trim()) {
      return
    }
    setEditErr('')
    setEditBusy(true)
    try {
      const updated = await patchGaDelegate(token, editing.id, {
        username: editUsername.trim(),
        ...(editPassword.trim() !== '' ? { password: editPassword } : {}),
        status: editStatus,
      })
      setRows((prev) =>
        prev.map((row) => (row.id === editing.id ? { ...row, ...updated, status: normalizeUserStatus(updated.status) } : row)),
      )
      setEditing(null)
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setEditBusy(false)
    }
  }

  const confirmDelete = async (r: GaDelegateRow) => {
    if (!token?.trim()) {
      return
    }
    if (!window.confirm('해당 담당자 계정을 삭제하시겠습니까?')) {
      return
    }
    try {
      await deleteAdminUser(token, r.id)
      setRows((prev) => prev.filter((x) => x.id !== r.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const renderRow = (r: GaDelegateRow) => {
    const st = normalizeUserStatus(r.status)
    const pw = String(r.password ?? '').trim()
    return (
      <tr key={r.id}>
        <td>{r.gaName}</td>
        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.username}</td>
        <td style={{ wordBreak: 'break-all' }}>{pw || '—'}</td>
        <td>
          <StatusBadge labelKey={r.statusLabel} />
        </td>
        <td>{formatCreatedAt(r.created_at)}</td>
        <td className="admin-table-cell--actions">
          <div className="admin-table-actions">
            <select
              className="admin-form-input"
              style={{ width: 'auto', minWidth: 100 }}
              value={st}
              onChange={(e) => void applyStatus(r, e.target.value as EntityStatus)}
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
            <button type="button" className="button button--secondary" onClick={() => void confirmDelete(r)} disabled={isLoading}>
              삭제
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const renderCard = (r: GaDelegateRow) => {
    const st = normalizeUserStatus(r.status)
    const pw = String(r.password ?? '').trim()
    return (
      <article key={r.id} className="admin-ga-card">
        <div className="admin-ga-card__row">
          <span className="admin-ga-card__label">GA 이름</span>
          <span className="admin-ga-card__value">{r.gaName}</span>
        </div>
        <div className="admin-ga-card__row">
          <span className="admin-ga-card__label">아이디</span>
          <span className="admin-ga-card__value">{r.username}</span>
        </div>
        <div className="admin-ga-card__row">
          <span className="admin-ga-card__label">비밀번호</span>
          <span className="admin-ga-card__value">{pw || '—'}</span>
        </div>
        <div className="admin-ga-card__row">
          <span className="admin-ga-card__label">상태</span>
          <span className="admin-ga-card__value">
            <StatusBadge labelKey={r.statusLabel} />
          </span>
        </div>
        <div className="admin-ga-card__row">
          <span className="admin-ga-card__label">생성일</span>
          <span className="admin-ga-card__value">{formatCreatedAt(r.created_at)}</span>
        </div>
        <div className="admin-ga-card__actions">
          <select
            className="admin-form-input"
            style={{ flex: '1 1 120px', minWidth: 0 }}
            value={st}
            onChange={(e) => void applyStatus(r, e.target.value as EntityStatus)}
            disabled={isLoading}
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
          <button type="button" className="button button--secondary" onClick={() => void confirmDelete(r)} disabled={isLoading}>
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
          <h1>담당자 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-ga-management">
      <PageBackButton />
      <header className="page-header">
        <h1>담당자 관리</h1>
        <p>{loadError || '전체 GA의 GA_ADMIN · GA_STAFF 계정을 관리합니다.'}</p>
      </header>

      <section
        className="admin-toolbar admin-ga-management__toolbar card auth-card"
        style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
      >
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setCreateErr('')
            setCreateOpen(true)
          }}
          disabled={isLoading}
        >
          등록
        </button>
        {isLoading ? <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>불러오는 중…</span> : null}
      </section>

      <div className="card admin-ga-management__table-wrap" style={{ maxWidth: 960, margin: '16px auto 0', padding: 0 }}>
        <div className="table-container table-container--desktop">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>GA 이름</th>
                <th>아이디</th>
                <th>비밀번호</th>
                <th>상태</th>
                <th>생성일</th>
                <th className="admin-table-cell--actions">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px 14px', color: 'var(--text-sub)' }}>
                    등록된 담당자가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => renderRow(r))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-responsive-card-list" style={{ padding: 12 }}>
          {rows.length === 0 && !isLoading ? (
            <p style={{ margin: 0, color: 'var(--text-sub)', padding: '8px 4px' }}>등록된 담당자가 없습니다.</p>
          ) : (
            rows.map((r) => renderCard(r))
          )}
        </div>
      </div>

      {createOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!createBusy) {
              setCreateOpen(false)
            }
          }}
        >
          <form
            className="admin-modal-panel"
            role="dialog"
            aria-labelledby="delegate-create-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void submitCreate(e)}
          >
            <h2 id="delegate-create-title" style={{ marginTop: 0 }}>
              담당자 등록
            </h2>
            <div className="admin-modal-content">
              {createErr ? (
                <p className="status status--error" style={{ margin: 0 }}>
                  {createErr}
                </p>
              ) : null}
              <label className="field admin-modal-field">
                <span className="field__label">GA 선택</span>
                <select
                  className="admin-form-input"
                  value={createGaId === '' ? '' : String(createGaId)}
                  onChange={(e) => setCreateGaId(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  disabled={createBusy}
                >
                  <option value="">선택하세요</option>
                  {gaList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">역할</span>
                <select
                  className="admin-form-input"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as GaDelegateRole)}
                  disabled={createBusy}
                >
                  <option value="GA_ADMIN">GA_ADMIN</option>
                  <option value="GA_STAFF">GA_STAFF</option>
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">아이디</span>
                <input
                  className="admin-form-input"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  required
                  disabled={createBusy}
                  autoComplete="off"
                />
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">비밀번호</span>
                <input
                  className="admin-form-input"
                  type="text"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  disabled={createBusy}
                  autoComplete="off"
                />
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">이름 (표시용, 선택)</span>
                <input
                  className="admin-form-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={createBusy}
                  autoComplete="name"
                />
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="button button--secondary" disabled={createBusy} onClick={() => setCreateOpen(false)}>
                취소
              </button>
              <button type="submit" className="button button--primary" disabled={createBusy}>
                {createBusy ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!editBusy) {
              setEditing(null)
            }
          }}
        >
          <form
            className="admin-modal-panel"
            role="dialog"
            aria-labelledby="delegate-edit-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void submitEdit(e)}
          >
            <h2 id="delegate-edit-title" style={{ marginTop: 0 }}>
              담당자 수정
            </h2>
            <div className="admin-modal-content">
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)' }}>
                GA: <strong>{editing.gaName}</strong> · 역할: {editing.role}
              </p>
              {editErr ? (
                <p className="status status--error" style={{ margin: 0 }}>
                  {editErr}
                </p>
              ) : null}
              <label className="field admin-modal-field">
                <span className="field__label">아이디</span>
                <input
                  className="admin-form-input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  disabled={editBusy}
                  autoComplete="off"
                />
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">비밀번호</span>
                <input
                  className="admin-form-input"
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  disabled={editBusy}
                  autoComplete="off"
                  placeholder="비워 두면 유지"
                />
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">상태</span>
                <select
                  className="admin-form-input"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as EntityStatus)}
                  disabled={editBusy}
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
              <button type="button" className="button button--secondary" disabled={editBusy} onClick={() => setEditing(null)}>
                취소
              </button>
              <button type="submit" className="button button--primary" disabled={editBusy}>
                {editBusy ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
