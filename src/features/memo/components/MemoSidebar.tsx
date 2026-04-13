import { FormButton } from '../../../components/form'
import type { Note } from '../types/memo.types'

type Props = {
  notes: Note[]
  activeNoteId: string | null
  editingNoteId: string | null
  isOpen: boolean
  onToggle: () => void
  onSelectNote: (id: string) => void
  onAutoArrange: () => void
  /** false면 헤더 접기(◀) 버튼 숨김 — 외부 레이아웃에서 목록 토글을 쓸 때 */
  showToggle?: boolean
}

export default function MemoSidebar({
  notes,
  activeNoteId,
  editingNoteId,
  isOpen,
  onToggle,
  onSelectNote,
  onAutoArrange,
  showToggle = true,
}: Props) {
  return (
    <div className="memo-sidebar__inner">
      <div className="memo-sidebar__header">
        <span className="memo-sidebar__title">메모 목록</span>
        <div className="memo-sidebar__header-actions">
          {isOpen ? (
            <FormButton htmlType="button" className="memo-sidebar__arrange" onClick={onAutoArrange}>
              정리하기
            </FormButton>
          ) : null}
          {showToggle ? (
            <FormButton htmlType="button" className="memo-sidebar__toggle" onClick={onToggle}>
              {isOpen ? '◀' : '▶'}
            </FormButton>
          ) : null}
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
