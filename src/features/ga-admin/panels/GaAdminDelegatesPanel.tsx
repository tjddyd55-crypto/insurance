import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { FormDialog } from '../../../components/dialog'
import { EmptyState, LoadingState, StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput, FormSelect } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import {
  createGaAdminDelegate,
  listGaAdminDelegates,
  patchGaAdminDelegate,
  type EntityStatus,
  type GaAdminDelegateRow,
} from '../../auth/authApi'
import { formatKstDateDisplay } from '../../../utils/displayDateTime'
import { AdminFormDialogFooter } from '../components/AdminFormDialogFooter'

const CREATE_FORM_ID = 'ga-admin-delegate-create'
const EDIT_FORM_ID = 'ga-admin-delegate-edit'

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

export default function GaAdminDelegatesPanel() {
  const { token, user } = useAuth()
  const [rows, setRows] = useState<GaAdminDelegateRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const [editing, setEditing] = useState<GaAdminDelegateRow | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editStatus, setEditStatus] = useState<EntityStatus>('active')
  const [editName, setEditName] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'GA_ADMIN') {
      return
    }
    setLoadError('')
    setIsLoading(true)
    try {
      const list = await listGaAdminDelegates(token)
      setRows(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const staffRows = rows.filter((r) => r.role === 'GA_STAFF')

  function closeCreate() {
    if (createBusy) return
    setCreateOpen(false)
    setCreateErr('')
  }

  async function onCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token?.trim()) return
    setCreateErr('')
    const username = createUsername.trim()
    if (!username) {
      setCreateErr('로그인 ID를 입력해 주세요.')
      return
    }
    if (!createPassword.trim()) {
      setCreateErr('비밀번호를 입력해 주세요.')
      return
    }
    setCreateBusy(true)
    try {
      await createGaAdminDelegate(token, {
        username,
        password: createPassword,
        name: createName.trim(),
      })
      setCreateOpen(false)
      setCreateUsername('')
      setCreatePassword('')
      setCreateName('')
      await load()
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '생성에 실패했습니다.')
    } finally {
      setCreateBusy(false)
    }
  }

  function openEdit(row: GaAdminDelegateRow) {
    if (row.role !== 'GA_STAFF') return
    setEditing(row)
    setEditUsername(row.username)
    setEditPassword('')
    setEditStatus(normalizeUserStatus(row.status))
    setEditName(row.displayName ?? '')
    setEditErr('')
  }

  function closeEdit() {
    if (editBusy) return
    setEditing(null)
    setEditErr('')
  }

  async function onEditSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token?.trim() || !editing) return
    setEditErr('')
    setEditBusy(true)
    try {
      await patchGaAdminDelegate(token, editing.id, {
        username: editUsername.trim(),
        password: editPassword.trim() !== '' ? editPassword : undefined,
        status: editStatus,
        displayName: editName.trim(),
      })
      setEditing(null)
      await load()
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setEditBusy(false)
    }
  }

  return (
    <div className="admin-data-card">
      <div className="admin-data-card__head">
        <h2 className="admin-data-card__title">관리자 · STEP</h2>
        <div className="admin-data-card__actions">
          <FormButton htmlType="button" variant="primary" onClick={() => setCreateOpen(true)}>
            STEP 추가
          </FormButton>
        </div>
      </div>
      {loadError ? <StatusMessage tone="error" message={loadError} /> : null}
      {isLoading ? (
        <LoadingState message="불러오는 중…" />
      ) : staffRows.length === 0 ? (
        <EmptyState message="등록된 STEP이 없습니다. STEP 추가로 실무 계정을 발급하세요." />
      ) : (
        <div className="admin-data-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th>역할</th>
                <th>상태</th>
                <th>최근 로그인</th>
                <th className="admin-table-cell--actions">관리</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName || '—'}</td>
                  <td>{row.username}</td>
                  <td>{row.role}</td>
                  <td>{row.statusLabel ?? row.status}</td>
                  <td>{formatKstDateDisplay(row.last_login_at ?? '', '—')}</td>
                  <td className="admin-table-cell--actions">
                    <div className="admin-table-actions">
                      <FormButton htmlType="button" variant="secondary" onClick={() => openEdit(row)}>
                        수정
                      </FormButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDialog
        open={createOpen}
        title="STEP(GA_STAFF) 생성"
        onClose={closeCreate}
        disableClose={createBusy}
        footer={
          <AdminFormDialogFooter
            formId={CREATE_FORM_ID}
            onCancel={closeCreate}
            submitLabel="생성"
            busy={createBusy}
          />
        }
      >
        <form id={CREATE_FORM_ID} className="form-dialog__form" onSubmit={onCreateSubmit}>
          <FieldWrapper label="이름">
            <FormInput value={createName} onChange={(e) => setCreateName(e.target.value)} autoComplete="name" />
          </FieldWrapper>
          <FieldWrapper label="로그인 ID" required>
            <FormInput value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} autoComplete="off" />
          </FieldWrapper>
          <FieldWrapper label="비밀번호" required>
            <FormInput
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              autoComplete="new-password"
            />
          </FieldWrapper>
          {createErr ? <StatusMessage tone="error" message={createErr} /> : null}
        </form>
      </FormDialog>

      <FormDialog
        open={editing != null}
        title="STEP 수정"
        onClose={closeEdit}
        disableClose={editBusy}
        footer={
          <AdminFormDialogFooter formId={EDIT_FORM_ID} onCancel={closeEdit} submitLabel="저장" busy={editBusy} />
        }
      >
        {editing ? (
          <form id={EDIT_FORM_ID} className="form-dialog__form" onSubmit={onEditSubmit}>
            <FieldWrapper label="이름">
              <FormInput value={editName} onChange={(e) => setEditName(e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="로그인 ID">
              <FormInput value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="비밀번호 (변경 시만 입력)">
              <FormInput
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FieldWrapper>
            <FieldWrapper label="상태">
              <FormSelect value={editStatus} onChange={(e) => setEditStatus(e.target.value as EntityStatus)}>
                {STATUS_SELECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FormSelect>
            </FieldWrapper>
            {editErr ? <StatusMessage tone="error" message={editErr} /> : null}
          </form>
        ) : null}
      </FormDialog>
    </div>
  )
}
