import MemoSidebar from './MemoSidebar'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'

type Props = {
  /** 리스트에서 노트 선택 후 추가 동작(모바일 selectedNoteId 등) */
  onAfterSelectNote?: (id: string) => void
}

/**
 * MemoSidebar 기반 목록 — 레이아웃 우측 탐색용
 */
export default function MemoList({ onAfterSelectNote }: Props) {
  const {
    token,
    notes,
    activeNoteId,
    editingNoteId,
    handleSidebarSelectNote,
    handleAutoArrange,
  } = useMemoWorkspace()

  if (!token?.trim()) {
    return null
  }

  const onSelect = (id: string) => {
    handleSidebarSelectNote(id)
    onAfterSelectNote?.(id)
  }

  return (
    <MemoSidebar
      notes={notes}
      activeNoteId={activeNoteId}
      editingNoteId={editingNoteId}
      isOpen
      onToggle={() => {}}
      onSelectNote={onSelect}
      onAutoArrange={handleAutoArrange}
      showToggle={false}
    />
  )
}
