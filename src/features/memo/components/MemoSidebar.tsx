import type { Note } from '../types/memo.types'

type Props = {
  notes: Note[]
  activeNoteId: string | null
  editingNoteId: string | null
  isOpen: boolean
  onToggle: () => void
  onSelectNote: (id: string) => void
  onAutoArrange: () => void
}

export default function MemoSidebar({
  notes,
  activeNoteId,
  editingNoteId,
  isOpen,
  onToggle,
  onSelectNote,
  onAutoArrange,
}: Props) {
  return (
    <div className="memo-sidebar__inner">
      <div className="memo-sidebar__header">
        <span className="memo-sidebar__title">메모 목록</span>
        <div className="memo-sidebar__header-actions">
          {isOpen ? (
            <button type="button" className="memo-sidebar__arrange" onClick={onAutoArrange}>
              정리하기
            </button>
          ) : null}
          <button type="button" className="memo-sidebar__toggle" onClick={onToggle}>
            {isOpen ? '◀' : '▶'}
          </button>
        </div>
      </div>

      <div className="memo-sidebar__list">
        {notes.map((note) => {
          const preview = note.content?.trim().slice(0, 20) || '내용 없음'
          const isActive = note.id === activeNoteId
          const isEditing = note.id === editingNoteId
          return (
            <div
              key={note.id}
              className={`memo-list-item ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`.trim()}
              onClick={(e) => {
                e.stopPropagation()
                onSelectNote(note.id)
              }}
            >
              {preview}
            </div>
          )
        })}
      </div>
    </div>
  )
}
