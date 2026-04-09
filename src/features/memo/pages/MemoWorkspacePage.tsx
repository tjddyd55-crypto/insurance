import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { useAuth } from '../../auth/AuthProvider'
import DeleteConfirmModal, {
  MemoDeleteConfirmFooter,
} from '../components/DeleteConfirmModal'
import StickyNote from '../components/StickyNote'
import { useNotes } from '../hooks/useNotes'

export default function MemoWorkspacePage() {
  const { token } = useAuth()
  const {
    notes,
    notesLoading,
    addNote,
    updateNote,
    updatePosition,
    updateSize,
    updateFontSize,
    deleteNote,
    bringToFront,
  } = useNotes()
  const containerRef = useRef<HTMLDivElement>(null)
  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0)),
    [notes],
  )

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const handleActivate = useCallback(
    (id: string) => {
      bringToFront(id)
      setActiveNoteId(id)
    },
    [bringToFront],
  )

  const handleTextareaFocus = useCallback(
    (id: string) => {
      bringToFront(id)
      setActiveNoteId(id)
      setEditingNoteId(id)
    },
    [bringToFront],
  )

  const handleTextareaBlur = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  const handleDragStart = useCallback(
    (id: string) => {
      setEditingNoteId(null)
      setDraggingNoteId(id)
      bringToFront(id)
      setActiveNoteId(id)
    },
    [bringToFront],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingNoteId(null)
  }, [])

  const handleRequestDelete = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  const closeDeleteModal = useCallback(() => {
    if (deleteSubmitting) {
      return
    }
    setPendingDeleteId(null)
  }, [deleteSubmitting])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId || deleteSubmitting) {
      return
    }
    setDeleteSubmitting(true)
    try {
      const id = pendingDeleteId
      await deleteNote(id)
      setActiveNoteId((prev) => (prev === id ? null : prev))
      setEditingNoteId((prev) => (prev === id ? null : prev))
      setDraggingNoteId((prev) => (prev === id ? null : prev))
      setPendingDeleteId(null)
    } finally {
      setDeleteSubmitting(false)
    }
  }, [pendingDeleteId, deleteSubmitting, deleteNote])

  if (!token?.trim()) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-bold">메모 워크스페이스</h1>
        <p className="text-sm text-gray-400 mt-2">로그인이 필요합니다.</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">메모 워크스페이스</h1>
          <p className="text-sm text-gray-400">메모 기능 개발 영역</p>
        </div>
        <Button type="button" variant="primary" className="shrink-0 min-h-10 px-4" onClick={addNote}>
          + 메모 추가
        </Button>
      </div>

      <div className="memo-workspace mt-6 min-h-[70vh] w-full rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-card)]/30">
        <div ref={containerRef} className="relative h-full w-full">
          {notesLoading && notes.length === 0 ? (
            <div className="memo-workspace__loading flex items-center justify-center px-4 py-16 text-sm text-[var(--text-muted)]">
              메모를 불러오는 중…
            </div>
          ) : notes.length === 0 ? (
            <div className="memo-workspace__empty">
              <p className="text-base font-medium text-[var(--text-primary)]">메모가 아직 없습니다</p>
              <p className="text-sm text-[var(--text-muted)]">
                메모 추가 버튼을 눌러 첫 메모를 만들어보세요
              </p>
            </div>
          ) : (
            orderedNotes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                isEditing={editingNoteId === note.id}
                isDragging={draggingNoteId === note.id}
                onChange={(content) => updateNote(note.id, content)}
                onPositionChange={updatePosition}
                onSizeChange={updateSize}
                onFontSizeChange={updateFontSize}
                containerRef={containerRef}
                onDeleteRequest={handleRequestDelete}
                onActivate={handleActivate}
                onTextareaFocus={handleTextareaFocus}
                onTextareaBlur={handleTextareaBlur}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))
          )}
        </div>
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
    </div>
  )
}
