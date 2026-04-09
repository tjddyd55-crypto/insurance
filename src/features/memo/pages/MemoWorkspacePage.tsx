import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { useAuth } from '../../auth/AuthProvider'
import DeleteConfirmModal, {
  MemoDeleteConfirmFooter,
} from '../components/DeleteConfirmModal'
import MemoSidebar from '../components/MemoSidebar'
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
  const workspaceRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const activeNoteIdRef = useRef<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId
  }, [activeNoteId])

  const getWorkspaceBounds = useCallback(() => {
    const el = workspaceRef.current
    if (!el) {
      return { width: 0, height: 0 }
    }
    const rect = el.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }, [])

  useEffect(() => {
    if (notes.length === 0 || draggingNoteId != null) {
      return
    }
    const { width: workspaceWidth, height: workspaceHeight } = getWorkspaceBounds()
    if (workspaceWidth === 0 || workspaceHeight === 0) {
      return
    }
    notes.forEach((note) => {
      const noteWidth = Math.max(200, Number(note.width) || 200)
      const noteHeight = Math.max(150, Number(note.height) || 160)
      const maxX = Math.max(0, workspaceWidth - noteWidth)
      const maxY = Math.max(0, workspaceHeight - noteHeight)

      const fixedX = Math.max(0, Math.min(note.x, maxX))
      const fixedY = Math.max(0, Math.min(note.y, maxY))

      if (fixedX !== note.x || fixedY !== note.y) {
        updatePosition(note.id, fixedX, fixedY)
      }
    })
  }, [draggingNoteId, getWorkspaceBounds, notes, updatePosition])

  const promoteNote = useCallback(
    (id: string) => {
      if (activeNoteIdRef.current === id) {
        setActiveNoteId(id)
        return
      }

      bringToFront(id)
      activeNoteIdRef.current = id
      setActiveNoteId(id)
    },
    [bringToFront],
  )

  const handleRootClick = useCallback(
    (id: string) => {
      promoteNote(id)
    },
    [promoteNote],
  )

  const handleActivate = useCallback((id: string) => {
    activeNoteIdRef.current = id
    setActiveNoteId(id)
  }, [])

  const handleTextareaFocus = useCallback(
    (id: string) => {
      promoteNote(id)
      setEditingNoteId(id)
    },
    [promoteNote],
  )

  const handleTextareaBlur = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  const handleDragStart = useCallback(
    (id: string) => {
      setEditingNoteId(null)
      promoteNote(id)
      setDraggingNoteId(id)
    },
    [promoteNote],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingNoteId(null)
  }, [])

  const handleRequestDelete = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  const handleSidebarSelectNote = useCallback(
    (id: string) => {
      activeNoteIdRef.current = id
      setActiveNoteId(id)
    },
    [],
  )

  const handleCanvasClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      activeNoteIdRef.current = null
      setActiveNoteId(null)
    }
  }, [])

  const handleAutoArrange = useCallback(() => {
    const gap = 20
    const startX = 20
    const startY = 20
    let x = startX
    let y = startY

    const { width: workspaceWidth } = getWorkspaceBounds()
    if (workspaceWidth === 0) {
      return
    }

    notes.forEach((note) => {
      const noteWidth = Math.max(200, Number(note.width) || 200)
      const noteHeight = Math.max(150, Number(note.height) || 160)
      updatePosition(note.id, x, y)
      x += noteWidth + gap
      if (x > workspaceWidth - noteWidth) {
        x = startX
        y += noteHeight + gap
      }
    })
  }, [getWorkspaceBounds, notes, updatePosition])

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
      setActiveNoteId((prev) => {
        const next = prev === id ? null : prev
        activeNoteIdRef.current = next
        return next
      })
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

      <div className="memo-layout mt-6 min-h-[70vh]">
        <div className={`memo-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <MemoSidebar
            notes={notes}
            activeNoteId={activeNoteId}
            editingNoteId={editingNoteId}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((v) => !v)}
            onSelectNote={handleSidebarSelectNote}
            onAutoArrange={handleAutoArrange}
          />
        </div>

        <div className="memo-canvas" onClick={handleCanvasClick}>
          <div
            ref={workspaceRef}
            className="memo-workspace min-h-[70vh] w-full rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-card)]/30"
            onClick={handleCanvasClick}
          >
            <div ref={containerRef} className="h-full w-full" onClick={handleCanvasClick}>
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
                notes.map((note) => (
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
                    getWorkspaceBounds={getWorkspaceBounds}
                    onDeleteRequest={handleRequestDelete}
                    onRootClick={handleRootClick}
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
