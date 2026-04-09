import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import MemoWorkspacePage from '../features/memo/pages/MemoWorkspacePage'
import MemoList from '../features/memo/components/MemoList'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { MIN_LEFT_WIDTH, MIN_MEMO_WIDTH } from './memoWorkspaceLayoutConstants'

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

function MemoPanelBody({
  showList,
  isMobile,
  selectedNoteId,
  onSelectNoteFromList,
  onOpenList,
}: {
  showList: boolean
  isMobile: boolean
  selectedNoteId: string | null
  onSelectNoteFromList: (id: string) => void
  onOpenList: () => void
}) {
  return (
    <div className="memo-panel-main">
      <div
        className={`memo-body ${isMobile ? 'memo-body--mobile mobile-container' : 'memo-body--list-row'}`}
      >
        <div className={`memo-canvas-area p-2 min-h-0 ${isMobile ? 'mobile-memo-view' : ''}`}>
          <MemoWorkspacePage />
        </div>
        {showList ? (
          <div
            className={`memo-list-sidebar ${isMobile ? 'mobile-list memo-mobile-list' : 'memo-list-sidebar--right-dock'}`}
            data-selected-note={selectedNoteId ?? ''}
          >
            <MemoList onAfterSelectNote={onSelectNoteFromList} />
          </div>
        ) : null}
        {!showList ? (
          <button type="button" className="memo-list-open-btn" onClick={onOpenList} aria-label="메모 목록 열기">
            ›
          </button>
        ) : null}
      </div>
      <MemoFab />
    </div>
  )
}

type MainWorkspaceLayoutProps = {
  children: ReactNode
}

function MainWorkspaceLayoutInner({ children }: MainWorkspaceLayoutProps) {
  const { isMinimized, setIsMinimized } = useMemoWorkspace()

  const [memoRatio, setMemoRatio] = useState(0.4)
  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)

  const isMobile = useMediaQuery('(max-width: 768px)')
  const isNarrow = useMediaQuery('(max-width: 899px)')

  const rootRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)

  const handleResize = useCallback((nextRatio: number) => {
    const totalWidth = rootRef.current?.offsetWidth ?? 0
    if (totalWidth <= 0) {
      return
    }
    const t = Math.max(0, Math.min(1, nextRatio))
    const rMin = MIN_MEMO_WIDTH / totalWidth
    const rMax = 1 - MIN_LEFT_WIDTH / totalWidth
    if (rMin > rMax) {
      setMemoRatio((rMin + rMax) / 2)
      return
    }
    const safeRatio = Math.min(rMax, Math.max(rMin, t))
    setMemoRatio(safeRatio)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current || !rootRef.current) {
        return
      }
      const rect = rootRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = (rect.width - x) / rect.width
      handleResize(ratio)
    }
    const onUp = () => {
      resizingRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleResize])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
  }, [])

  const closeMemoPanel = useCallback(() => {
    setIsMemoOpen(false)
    setIsMinimized(false)
  }, [setIsMinimized])

  const minimizeMemoPanel = useCallback(() => {
    setIsMinimized(true)
    setIsFullscreen(false)
  }, [setIsMinimized])

  useEffect(() => {
    if (isFullscreen) {
      setIsMinimized(false)
    }
  }, [isFullscreen, setIsMinimized])

  const showResize = isMemoOpen && !isFullscreen && !isNarrow && !isMinimized

  let leftStyle: CSSProperties = { minWidth: 0 }
  let rightStyle: CSSProperties = { minWidth: 0 }

  if (isFullscreen) {
    leftStyle = { display: 'none' }
    rightStyle = { flex: '1 1 100%', width: '100%', minWidth: 0 }
  } else if (!isMemoOpen || isMinimized) {
    leftStyle = { flex: '1 1 100%', width: '100%', minWidth: 0 }
    rightStyle = { display: 'none' }
  } else if (isNarrow) {
    leftStyle = {
      flex: '0 0 0',
      width: 0,
      minWidth: 0,
      overflow: 'visible',
      padding: 0,
      border: 'none',
    }
    rightStyle = {
      flex: '1 1 100%',
      width: '100%',
      minWidth: 0,
    }
  } else {
    leftStyle = {
      flex: `0 0 ${(1 - memoRatio) * 100}%`,
      width: `${(1 - memoRatio) * 100}%`,
      minWidth: 0,
    }
    rightStyle = {
      flex: `0 0 ${memoRatio * 100}%`,
      width: `${memoRatio * 100}%`,
      minWidth: MIN_MEMO_WIDTH,
    }
  }

  const listVisible = isListOpen && (isFullscreen || isMemoOpen)

  const onSelectNoteFromList = useCallback((id: string) => {
    setSelectedNoteId(id)
  }, [])

  return (
    <div className="workspace-root" ref={rootRef}>
      {isNarrow && leftDrawerOpen ? (
        <div
          className="workspace-left-backdrop backdrop"
          role="presentation"
          aria-hidden
          onClick={() => setLeftDrawerOpen(false)}
        />
      ) : null}

      {isNarrow ? (
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setLeftDrawerOpen(true)}
          aria-label="메뉴 열기"
        >
          ☰
        </button>
      ) : null}

      {!isMemoOpen ? (
        <button type="button" className="workspace-memo-reopen" onClick={() => setIsMemoOpen(true)}>
          메모 패널 열기
        </button>
      ) : null}

      {isMinimized && isMemoOpen ? (
        <button
          type="button"
          className="memo-restore-btn"
          onClick={() => setIsMinimized(false)}
        >
          메모 열기
        </button>
      ) : null}

      <div
        className={`workspace-left ${isNarrow ? 'workspace-left--narrow drawer' : ''}`}
        style={leftStyle}
      >
        <div
          className={`workspace-left-inner ${isNarrow && leftDrawerOpen ? 'workspace-left-inner--open' : ''}`}
        >
          {children}
        </div>
      </div>

      {showResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          className="resize-handle"
          onMouseDown={onResizeMouseDown}
        />
      ) : null}

      {!isMinimized && isMemoOpen ? (
        <div className="workspace-right" style={rightStyle}>
          <div className="memo-header">
            <button type="button" className="memo-header-btn" onClick={closeMemoPanel}>
              메모 패널 닫기
            </button>
            <button
              type="button"
              className="memo-header-btn"
              onClick={() => {
                setIsFullscreen((v) => {
                  const next = !v
                  if (next) {
                    setIsMemoOpen(true)
                  }
                  return next
                })
              }}
            >
              {isFullscreen ? '전체화면 끄기' : '메모 전체화면'}
            </button>
            <button type="button" className="memo-header-btn" onClick={minimizeMemoPanel}>
              최소화
            </button>
            <button
              type="button"
              className="memo-header-btn"
              onClick={() => setIsListOpen((v) => !v)}
              disabled={!isMemoOpen && !isFullscreen}
            >
              {isListOpen ? '리스트 닫기' : '리스트 열기'}
            </button>
          </div>
          <MemoPanelBody
            showList={listVisible}
            isMobile={isMobile}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
            onOpenList={() => setIsListOpen(true)}
          />
        </div>
      ) : null}
    </div>
  )
}

export default function MainWorkspaceLayout({ children }: MainWorkspaceLayoutProps) {
  return (
    <MemoWorkspaceProvider>
      <MainWorkspaceLayoutInner>{children}</MainWorkspaceLayoutInner>
    </MemoWorkspaceProvider>
  )
}
