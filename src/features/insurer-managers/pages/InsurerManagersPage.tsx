import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { listCompanyDirectory } from '../../company-registry/api/companyRegistryApi'
import type { CompanyDirectoryEntry } from '../../company-registry/domain/types'
import { canonicalInsuranceCategoryForFilter } from '../../company-registry/domain/categoryUtils'
import { useAuth } from '../../auth/AuthProvider'
import {
  createInsurerManagerApi,
  deleteInsurerManagerApi,
  listInsurerManagersApi,
  patchInsurerManagerApi,
} from '../insurerManagerApi'
import {
  createLossAdjusterApi,
  deleteLossAdjusterApi,
  listLossAdjustersApi,
  patchLossAdjusterApi,
} from '../../loss-adjusters/lossAdjusterApi'
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
  companyName: string
  adjusterName: string
  username: string
  password: string
} {
  return {
    insurerType: 'NON_LIFE',
    companyId: 0,
    companyName: '',
    adjusterName: '',
    username: '',
    password: '',
  }
}

type ManagerChannelKind = 'insurer' | 'lossAdjuster'
type ManagerCreatePayload = {
  insurerType?: InsurerManagerType
  companyId?: number
  companyName?: string
  adjusterName?: string
  username: string
  password: string
}
type ManagerPatchPayload = {
  insurerType?: InsurerManagerType
  companyId?: number
  companyName?: string
  adjusterName?: string
  username?: string
  password?: string
  status?: InsurerManagerStatus
}

type ManagerPageConfig = {
  pageTitle: string
  description: string
  entityLabel: string
  listEmpty: string
  createTitle: string
  editTitle: string
  noSessionMessage: string
  createRequiredMessage: string
  editRequiredMessage: string
  deleteConfirm: (name: string) => string
  listApi: (token: string) => Promise<InsurerManager[]>
  createApi: (token: string, payload: ManagerCreatePayload) => Promise<InsurerManager>
  patchApi: (token: string, id: string, payload: ManagerPatchPayload) => Promise<InsurerManager>
  deleteApi: (token: string, id: string) => Promise<{ ok: boolean }>
}

function configFor(kind: ManagerChannelKind): ManagerPageConfig {
  if (kind === 'lossAdjuster') {
    return {
      pageTitle: '손해사정사 계정 관리',
      description: '손해사정사별 로그인 계정(아이디·비밀번호)을 관리합니다.',
      entityLabel: '회사명',
      listEmpty: '등록된 손해사정사 계정이 없습니다.',
      createTitle: '손해사정사 계정 등록',
      editTitle: '손해사정사 계정 수정',
      noSessionMessage: 'GA에 소속된 계정으로 로그인한 후 이용할 수 있습니다.',
      createRequiredMessage: '회사명, 손해사정사 이름, 아이디, 비밀번호를 모두 입력하세요.',
      editRequiredMessage: '회사명, 손해사정사 이름, 아이디를 입력하세요.',
      deleteConfirm: (name) => `"${name}" 손해사정사 계정을 삭제하시겠습니까?`,
      listApi: listLossAdjustersApi,
      createApi: (token, payload) =>
        createLossAdjusterApi(token, {
          companyName: String(payload.companyName ?? ''),
          adjusterName: String(payload.adjusterName ?? ''),
          username: payload.username,
          password: payload.password,
        }),
      patchApi: (token, id, payload) =>
        patchLossAdjusterApi(token, id, {
          companyName: payload.companyName,
          adjusterName: payload.adjusterName,
          username: payload.username,
          password: payload.password,
          status: payload.status,
        }),
      deleteApi: deleteLossAdjusterApi,
    }
  }
  return {
    pageTitle: '원수사 담당자 관리',
    description: '보험사별 로그인 계정(아이디·비밀번호)을 관리합니다.',
    entityLabel: '보험회사',
    listEmpty: '등록된 원수사 담당자 계정이 없습니다.',
    createTitle: '원수사 담당자 등록',
    editTitle: '원수사 담당자 수정',
    noSessionMessage: 'GA에 소속된 계정으로 로그인한 후 이용할 수 있습니다.',
    createRequiredMessage: '보험사(마스터), 아이디, 비밀번호를 모두 입력하세요.',
    editRequiredMessage: '보험사(마스터)와 아이디를 입력하세요.',
    deleteConfirm: (name) => `"${name}" 담당자 계정을 삭제하시겠습니까?`,
    listApi: listInsurerManagersApi,
    createApi: (token, payload) =>
      createInsurerManagerApi(token, {
        insurerType: payload.insurerType ?? 'NON_LIFE',
        companyId: Number(payload.companyId ?? 0),
        username: payload.username,
        password: payload.password,
      }),
    patchApi: (token, id, payload) =>
      patchInsurerManagerApi(token, id, {
        insurerType: payload.insurerType,
        companyId: payload.companyId,
        username: payload.username,
        password: payload.password,
        status: payload.status,
      }),
    deleteApi: deleteInsurerManagerApi,
  }
}

