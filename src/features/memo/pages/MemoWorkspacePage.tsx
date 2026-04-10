import StickyNote from '../components/StickyNote'
import DeleteConfirmModal, {
  MemoDeleteConfirmFooter,
} from '../components/DeleteConfirmModal'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'

export default function MemoWorkspacePage() {
  const {
    token,
    notes,
    notesLoading,
    updateNote,
    updatePosition,
    updateSize,
    updateFontSize,
    workspaceRef,
    containerRef,
    activeNoteId,
    editingNoteId,
    draggingNoteId,
    pendingDeleteId,
    deleteSubmitting,
    canvasHeight,
    getWorkspaceBounds,
    handleRootClick,
    handleActivate,
    handleTextareaFocus,
    handleTextareaBlur,
    handleDragStart,
    handleDragEnd,
    handleRequestDelete,
    handleCanvasClick,
    closeDeleteModal,
    confirmDelete,
    hiddenNotes,
    minimizeNote,
  } = useMemoWorkspace()

  if (!token?.trim()) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-bold">메모 워크스페이스</h1>
        <p className="text-sm text-gray-400 mt-2">로그인이 필요합니다.</p>
      </div>
    )
  }

  const visibleNotes = notes.filter((n) => !hiddenNotes[n.id])

  return (
    <>
      <div
        className="memo-canvas"
        style={canvasHeight != null ? { minHeight: canvasHeight } : undefined}
        onClick={handleCanvasClick}
      >
        <div
          ref={workspaceRef}
          className="memo-workspace memo-workspace--infinite w-full h-full min-h-full bg-transparent"
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
                  우측 하단 + 버튼으로 첫 메모를 만들어보세요
                </p>
              </div>
            ) : visibleNotes.length === 0 ? (
              <div className="memo-workspace__empty">
                <p className="text-base font-medium text-[var(--text-primary)]">캔버스에 표시된 메모가 없습니다</p>
                <p className="text-sm text-[var(--text-muted)]">
                  우측 목록에서 메모를 선택하면 다시 표시됩니다.
                </p>
              </div>
            ) : (
              visibleNotes.map((note) => (
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
                  onMinimize={minimizeNote}
                />
              ))
            )}
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
    </>
  )
}
