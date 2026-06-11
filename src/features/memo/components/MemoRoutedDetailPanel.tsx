import { useEffect, useMemo, useRef } from 'react'
import { FormButton, FormTextarea } from '../../../components/form'
import DeleteConfirmModal, {
  MemoDeleteConfirmFooter,
} from './DeleteConfirmModal'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'

/**
 * `/memo` 정식 페이지 중앙 본문 — 선택된 메모 1건 상세/편집.
 * 플로팅 캔버스(StickyNote) 대신 목록+상세 패턴을 사용한다.
 */
export function MemoRoutedDetailPanel() {
  const {
    token,
    notes,
    notesLoading,
    activeNoteId,
    editingNoteId,
    updateNote,
    handleTextareaFocus,
    handleTextareaBlur,
    handleRequestDelete,
    pendingDeleteId,
    deleteSubmitting,
    closeDeleteModal,
    confirmDelete,
  } = useMemoWorkspace()

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  )

  useEffect(() => {
    if (!editingNoteId || editingNoteId !== activeNoteId) {
      return
    }
    const el = textareaRef.current
    if (!el) {
      return
    }
    requestAnimationFrame(() => {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    })
  }, [activeNoteId, editingNoteId])

  if (!token?.trim()) {
    return (
      <div className="memo-routed-detail memo-routed-detail--login">
        <p className="memo-routed-detail__hint">로그인이 필요합니다.</p>
      </div>
    )
  }

  if (notesLoading && notes.length === 0) {
    return (
      <div className="memo-routed-detail memo-routed-detail--loading">
        <p className="memo-routed-detail__hint">메모를 불러오는 중…</p>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="memo-routed-detail memo-routed-detail--empty">
        <p className="memo-routed-detail__empty-title">메모가 아직 없습니다</p>
        <p className="memo-routed-detail__empty-hint">
          {"상단의 '메모 추가' 버튼으로 첫 메모를 작성해 보세요."}
        </p>
      </div>
    )
  }

  if (!activeNote) {
    return (
      <div className="memo-routed-detail memo-routed-detail--empty">
        <p className="memo-routed-detail__empty-title">메모를 선택해 주세요</p>
        <p className="memo-routed-detail__empty-hint">
          오른쪽 목록에서 메모를 선택하면 이곳에 내용이 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="memo-routed-detail">
        <div className="memo-routed-detail__header">
          <span className="memo-routed-detail__label">메모 내용</span>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="memo-routed-detail__delete"
            onClick={() => handleRequestDelete(activeNote.id)}
          >
            삭제
          </FormButton>
        </div>
        <FormTextarea
          ref={textareaRef}
          className="memo-routed-detail__textarea"
          value={activeNote.content}
          onChange={(e) => updateNote(activeNote.id, e.target.value)}
          onFocus={() => handleTextareaFocus(activeNote.id)}
          onBlur={() => handleTextareaBlur()}
          placeholder="메모를 입력하세요"
          aria-label="메모 내용"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
        />
        <p className="memo-routed-detail__autosave-hint">변경 사항은 자동으로 저장됩니다.</p>
      </div>

      <DeleteConfirmModal
        open={!!pendingDeleteId}
        onClose={closeDeleteModal}
        title="메모 삭제"
        footer={
          <MemoDeleteConfirmFooter
            onCancel={closeDeleteModal}
            onConfirm={() => void confirmDelete()}
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
