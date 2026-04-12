import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MemoPanel from './MemoPanel'
import { MIN_LEFT_WIDTH, MIN_MEMO_WIDTH } from './memoWorkspaceLayoutConstants'
import { MemoElectronFabDock } from '../features/memo/components/MemoElectronFabDock'

/**
 * 인증 라우트 전역: PC에서는 좌측(앱) + 우측(메모 패널), 모바일(≤768px)에서는 Outlet만 렌더합니다.
 */
export default function AppWorkspaceLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div className="app-main-content">
        <Outlet />
      </div>
    )
  }

  return (
    <MemoWorkspaceProvider>
      <AppWorkspaceLayoutPc />
    </MemoWorkspaceProvider>
  )
}

function AppWorkspaceLayoutPc() {
  const { isMinimized, setIsMinimized } = useMemoWorkspace()

  const [memoRatio, setMemoRatio] = useState(0.4)
  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

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

  const onSelectNoteFromList = useCallback((id: string) => {
    setSelectedNoteId(id)
  }, [])

  const onToggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => {
      const next = !v
      if (next) {
        setIsMemoOpen(true)
      }
      return next
    })
  }, [])

  const onToggleMinimize = useCallback(() => {
    setIsMemoOpen(true)
    setIsMinimized((prev) => {
      const next = !prev
      if (next) {
        setIsFullscreen(false)
      }
      return next
    })
  }, [setIsMinimized])

  useEffect(() => {
    if (isFullscreen) {
      setIsMinimized(false)
    }
  }, [isFullscreen, setIsMinimized])

  let leftStyle: CSSProperties = { flex: 1, minWidth: 0 }
  let rightStyle: CSSProperties = {
    flex: `0 0 ${memoRatio * 100}%`,
    width: `${memoRatio * 100}%`,
    minWidth: MIN_MEMO_WIDTH,
  }

  if (isFullscreen) {
    leftStyle = { display: 'none' }
    rightStyle = { flex: '1 1 100%', width: '100%', minWidth: 0 }
  } else if (!isMemoOpen || isMinimized) {
    leftStyle = { flex: '1 1 100%', width: '100%', minWidth: 0 }
    rightStyle = { display: 'none' }
  }

  const showResize = isMemoOpen && !isFullscreen && !isMinimized

  return (
    <div className="workspace-root workspace-root--app-pc" ref={rootRef}>
      {!isMemoOpen ? (
        <button
          type="button"
          className="workspace-memo-reopen"
          onClick={() => setIsMemoOpen(true)}
        >
          메모 패널 열기
        </button>
      ) : null}

      <div className="workspace-left workspace-left--app" style={leftStyle}>
        <div className="app-main-content">
          <Outlet />
        </div>
      </div>

      {showResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          className="resize-handle resize-handle--app"
          onMouseDown={onResizeMouseDown}
        />
      ) : null}

      {!isMinimized && isMemoOpen ? (
        <div className="workspace-right workspace-right--app-fixed" style={rightStyle}>
          <MemoPanel
            isFullscreen={isFullscreen}
            isListOpen={isListOpen}
            onToggleList={() => setIsListOpen((v) => !v)}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
          />
        </div>
      ) : null}

      <MemoElectronFabDock
        isMobile={false}
        onToggleMinimize={onToggleMinimize}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  )
}