export default function InsurerManagersPage({ managerKind = 'insurer' }: { managerKind?: ManagerChannelKind }) {
  const { user, token } = useAuth()
  const config = useMemo(() => configFor(managerKind), [managerKind])
  const isLossAdjusterMode = managerKind === 'lossAdjuster'
  const gaCode = user?.gaCode?.trim() ?? ''
  const canDelete = user?.role === 'GA_ADMIN' || user?.role === 'GA_STAFF'
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
      const list = await config.listApi(token)
      setRows(list)
    } catch {
      setLoadErr('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }, [config, gaCode, token])

  useEffect(() => {
    void reload()
  }, [reload])

  const { data: companyDirectory = [] } = useQuery<CompanyDirectoryEntry[]>({
    queryKey: ['company-directory', token, gaCode],
    queryFn: () => listCompanyDirectory(token!),
    enabled: Boolean(token && gaCode && !isLossAdjusterMode),
  })

  const masterChoices = useMemo(() => {
    return companyDirectory
      .filter((c) => canonicalInsuranceCategoryForFilter(c.category, c.name) === form.insurerType)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [companyDirectory, form.insurerType])

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormErr('')
    if (!gaCode || !token) {
      return
    }
    const u = form.username.trim()
    const password = form.password
    if (isLossAdjusterMode) {
      if (!form.companyName.trim() || !form.adjusterName.trim() || !u || !password) {
        setFormErr(config.createRequiredMessage)
        return
      }
    } else if (!form.companyId || !u || !password) {
      setFormErr(config.createRequiredMessage)
      return
    }
    setSaving(true)
    try {
      if (isLossAdjusterMode) {
        await config.createApi(token, {
          companyName: form.companyName,
          adjusterName: form.adjusterName,
          username: u,
          password,
        })
      } else {
        await config.createApi(token, {
          insurerType: form.insurerType,
          companyId: form.companyId,
          username: u,
          password,
        })
      }
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
    if (isLossAdjusterMode) {
      if (!form.companyName.trim() || !form.adjusterName.trim() || !u) {
        setFormErr(config.editRequiredMessage)
        return
      }
    } else if (!form.companyId || !u) {
      setFormErr(config.editRequiredMessage)
      return
    }
    setSaving(true)
    try {
      if (isLossAdjusterMode) {
        await config.patchApi(token, editing.id, {
          companyName: form.companyName,
          adjusterName: form.adjusterName,
          username: u,
          ...(form.password.trim() !== '' ? { password: form.password } : {}),
        })
      } else {
        await config.patchApi(token, editing.id, {
          insurerType: form.insurerType,
          companyId: form.companyId,
          username: u,
          ...(form.password.trim() !== '' ? { password: form.password } : {}),
        })
      }
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
      await config.patchApi(token, row.id, { status })
      await reload()
    } catch {
      setLoadErr('상태를 변경하지 못했습니다.')
    }
  }

  const removeManager = async (row: InsurerManager) => {
    if (!token || !canDelete) {
      return
    }
    if (!window.confirm(config.deleteConfirm(row.insurerName))) {
      return
    }
    setLoadErr('')
    try {
      await config.deleteApi(token, row.id)
      await reload()
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : '삭제하지 못했습니다.')
    }
  }

  const openEdit = (row: InsurerManager) => {
    setFormErr('')
    setRegisterOpen(false)
    setEditing(row)
    setForm({
      insurerType: row.insurerType,
      companyId: row.companyId,
      companyName: row.insurerName,
      adjusterName: row.managerName ?? '',
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
          <h1>{config.pageTitle}</h1>
          <p>{config.noSessionMessage}</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back admin-user-management">
      <header className="page-header">
        <h1>{config.pageTitle}</h1>
        <p style={{ color: 'var(--text-sub)', margin: 0 }}>{config.description}</p>
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
                <th>{config.entityLabel}</th>
                {isLossAdjusterMode ? <th>손해사정사 이름</th> : null}
                <th>아이디</th>
                <th>비밀번호</th>
                <th>상태</th>
                <th className="admin-table-cell--actions">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isLossAdjusterMode ? 6 : 5} style={{ padding: 20, color: 'var(--text-sub)' }}>
                    {config.listEmpty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.insurerName}</td>
                    {isLossAdjusterMode ? <td>{r.managerName?.trim() || '—'}</td> : null}
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
                      {canDelete ? (
                        <button type="button" className="button button--secondary" onClick={() => void removeManager(r)}>
                          삭제
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-responsive-card-list" style={{ padding: 12 }}>
          {rows.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-sub)' }}>{config.listEmpty}</p>
          ) : (
            rows.map((r) => (
              <article key={r.id} className="admin-user-card">
                <div className="admin-user-card__row">
                  <span className="admin-user-card__label">{config.entityLabel}</span>
                  <span className="admin-user-card__value">{r.insurerName}</span>
                </div>
                {isLossAdjusterMode ? (
                  <div className="admin-user-card__row">
                    <span className="admin-user-card__label">손해사정사 이름</span>
                    <span className="admin-user-card__value">{r.managerName?.trim() || '—'}</span>
                  </div>
                ) : null}
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
                  {canDelete ? (
                    <button type="button" className="button button--secondary" onClick={() => void removeManager(r)}>
                      삭제
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {registerOpen ? (
        <div className="admin-modal-backdrop" role="presentation">
          <form
            className="admin-modal-panel"
            role="dialog"
            aria-labelledby="im-create-title"
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={(ev) => void submitCreate(ev)}
          >
            <h2 id="im-create-title" style={{ marginTop: 0 }}>
              {config.createTitle}
            </h2>
            <div className="admin-modal-content">
              {formErr ? <p className="status status--error" style={{ margin: 0 }}>{formErr}</p> : null}
              {isLossAdjusterMode ? (
                <>
                  <label className="field admin-modal-field">
                    <span className="field__label">회사명</span>
                    <input
                      className="admin-form-input"
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label className="field admin-modal-field">
                    <span className="field__label">손해사정사 이름</span>
                    <input
                      className="admin-form-input"
                      value={form.adjusterName}
                      onChange={(e) => setForm((f) => ({ ...f, adjusterName: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </label>
                </>
              ) : (
                <>
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
                    <span className="field__label">{config.entityLabel} (DB 마스터)</span>
                    <select
                      className="admin-form-input"
                      required
                      value={form.companyId || ''}
                      onChange={(e) => setForm((f) => ({ ...f, companyId: Number(e.target.value) || 0 }))}
                    >
                      <option value="">선택</option>
                      {masterChoices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
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
        <div className="admin-modal-backdrop" role="presentation">
          <form
            className="admin-modal-panel"
            role="dialog"
            aria-labelledby="im-edit-title"
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={(ev) => void submitEdit(ev)}
          >
            <h2 id="im-edit-title" style={{ marginTop: 0 }}>
              {config.editTitle}
            </h2>
            <div className="admin-modal-content">
              {formErr ? <p className="status status--error" style={{ margin: 0 }}>{formErr}</p> : null}
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-sub)' }}>
                비밀번호는 비워 두면 기존 값이 유지되며, 입력한 경우에만 변경됩니다.
              </p>
              {isLossAdjusterMode ? (
                <>
                  <label className="field admin-modal-field">
                    <span className="field__label">회사명</span>
                    <input
                      className="admin-form-input"
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label className="field admin-modal-field">
                    <span className="field__label">손해사정사 이름</span>
                    <input
                      className="admin-form-input"
                      value={form.adjusterName}
                      onChange={(e) => setForm((f) => ({ ...f, adjusterName: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </label>
                </>
              ) : (
                <>
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
                    <span className="field__label">{config.entityLabel} (DB 마스터)</span>
                    <select
                      className="admin-form-input"
                      required
                      value={form.companyId || ''}
                      onChange={(e) => setForm((f) => ({ ...f, companyId: Number(e.target.value) || 0 }))}
                    >
                      <option value="">선택</option>
                      {masterChoices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
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
