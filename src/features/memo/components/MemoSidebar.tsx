import { FormButton } from '../../../components/form'
import type { Note } from '../types/memo.types'


type Props = {
  notes: Note[]
  hiddenNotes: Record<string, boolean>
  isOpen: boolean
  onToggle: () => void
  onSelectNote: (id: string) => void
  onAutoArrange: () => void
  showToggle?: boolean
}
export default function MemoSidebar({
  notes,
  hiddenNotes,
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
              {isOpen ? '\u25c0' : '\u25b6'}
            </FormButton>
          ) : null}
        </div>
      </div>

      <div className="memo-sidebar__list">
        {notes.map((note) => {
          const preview = note.content?.trim().slice(0, 20) || '내용 없음'
          const isExpandedOnCanvas = !hiddenNotes[note.id]
          return (
            <div
              key={note.id}
              className={`memo-list-item${isExpandedOnCanvas ? ' memo-list-item--expanded' : ''}`.trim()}
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
