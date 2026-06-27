import { useMemo, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'
import {
  formatMemoListUpdatedAt,
  noteUpdatedTimestamp,
  parseMemoContent,
} from '../utils/memoListDisplay'
import { MobileMemoFullScreenModal } from './MobileMemoFullScreenModal'

type MobileMemoListViewProps = {
  pageTitle?: string
}

export default function MobileMemoListView({ pageTitle = '스티커 메모' }: MobileMemoListViewProps) {
  const { token, notes, notesLoading } = useMemoWorkspace()
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorNoteId, setEditorNoteId] = useState<string | null>(null)
  const [editorInitialContent, setEditorInitialContent] = useState('')

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => noteUpdatedTimestamp(b) - noteUpdatedTimestamp(a)),
    [notes],
  )

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return sortedNotes
    }
    return sortedNotes.filter((note) => {
      const { title, preview } = parseMemoContent(note.content)
      const haystack = `${title}\n${preview}\n${note.content}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [search, sortedNotes])

  const openCreate = () => {
    setEditorNoteId(null)
    setEditorInitialContent('')
    setEditorOpen(true)
  }

  const openEdit = (noteId: string, content: string) => {
    setEditorNoteId(noteId)
    setEditorInitialContent(content)
    setEditorOpen(true)
  }

  if (!token?.trim()) {
    return (
      <div className="mobile-memo-list-page">
        <p className="mobile-memo-list-page__muted">로그인이 필요합니다.</p>
      </div>
    )
  }

  return (
    <div className="mobile-memo-list-page">
      <header className="mobile-memo-list-page__header">
        <h1 className="mobile-memo-list-page__title">{pageTitle}</h1>
      </header>

      <div className="mobile-memo-list-page__toolbar">
        <FormInput
          className="mobile-memo-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="검색..."
          aria-label="메모 검색"
        />
        <FormButton htmlType="button" variant="primary" size="sm" onClick={openCreate}>
          + 메모 추가
        </FormButton>
      </div>

      {notesLoading && notes.length === 0 ? (
        <p className="mobile-memo-list-page__muted">메모를 불러오는 중…</p>
      ) : null}

      {!notesLoading && notes.length === 0 ? (
        <p className="mobile-memo-list-page__muted">등록된 메모가 없습니다.</p>
      ) : null}

      {!notesLoading && notes.length > 0 && filteredNotes.length === 0 ? (
        <p className="mobile-memo-list-page__muted">검색 결과가 없습니다.</p>
      ) : null}

      <div className="mobile-memo-list-page__cards">
        {filteredNotes.map((note) => {
          const { title, preview } = parseMemoContent(note.content)
          return (
            <button
              key={note.id}
              type="button"
              className="mobile-memo-card"
              onClick={() => openEdit(note.id, note.content)}
            >
              <span className="mobile-memo-card__time">{formatMemoListUpdatedAt(note.updatedAt ?? note.createdAt)}</span>
              <div className="mobile-memo-card__title">{title}</div>
              <div className="mobile-memo-card__preview">{preview || '내용 없음'}</div>
            </button>
          )
        })}
      </div>

      <MobileMemoFullScreenModal
        open={editorOpen}
        noteId={editorNoteId}
        initialContent={editorInitialContent}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  )
}
