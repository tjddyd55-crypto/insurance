import MemoWorkspacePage from '../features/memo/pages/MemoWorkspacePage'
import MemoList from '../features/memo/components/MemoList'

export type MemoPanelProps = {
  isFullscreen: boolean
  onToggleFullscreen: () => void
  isListOpen: boolean
  onToggleList: () => void
  onClosePanel: () => void
  onMinimize: () => void
  onOpenList: () => void
  selectedNoteId: string | null
  onSelectNoteFromList: (id: string) => void
}

/**
 * PC 우측 고정 패널 전용 — MemoWorkspaceProvider 하위에서만 사용합니다.
 */
export default function MemoPanel({
  isFullscreen,
  isListOpen,
  onOpenList,
  selectedNoteId,
  onSelectNoteFromList,
}: MemoPanelProps) {
  const listVisible = isListOpen

  return (
    <div className={`memo-panel ${isFullscreen ? 'memo-panel--fullscreen' : ''}`}>
      <div className="memo-panel-main">
        <div className="memo-body memo-body--pc-panel memo-body--list-row">
          <div className="memo-canvas-area memo-canvas-area--pc">
            <MemoWorkspacePage />
          </div>
          {listVisible ? (
            <div
              className="memo-list-sidebar memo-list-sidebar--right-dock"
              data-selected-note={selectedNoteId ?? ''}
            >
              <MemoList onAfterSelectNote={onSelectNoteFromList} />
            </div>
          ) : null}
          {!listVisible ? (
            <button type="button" className="memo-list-open-btn" onClick={onOpenList} aria-label="메모 목록 열기">
              &lt;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
