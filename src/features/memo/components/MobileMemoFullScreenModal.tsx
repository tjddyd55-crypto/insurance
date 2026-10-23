import { useCallback, useEffect, useRef, useState } from 'react'
import { FormButton, FormTextarea } from '../../../components/form'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'
import DeleteConfirmModal, { MemoDeleteConfirmFooter } from './DeleteConfirmModal'

const MOBILE_MEMO_EDITOR_BACK_TRAP = '__MOBILE_MEMO_EDITOR_BACK_TRAP__'

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
  const openRef = useRef(open)
  const deleteOpenRef = useRef(deleteOpen)
  const isDirtyRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const historyBackArmedRef = useRef(false)

  openRef.current = open
  deleteOpenRef.current = deleteOpen
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setDraft(initialContent)
    }
  }, [initialContent, noteId, open])

  const isDirty = draft !== initialContent
  isDirtyRef.current = isDirty

  const closeEditor = useCallback(() => {
    if (isDirtyRef.current) {
      const ok = window.confirm('변경사항이 저장되지 않았습니다. 닫으시겠습니까?')
      if (!ok) {
        return
      }
    }
    onCloseRef.current()
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    window.history.pushState({ [MOBILE_MEMO_EDITOR_BACK_TRAP]: true }, '', window.location.href)
    historyBackArmedRef.current = true

    const rearmHistoryBackTrap = () => {
      window.queueMicrotask(() => {
        if (!openRef.current) {
          return
        }
        window.history.pushState({ [MOBILE_MEMO_EDITOR_BACK_TRAP]: true }, '', window.location.href)
        historyBackArmedRef.current = true
      })
    }

    const onPopState = () => {
      if (!openRef.current) {
        return
      }

      if (deleteOpenRef.current) {
        setDeleteOpen(false)
        rearmHistoryBackTrap()
        return
      }

      if (isDirtyRef.current) {
        const ok = window.confirm('변경사항이 저장되지 않았습니다. 닫으시겠습니까?')
        if (!ok) {
          rearmHistoryBackTrap()
          return
        }
      }

      historyBackArmedRef.current = false
      onCloseRef.current()
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      if (!historyBackArmedRef.current) {
        return
      }
      historyBackArmedRef.current = false
      try {
        const currentState =
          typeof window.history.state === 'object' && window.history.state != null
            ? { ...(window.history.state as Record<string, unknown>) }
            : {}
        delete currentState[MOBILE_MEMO_EDITOR_BACK_TRAP]
        window.history.replaceState(currentState, '', window.location.href)
      } catch {
        // no-op
      }
    }
  }, [open])

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
      <div className="mobile-memo-fullscreen-modal mobile-memo-editor" role="dialog" aria-modal="true" aria-label="메모 편집">
        <header className="mobile-memo-fullscreen-modal__header mobile-memo-editor__header">
          <h2 className="mobile-memo-fullscreen-modal__title mobile-memo-editor__title">스티커 메모</h2>
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={closeEditor}>
            닫기
          </FormButton>
        </header>
        <div className="mobile-memo-fullscreen-modal__body mobile-memo-editor__body">
          <FormTextarea
            className="mobile-memo-fullscreen-modal__textarea mobile-memo-editor__textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메모 내용을 입력하세요"
            rows={16}
            autoFocus
          />
        </div>
        <footer className="mobile-memo-fullscreen-modal__footer mobile-memo-editor__footer">
          {!isCreate ? (
            <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}>
              삭제
            </FormButton>
          ) : null}
          <FormButton
            htmlType="button"
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            저장
          </FormButton>
        </footer>
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
          메모를 삭제하시겠습니까?
          <br />
          삭제한 메모는 복구할 수 없습니다.
        </p>
      </DeleteConfirmModal>
    </>
  )
}
