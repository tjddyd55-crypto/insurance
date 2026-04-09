import { useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import MemoWorkspacePage from '../features/memo/pages/MemoWorkspacePage'
import MemoList from '../features/memo/components/MemoList'

function MemoFab() {
  const { addNote, token } = useMemoWorkspace()
  if (!token?.trim()) {
    return null
  }
  return (
    <button type="button" className="memo-fab" onClick={() => void addNote()} aria-label="메모 추가">
      +
    </button>
  )
}

export type MemoPanelProps = {
  isFullscreen: boolean
  onToggleFullscreen: () => void
  isListOpen: boolean
  onToggleList: () => void
  onClosePanel: () => void
  selectedNoteId: string | null
  onSelectNoteFromList: (id: string) => void
}

/**
 * PC 우측 고정 패널 전용 — MemoWorkspaceProvider 하위에서만 사용합니다.
 */
export default function MemoPanel({
  isFullscreen,
  onToggleFullscreen,
  isListOpen,
  onToggleList,
  onClosePanel,
  selectedNoteId,
  onSelectNoteFromList,
}: MemoPanelProps) {
  const listVisible = isListOpen

  return (
    <div className={`memo-panel ${isFullscreen ? 'memo-panel--fullscreen' : ''}`}>
      <div className="memo-header">
        <button type="button" className="memo-header-btn" onClick={onClosePanel}>
          메모 패널 닫기
        </button>
        <button type="button" className="memo-header-btn" onClick={onToggleFullscreen}>
          {isFullscreen ? '전체화면 끄기' : '메모 전체화면'}
        </button>
        <button type="button" className="memo-header-btn" onClick={onToggleList}>
          {isListOpen ? '리스트 닫기' : '리스트 열기'}
        </button>
      </div>

      <div className="memo-body memo-body--pc-panel">
        <div className="memo-canvas-area memo-canvas-area--pc">
          <MemoWorkspacePage />
        </div>
      </div>

      {listVisible ? (
        <div
          className="memo-list-sidebar memo-list-sidebar--stacked"
          data-selected-note={selectedNoteId ?? ''}
        >
          <MemoList onAfterSelectNote={onSelectNoteFromList} />
        </div>
      ) : null}

      <MemoFab />
    </div>
  )
}
