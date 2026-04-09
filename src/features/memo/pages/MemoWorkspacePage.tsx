import { Button } from '../../../components/ui/Button'
import StickyNote from '../components/StickyNote'
import { useNotes } from '../hooks/useNotes'

export default function MemoWorkspacePage() {
  const { notes, addNote, updateNote } = useNotes()

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">메모 워크스페이스</h1>
          <p className="text-sm text-gray-400">메모 기능 개발 영역</p>
        </div>
        <Button type="button" variant="primary" className="shrink-0" onClick={addNote}>
          + 메모 추가
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        {notes.map((note) => (
          <StickyNote key={note.id} note={note} onChange={(content) => updateNote(note.id, content)} />
        ))}
      </div>
    </div>
  )
}
