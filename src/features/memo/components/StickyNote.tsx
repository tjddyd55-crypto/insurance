import type { Note } from '../types/memo.types'

type Props = {
  note: Note
  onChange: (content: string) => void
}

export default function StickyNote({ note, onChange }: Props) {
  return (
    <div className="bg-yellow-100 p-3 rounded shadow w-48 h-40 flex flex-col">
      <textarea
        className="w-full min-h-0 flex-1 bg-transparent border border-yellow-200/80 rounded p-1 text-sm text-[var(--text-primary)] resize-none outline-none focus:ring-1 focus:ring-amber-300/80"
        value={note.content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="메모를 입력하세요"
        aria-label="메모 내용"
      />
    </div>
  )
}
