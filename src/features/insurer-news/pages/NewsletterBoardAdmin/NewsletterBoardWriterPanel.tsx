import { useCallback, useEffect, useState } from 'react'
import { FormButton } from '../../../../components/form'
import { useConfirmDialog } from '../../../../components/dialog'
import type { NewsletterBoard } from '../../types'
import {
  checkBoardWriterLoginId,
  createBoardWriterAccountForBoard,
  listBoardWriterAccountsForBoard,
  setBoardWriterAccountStatus,
  updateBoardWriterAccountForBoard,
  type PublicBoardWriterAccount,
} from '../../services/publicBoardWriter.service'
import {
  WriterAccountFormDialog,
  type WriterAccountFormState,
} from './WriterAccountFormDialog'
import { WriterAccountTable } from './WriterAccountTable'

type NewsletterBoardWriterPanelProps = {
  board: NewsletterBoard
  token: string
  role: string
  busy: boolean
  onBusyChange: (busy: boolean) => void
}

const emptyForm = (): WriterAccountFormState => ({
  organizationName: '',
  authorName: '',
  loginId: '',
  password: '',
  passwordConfirm: '',
  isActive: true,
})

export function NewsletterBoardWriterPanel({
  board,
  token,
  role,
  busy,
  onBusyChange,
}: NewsletterBoardWriterPanelProps) {
  const [writers, setWriters] = useState<PublicBoardWriterAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState<PublicBoardWriterAccount | null>(null)
  const [form, setForm] = useState<WriterAccountFormState>(emptyForm())
  const [formError, setFormError] = useState('')
  const [loginIdAvailability, setLoginIdAvailability] = useState<{ available: boolean } | null>(null)
  const [checkMessage, setCheckMessage] = useState('')
  const { confirm, confirmDialog } = useConfirmDialog()

  const loadWriters = useCallback(async () => {
    if (!token.trim()) {
      setWriters([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setWriters(await listBoardWriterAccountsForBoard(token, role, board.id))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '작성자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [board.id, role, token])

  useEffect(() => {
    void loadWriters()
  }, [loadWriters])

  useEffect(() => {
    setWriters([])
    setLoading(true)
    setRegisterOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setLoginIdAvailability(null)
    setCheckMessage('')
    setError('')
  }, [board.id])

  const closeModals = () => {
    if (busy) {
      return
    }
    setRegisterOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setLoginIdAvailability(null)
    setCheckMessage('')
  }

  const openRegister = () => {
    setFormError('')
    setEditing(null)
    setForm(emptyForm())
    setLoginIdAvailability(null)
    setCheckMessage('')
    setRegisterOpen(true)
  }

  const openEdit = (writer: PublicBoardWriterAccount) => {
    setFormError('')
    setRegisterOpen(false)
    setEditing(writer)
    setForm({
      organizationName: String(writer.organizationName ?? '').trim(),
      authorName: String(writer.name ?? '').trim() || writer.loginId,
      loginId: writer.loginId,
      password: '',
      passwordConfirm: '',
      isActive: writer.isActive,
    })
    setLoginIdAvailability(null)
    setCheckMessage('')
  }

  const handleLoginIdChange = (value: string) => {
    setForm((prev) => ({ ...prev, loginId: value }))
    setLoginIdAvailability(null)
    setCheckMessage('')
  }

  const handleCheckLoginId = () => {
    if (!token.trim() || busy || !form.loginId.trim()) {
      return
    }
    void (async () => {
      onBusyChange(true)
      setFormError('')
      try {
        const result = await checkBoardWriterLoginId(token, role, board.id, form.loginId.trim())
        const sameAsEditing =
          editing != null && form.loginId.trim().toLowerCase() === editing.loginId.trim().toLowerCase()
        const available = sameAsEditing || result.available
        setLoginIdAvailability({ available })
        setCheckMessage(available ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.')
      } catch (e) {
        setLoginIdAvailability(null)
        setFormError(e instanceof Error ? e.message : '아이디 중복 확인에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const validateForm = (mode: 'create' | 'edit'): string | null => {
    if (!form.organizationName.trim()) {
      return '소속명을 입력해 주세요.'
    }
    if (!form.authorName.trim()) {
      return '작성자 이름을 입력해 주세요.'
    }
    if (!form.loginId.trim() || form.loginId.trim().length < 3) {
      return '아이디는 3자 이상 입력해 주세요.'
    }
    if (mode === 'create') {
      if (!form.password.trim() || form.password.trim().length < 8) {
        return '비밀번호는 8자 이상 입력해 주세요.'
      }
      if (form.password !== form.passwordConfirm) {
        return '비밀번호 확인이 일치하지 않습니다.'
      }
      if (loginIdAvailability?.available !== true) {
        return '아이디 중복 확인을 완료해 주세요.'
      }
    } else {
      const loginIdChanged =
        editing != null &&
        form.loginId.trim().toLowerCase() !== editing.loginId.trim().toLowerCase()
      if (loginIdChanged && loginIdAvailability?.available !== true) {
        return '아이디 중복 확인을 완료해 주세요.'
      }
      if (form.password.trim() || form.passwordConfirm.trim()) {
        if (form.password.trim().length < 8) {
          return '비밀번호는 8자 이상 입력해 주세요.'
        }
        if (form.password !== form.passwordConfirm) {
          return '비밀번호 확인이 일치하지 않습니다.'
        }
      }
    }
    return null
  }

  const handleCreate = () => {
    if (!token.trim() || busy) {
      return
    }
    const validationError = validateForm('create')
    if (validationError) {
      setFormError(validationError)
      return
    }
    void (async () => {
      onBusyChange(true)
      setFormError('')
      try {
        await createBoardWriterAccountForBoard(token, role, board.id, {
          organizationName: form.organizationName.trim(),
          displayName: form.authorName.trim(),
          loginId: form.loginId.trim(),
          password: form.password.trim(),
          isActive: form.isActive,
        })
        closeModals()
        await loadWriters()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : '작성자 계정 등록에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const handleUpdate = () => {
    if (!token.trim() || !editing || busy) {
      return
    }
    const validationError = validateForm('edit')
    if (validationError) {
      setFormError(validationError)
      return
    }
    void (async () => {
      onBusyChange(true)
      setFormError('')
      try {
        await updateBoardWriterAccountForBoard(token, role, board.id, editing.id, {
          organizationName: form.organizationName.trim(),
          displayName: form.authorName.trim(),
          loginId: form.loginId.trim(),
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
          isActive: form.isActive,
        })
        closeModals()
        await loadWriters()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : '작성자 계정 수정에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const handleDisable = (writer: PublicBoardWriterAccount) => {
    if (!token.trim() || busy) {
      return
    }
    void (async () => {
      const authorLabel = writer.name?.trim() || writer.loginId
      const multiBoard = (writer.allowedBoardIds?.length ?? 0) > 1
      const ok = await confirm({
        title: multiBoard ? '이 소식지 작성 권한을 제거할까요?' : '작성자 계정을 사용 중지할까요?',
        message: multiBoard
          ? `${authorLabel} 계정의 이 소식지 작성 권한만 제거됩니다. 다른 소식지 권한과 계정 상태는 유지됩니다.`
          : `${authorLabel} 계정은 더 이상 로그인하거나 게시글을 등록할 수 없습니다. 기존 작성글은 삭제되지 않습니다.`,
        tone: 'danger',
        confirmLabel: multiBoard ? '권한 제거' : '사용 중지',
        cancelLabel: '취소',
      })
      if (!ok) {
        return
      }
      onBusyChange(true)
      setError('')
      try {
        await setBoardWriterAccountStatus(token, role, board.id, writer.id, false)
        await loadWriters()
      } catch (e) {
        setError(e instanceof Error ? e.message : '사용 중지에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  const handleEnable = (writer: PublicBoardWriterAccount) => {
    if (!token.trim() || busy) {
      return
    }
    void (async () => {
      const authorLabel = writer.name?.trim() || writer.loginId
      const ok = await confirm({
        title: '작성자 계정을 다시 사용할까요?',
        message: `${authorLabel} 계정으로 다시 로그인하고 게시글을 등록할 수 있습니다.`,
        confirmLabel: '다시 사용',
        cancelLabel: '취소',
      })
      if (!ok) {
        return
      }
      onBusyChange(true)
      setError('')
      try {
        await setBoardWriterAccountStatus(token, role, board.id, writer.id, true)
        await loadWriters()
      } catch (e) {
        setError(e instanceof Error ? e.message : '다시 사용에 실패했습니다.')
      } finally {
        onBusyChange(false)
      }
    })()
  }

  return (
    <div className="newsletter-board-writer-panel admin-user-management">
      <div className="newsletter-board-writer-panel__header">
        <h4 className="newsletter-board-writer-panel__title">{board.label} 작성자 관리</h4>
        <p className="newsletter-board-writer-panel__help">
          게시판 작성자가 사용할 로그인 계정(아이디·비밀번호)을 관리합니다.
        </p>
      </div>

      <section className="admin-toolbar card auth-card newsletter-board-writer-panel__toolbar">
        <FormButton
          htmlType="button"
          variant="primary"
          className="button button--primary"
          disabled={busy}
          onClick={openRegister}
        >
          등록
        </FormButton>
      </section>

      <div className="card newsletter-board-writer-panel__list-card">
        {loading ? <p className="newsletter-board-writer-panel__muted">불러오는 중...</p> : null}
        {!loading && writers.length === 0 ? (
          <div className="newsletter-board-writer-panel__empty">
            <p className="newsletter-board-writer-panel__empty-title">등록된 작성자가 없습니다.</p>
            <p className="newsletter-board-writer-panel__muted">
              이 소식지에 글을 등록할 작성자 계정을 추가해 주세요.
            </p>
          </div>
        ) : null}
        {!loading && writers.length > 0 ? (
          <WriterAccountTable
            writers={writers}
            busy={busy}
            onEdit={openEdit}
            onDisable={handleDisable}
            onEnable={handleEnable}
          />
        ) : null}
      </div>

      {error ? <p className="status status--error">{error}</p> : null}

      <WriterAccountFormDialog
        mode="create"
        open={registerOpen}
        busy={busy}
        form={form}
        formError={formError}
        checkMessage={checkMessage}
        loginIdAvailable={loginIdAvailability?.available ?? null}
        onClose={closeModals}
        onChangeOrganizationName={(value) => setForm((prev) => ({ ...prev, organizationName: value }))}
        onChangeAuthorName={(value) => setForm((prev) => ({ ...prev, authorName: value }))}
        onChangeLoginId={handleLoginIdChange}
        onChangePassword={(value) => setForm((prev) => ({ ...prev, password: value }))}
        onChangePasswordConfirm={(value) => setForm((prev) => ({ ...prev, passwordConfirm: value }))}
        onChangeIsActive={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
        onCheckLoginId={handleCheckLoginId}
        onSubmit={handleCreate}
      />

      <WriterAccountFormDialog
        mode="edit"
        open={editing != null}
        busy={busy}
        form={form}
        formError={formError}
        checkMessage={checkMessage}
        loginIdAvailable={loginIdAvailability?.available ?? null}
        onClose={closeModals}
        onChangeOrganizationName={(value) => setForm((prev) => ({ ...prev, organizationName: value }))}
        onChangeAuthorName={(value) => setForm((prev) => ({ ...prev, authorName: value }))}
        onChangeLoginId={handleLoginIdChange}
        onChangePassword={(value) => setForm((prev) => ({ ...prev, password: value }))}
        onChangePasswordConfirm={(value) => setForm((prev) => ({ ...prev, passwordConfirm: value }))}
        onChangeIsActive={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
        onCheckLoginId={handleCheckLoginId}
        onSubmit={handleUpdate}
      />

      {confirmDialog}
    </div>
  )
}
