import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  createGaCompany,
  deleteGaCompany,
  listGaCompanies,
  patchGaCompany,
  type EntityStatus,
  type GaCompanyRow,
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

function normalizeStatus(s: string | undefined): EntityStatus {
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

export default function GaManagementPage() {
  const { user, token } = useAuth()
  const [rows, setRows] = useState<GaCompanyRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCode, setCreateCode] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const [editing, setEditing] = useState<GaCompanyRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setLoadError('')
    setIsLoading(true)
    try {
      const list = await listGaCompanies(token)
      setRows(list.map((r) => ({ ...r, status: normalizeStatus(r.status as string) })))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      return
    }
    setCreateErr('')
    setCreateBusy(true)
    try {
      await createGaCompany(token, { name: createName, code: createCode })
      setCreateName('')
      setCreateCode('')
      setCreateOpen(false)
      await load()
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setCreateBusy(false)
    }
  }

  const applyStatus = async (row: GaCompanyRow, status: EntityStatus) => {
    if (!token?.trim()) {
      return
    }
    if (normalizeStatus(row.status as string) === status) {
      return
    }
    try {
      const updated = await patchGaCompany(token, row.id, { status })
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, ...updated, status: normalizeStatus(updated.status as string) } : r,
        ),
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    }
  }

  const openEdit = (r: GaCompanyRow) => {
    setEditErr('')
    setEditing(r)
    setEditName(r.name)
    setEditCode(r.code)
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !token?.trim()) {
      return
    }
    setEditErr('')
    setEditBusy(true)
    try {
      const updated = await patchGaCompany(token, editing.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
      })
      setRows((prev) =>
        prev.map((r) =>
          r.id === editing.id ? { ...r, ...updated, status: normalizeStatus(updated.status as string) } : r,
        ),
      )
      setEditing(null)
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setEditBusy(false)
    }
  }

  const confirmDelete = async (r: GaCompanyRow) => {
    if (!token?.trim()) {
      return
    }
    if (!window.confirm('해당 GA를 삭제하시겠습니까?')) {
      return
    }
    try {
      await deleteGaCompany(token, r.id)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <PageBackButton />
        <header className="page-header">
          <h1>GA 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-ga-management">
      <PageBackButton />
      <header className="page-header">
        <h1>GA 관리</h1>
        <p>{loadError || 'GA 회사를 등록·상태·삭제(소프트)할 수 있습니다.'}</p>
      </header>

      <section
        className="admin-ga-management__toolbar card auth-card"
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
          GA 등록
        </button>
        {isLoading ? <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>불러오는 중…</span> : null}
      </section>

      <div
        className="admin-ga-management__table-wrap card"
        style={{
          maxWidth: 960,
          margin: '16px auto 0',
          padding: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: 640,
            borderCollapse: 'collapse',
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>GA 이름</th>
              <th style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>GA 코드</th>
              <th style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>상태</th>
              <th style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>생성일</th>
              <th style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} style={{ padding: '20px 14px', color: 'var(--text-sub)' }}>
                  등록된 GA가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const st = normalizeStatus(r.status as string)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>{r.name}</td>
                    <td
                      style={{ padding: '12px 10px', verticalAlign: 'middle', wordBreak: 'break-all', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {r.code}
                    </td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                      <StatusBadge status={st} />
                    </td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCreatedAt(r.created_at)}
                    </td>
                    <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                          <span className="visually-hidden">상태 변경</span>
                          <select
                            value={st}
                            onChange={(e) => void applyStatus(r, e.target.value as EntityStatus)}
                            disabled={isLoading}
                            aria-label={`${r.name} 상태`}
                          >
                            {STATUS_SELECT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
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
              })
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => {
            if (!createBusy) {
              setCreateOpen(false)
            }
          }}
        >
          <form
            className="card auth-card"
            role="dialog"
            aria-labelledby="ga-create-title"
            style={{
              width: '100%',
              maxWidth: 420,
              marginBottom: 'env(safe-area-inset-bottom, 0)',
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitCreate}
          >
            <h2 id="ga-create-title" style={{ marginTop: 0 }}>
              GA 등록
            </h2>
            {createErr ? <p style={{ color: 'var(--danger, #c0392b)', marginTop: 0 }}>{createErr}</p> : null}
            <label className="field">
              <span className="field__label">GA 이름</span>
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} required disabled={createBusy} />
            </label>
            <label className="field">
              <span className="field__label">GA 코드</span>
              <input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                required
                disabled={createBusy}
                autoComplete="off"
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" className="button button--primary" disabled={createBusy}>
                {createBusy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                className="button button--secondary"
                disabled={createBusy}
                onClick={() => setCreateOpen(false)}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => {
            if (!editBusy) {
              setEditing(null)
            }
          }}
        >
          <form
            className="card auth-card"
            role="dialog"
            aria-labelledby="ga-edit-title"
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '90vh',
              overflow: 'auto',
              marginBottom: 'env(safe-area-inset-bottom, 0)',
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitEdit}
          >
            <h2 id="ga-edit-title" style={{ marginTop: 0 }}>
              GA 수정
            </h2>
            {editErr ? <p style={{ color: 'var(--danger, #c0392b)', marginTop: 0 }}>{editErr}</p> : null}
            <label className="field">
              <span className="field__label">GA 이름</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} required disabled={editBusy} />
            </label>
            <label className="field">
              <span className="field__label">GA 코드</span>
              <input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                required
                disabled={editBusy}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="submit" className="button button--primary" disabled={editBusy}>
                {editBusy ? '저장 중…' : '저장'}
              </button>
              <button type="button" className="button button--secondary" disabled={editBusy} onClick={() => setEditing(null)}>
                취소
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
