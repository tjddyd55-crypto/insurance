import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { listCompanyDirectory } from '../../company-registry/api/companyRegistryApi'
import { canonicalInsuranceCategoryForFilter } from '../../company-registry/domain/categoryUtils'
import { useAuth } from '../../auth/AuthProvider'
import {
  createInsurerManagerApi,
  listInsurerManagersApi,
  patchInsurerManagerApi,
} from '../insurerManagerApi'
import type { InsurerManager, InsurerManagerStatus, InsurerManagerType } from '../types'

const STATUS_OPTIONS: { value: InsurerManagerStatus; label: string }[] = [
  { value: 'ACTIVE', label: '정상' },
  { value: 'BLOCKED', label: '접근 금지' },
]

const TYPE_OPTIONS: { value: InsurerManagerType; label: string }[] = [
  { value: 'LIFE', label: '생명보험' },
  { value: 'NON_LIFE', label: '손해보험' },
]

function StatusBadge({ status }: { status: InsurerManagerStatus }) {
  const active = status === 'ACTIVE'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: active ? 'var(--success)' : 'var(--danger)',
        background: active
          ? 'color-mix(in srgb, var(--success) 20%, transparent)'
          : 'color-mix(in srgb, var(--danger) 20%, transparent)',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

function emptyForm(): {
  insurerType: InsurerManagerType
  companyId: number
  username: string
  password: string
} {
  return {
    insurerType: 'NON_LIFE',
    companyId: 0,
    username: '',
    password: '',
  }
}

export default function InsurerManagersPage() {
  const { user, token } = useAuth()
  const gaCode = user?.gaCode?.trim() ?? ''
  const [rows, setRows] = useState<InsurerManager[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState<InsurerManager | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!gaCode || !token) {
      return
    }
    setLoadErr('')
    try {
      const list = await listInsurerManagersApi(token)
      setRows(list)
    } catch {
      setLoadErr('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }, [gaCode, token])

  useEffect(() => {
    void reload()
  }, [reload])

  const { data: companyDirectory = [] } = useQuery({
    queryKey: ['company-directory', token, gaCode],
    queryFn: () => listCompanyDirectory(token!),
    enabled: Boolean(token && gaCode),
  })

  const masterChoices = useMemo(() => {
    return companyDirectory
      .filter(
        (c: any) =>
          canonicalInsuranceCategoryForFilter(c.category, c.name) === form.insurerType,
      )
      .slice()
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ko'))
  }, [companyDirectory, form.insurerType])

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormErr('')
    if (!gaCode || !token) {
      return
    }
    const u = form.username.trim()
    const password = form.password
    if (!form.companyId || !u || !password) {
      setFormErr('보험사(마스터), 아이디, 비밀번호를 모두 입력하세요.')
      return
    }
    setSaving(true)
    try {
      await createInsurerManagerApi(token, {
        insurerType: form.insurerType,
        companyId: form.companyId,
        username: u,
        password,
      })
      setForm(emptyForm())
      setRegisterOpen(false)
      await reload()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    setFormErr('')
    if (!gaCode || !token || !editing) {
      return
    }
    const u = form.username.trim()
    if (!form.companyId || !u) {
      setFormErr('보험사(마스터)와 아이디를 입력하세요.')
      return
    }
    setSaving(true)
    try {
      await patchInsurerManagerApi(token, editing.id, {
        insurerType: form.insurerType,
        companyId: form.companyId,
        username: u,
        ...(form.password.trim() !== '' ? { password: form.password } : {}),
      })
      setEditing(null)
      setForm(emptyForm())
      await reload()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : '수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const applyStatus = async (row: InsurerManager, status: InsurerManagerStatus) => {
    if (!token || row.status === status) {
      return
    }
    setLoadErr('')
    try {
      await patchInsurerManagerApi(token, row.id, { status })
      await reload()
    } catch {
      setLoadErr('상태를 변경하지 못했습니다.')
    }
  }

  const openEdit = (row: InsurerManager) => {
    setFormErr('')
    setRegisterOpen(false)
    setEditing(row)
    setForm({
      insurerType: row.insurerType,
      companyId: row.companyId,
      username: row.username,
      password: '',
    })
  }

  const closeModals = () => {
    setRegisterOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setFormErr('')
  }

  if (!gaCode) {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>원수사 담당자 관리</h1>
          <p>GA에 소속된 계정으로 로그인한 후 이용할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-user-management">
      <header className="page-header">
        <h1>원수사 담당자 관리</h1>
        <p style={{ color: 'var(--text-sub)', margin: 0 }}>보험사별 로그인 계정(아이디·비밀번호)을 관리합니다.</p>
      </header>

      {loadErr ? <p className="status status--error">{loadErr}</p> : null}

      <section
        className="admin-toolbar card auth-card"
        style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
      >
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setFormErr('')
            setEditing(null)
            setForm(emptyForm())
            setRegisterOpen(true)
          }}
        >
          등록
        </button>
      </section>

      <div className="card" style={{ maxWidth: 960, margin: '16px auto 0', padding: 0 }}>
        <div className="table-container table-container--desktop">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>보험회사</th>
                <th>아이디</th>
                <th>비밀번호</th>
                <th>상태</th>
                <th className="admin-table-cell--actions">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 20, color: 'var(--text-sub)' }}>
                    등록된 원수사 담당자 계정이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.insurerName}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.username}</td>
                    <td style={{ wordBreak: 'break-all' }}>{r.password?.trim() ? r.password : '—'}</td>
                    <td>
                      <div className="admin-table-actions" style={{ alignItems: 'center' }}>
                        <StatusBadge status={r.status} />
                        <select
                          className="admin-form-input"
                          style={{ width: 'auto', minWidth: 120 }}
                          value={r.status}
                          onChange={(e) => void applyStatus(r, e.target.value as InsurerManagerStatus)}
                          aria-label={`${r.username} 상태`}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="admin-table-cell--actions">
                      <button type="button" className="button button--secondary" onClick={() => openEdit(r)}>
                        수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-responsive-card-list" style={{ padding: 12 }}>
          {rows.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-sub)' }}>등록된 원수사 담당자 계정이 없습니다.</p>
          ) : (
            rows.map((r) => (
              <article key={r.id} className="admin-user-card">
                <div className="admin-user-card__row">
                  <span className="admin-user-card__label">보험회사</span>
                  <span className="admin-user-card__value">{r.insurerName}</span>
                </div>
                <div className="admin-user-card__row">
                  <span className="admin-user-card__label">아이디</span>
                  <span className="admin-user-card__value">{r.username}</span>
                </div>
                <div className="admin-user-card__row">
                  <span className="admin-user-card__label">비밀번호</span>
                  <span className="admin-user-card__value">{r.password?.trim() ? r.password : '—'}</span>
                </div>
                <div className="admin-user-card__row">
                  <span className="admin-user-card__label">상태</span>
                  <span className="admin-user-card__value">
                    <StatusBadge status={r.status} />
                  </span>
                </div>
                <div className="admin-user-card__actions">
                  <select
                    className="admin-form-input"
                    style={{ flex: '1 1 140px', minWidth: 0 }}
                    value={r.status}
                    onChange={(e) => void applyStatus(r, e.target.value as InsurerManagerStatus)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="button button--secondary" onClick={() => openEdit(r)}>
                    수정
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {registerOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeModals}>
          <form
            className="admin-modal-panel"
            role="dialog"
            aria-labelledby="im-create-title"
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={(ev) => void submitCreate(ev)}
          >
            <h2 id="im-create-title" style={{ marginTop: 0 }}>
              원수사 담당자 등록
            </h2>
            <div className="admin-modal-content">
              {formErr ? <p className="status status--error" style={{ margin: 0 }}>{formErr}</p> : null}
              <label className="field admin-modal-field">
                <span className="field__label">보험사 유형</span>
                <select
                  className="admin-form-input"
                  required
                  value={form.insurerType}
                  onChange={(e) => {
                    const t = e.target.value as InsurerManagerType
                    setForm((f) => ({
                      ...f,
                      insurerType: t,
                      companyId: 0,
                    }))
                  }}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">보험회사 (DB 마스터)</span>
                <select
                  className="admin-form-input"
                  required
                  value={form.companyId || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, companyId: Number(e.target.value) || 0 }))
                  }
                >
                  <option value="">선택</option>
                  {masterChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">아이디</span>
                <input
                  className="admin-form-input"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">비밀번호</span>
                <input
                  className="admin-form-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="button button--secondary" onClick={closeModals} disabled={saving}>
                취소
              </button>
              <button type="submit" className="button button--primary" disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeModals}>
          <form
            className="admin-modal-panel"
            role="dialog"
            aria-labelledby="im-edit-title"
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={(ev) => void submitEdit(ev)}
          >
            <h2 id="im-edit-title" style={{ marginTop: 0 }}>
              원수사 담당자 수정
            </h2>
            <div className="admin-modal-content">
              {formErr ? <p className="status status--error" style={{ margin: 0 }}>{formErr}</p> : null}
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-sub)' }}>
                비밀번호는 비워 두면 기존 값이 유지되며, 입력한 경우에만 변경됩니다.
              </p>
              <label className="field admin-modal-field">
                <span className="field__label">보험사 유형</span>
                <select
                  className="admin-form-input"
                  required
                  value={form.insurerType}
                  onChange={(e) => {
                    const t = e.target.value as InsurerManagerType
                    setForm((f) => ({
                      ...f,
                      insurerType: t,
                      companyId: 0,
                    }))
                  }}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">보험회사 (DB 마스터)</span>
                <select
                  className="admin-form-input"
                  required
                  value={form.companyId || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, companyId: Number(e.target.value) || 0 }))
                  }
                >
                  <option value="">선택</option>
                  {masterChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">아이디</span>
                <input
                  className="admin-form-input"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="field admin-modal-field">
                <span className="field__label">비밀번호 (변경 시만 입력)</span>
                <input
                  className="admin-form-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                  placeholder="비워 두면 유지"
                />
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="button button--secondary" onClick={closeModals} disabled={saving}>
                취소
              </button>
              <button type="submit" className="button button--primary" disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
