import { useCallback, useEffect, useState } from 'react'
import { FormButton, FormTextarea } from '../../../components/form'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'
import DeleteConfirmModal, { MemoDeleteConfirmFooter } from './DeleteConfirmModal'

type MobileMemoFullScreenModalProps = {
  open: boolean
  noteId: string | null
  initialContent: string
  onClose: () => void
  onSaved?: () => void
}

export function MobileMemoFullScreenModal({
  open,
  noteId,
  initialContent,
  onClose,
  onSaved,
}: MobileMemoFullScreenModalProps) {
  const { addNote, commitNoteContent, deleteNote } = useMemoWorkspace()
  const [draft, setDraft] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const isCreate = noteId == null

  useEffect(() => {
    if (open) {
      setDraft(initialContent)
    }
  }, [initialContent, noteId, open])

  const isDirty = draft !== initialContent

  const requestClose = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm('변경사항이 저장되지 않았습니다. 닫으시겠습니까?')
      if (!ok) {
        return
      }
    }
    onClose()
  }, [isDirty, onClose])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (isCreate) {
        const created = await addNote({ content: draft })
        if (!created) {
          return
        }
      } else {
        const ok = await commitNoteContent(noteId, draft)
        if (!ok) {
          return
        }
      }
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }, [addNote, commitNoteContent, draft, isCreate, noteId, onClose, onSaved])

  const handleConfirmDelete = useCallback(async () => {
    if (!noteId) {
      return
    }
    setDeleteSubmitting(true)
    try {
      await deleteNote(noteId)
      setDeleteOpen(false)
      onSaved?.()
      onClose()
    } finally {
      setDeleteSubmitting(false)
    }
  }, [deleteNote, noteId, onClose, onSaved])

  if (!open) {
    return null
  }

  return (
    <>
      <div className="mobile-memo-fullscreen-modal" role="dialog" aria-modal="true" aria-label="메모 편집">
        <header className="mobile-memo-fullscreen-modal__header">
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={requestClose}>
            닫기
          </FormButton>
          <h2 className="mobile-memo-fullscreen-modal__title">스티커 메모</h2>
          <FormButton
            htmlType="button"
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            저장
          </FormButton>
        </header>
        <div className="mobile-memo-fullscreen-modal__body">
          <FormTextarea
            className="mobile-memo-fullscreen-modal__textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메모 내용을 입력하세요"
            rows={16}
            autoFocus
          />
        </div>
        {!isCreate ? (
          <footer className="mobile-memo-fullscreen-modal__footer">
            <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}>
              삭제
            </FormButton>
          </footer>
        ) : null}
      </div>

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="메모 삭제"
        footer={
          <MemoDeleteConfirmFooter
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => void handleConfirmDelete()}
            submitting={deleteSubmitting}
          />
        }
      >
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          이 메모를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
        </p>
      </DeleteConfirmModal>
    </>
  )
}
