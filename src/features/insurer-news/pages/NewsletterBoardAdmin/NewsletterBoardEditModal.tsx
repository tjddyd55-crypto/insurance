import { useEffect, useMemo, useState } from 'react'
import { BaseDialog } from '../../../../components/dialog'
import { DialogActions } from '../../../../components/dialog/DialogActions'
import { FormButton, FormInput } from '../../../../components/form'
import type { NewsletterBoard } from '../../types'

export type NewsletterBoardEditModalProps = {
  board: NewsletterBoard | null
  open: boolean
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (input: { label: string; description: string }) => void
  onRequestClose: () => void
}

function boardEditTitle(board: NewsletterBoard): string {
  if (board.boardScope === 'global' || board.contentScope === 'global') {
    return '공용 소식지 수정'
  }
  return 'GA전용 소식지 수정'
}

export function NewsletterBoardEditModal({
  board,
  open,
  busy,
  error,
  onClose,
  onSubmit,
  onRequestClose,
}: NewsletterBoardEditModalProps) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open || !board) {
      return
    }
    setLabel(board.label)
    setDescription(board.description ?? '')
  }, [board, open])

  const isDirty = useMemo(() => {
    if (!board) {
      return false
    }
    return label.trim() !== board.label.trim() || description.trim() !== String(board.description ?? '').trim()
  }, [board, description, label])

  const handleRequestClose = () => {
    if (busy) {
      return
    }
    if (isDirty) {
      onRequestClose()
      return
    }
    onClose()
  }

  if (!board) {
    return null
  }

  return (
    <BaseDialog
      open={open}
      onClose={handleRequestClose}
      ariaLabel={boardEditTitle(board)}
      panelClassName="newsletter-board-admin-page__edit-modal"
      closeOnBackdrop={false}
      closeOnEsc
      onEscapeRequest={handleRequestClose}
      usePortal
    >
      <h2 className="newsletter-board-admin-page__edit-modal-title">{boardEditTitle(board)}</h2>
      <p className="newsletter-board-admin-page__help">
        경로(`/portal/boards/{board.slug}`)는 기존 게시글·링크 보호를 위해 변경하지 않습니다.
      </p>
      <div className="newsletter-board-admin-page__edit-modal-body">
        <label className="form-field">
          <span className="form-label">소식지명</span>
          <FormInput value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} autoFocus />
        </label>
        <label className="form-field">
          <span className="form-label">설명 (선택)</span>
          <FormInput value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <p className="newsletter-board-admin-page__help">현재 경로: {`/portal/boards/${board.slug}`}</p>
        {error ? (
          <p className="status status--error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <DialogActions>
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={handleRequestClose}>
          취소
        </FormButton>
        <FormButton
          htmlType="button"
          variant="primary"
          disabled={busy || !label.trim()}
          loading={busy}
          onClick={() => onSubmit({ label: label.trim(), description: description.trim() })}
        >
          저장
        </FormButton>
      </DialogActions>
    </BaseDialog>
  )
}
