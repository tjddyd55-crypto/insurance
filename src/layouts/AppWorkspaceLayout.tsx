import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { MemoWorkspaceProvider } from '../features/memo/context/MemoWorkspaceContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MemoPanel from './MemoPanel'

const PANEL_W_DEFAULT = 420
const PANEL_W_MIN = 340
const PANEL_W_MAX = 600

/**
 * 인증 라우트 전역: PC에서는 좌측(앱) + 우측(메모 패널), 모바일(≤768px)에서는 Outlet만 렌더합니다.
 */
export default function AppWorkspaceLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  const [panelWidth, setPanelWidth] = useState(PANEL_W_DEFAULT)
  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current || !rootRef.current) {
        return
      }
      const rect = rootRef.current.getBoundingClientRect()
      const fromRight = rect.right - e.clientX
      setPanelWidth(Math.min(PANEL_W_MAX, Math.max(PANEL_W_MIN, fromRight)))
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
  }, [])

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

  if (isMobile) {
    return <Outlet />
  }

  let leftStyle: CSSProperties = { flex: 1, minWidth: 0 }
  let rightStyle: CSSProperties = {
    width: panelWidth,
    flex: `0 0 ${panelWidth}px`,
    minWidth: 0,
  }

  if (isFullscreen) {
    leftStyle = { display: 'none' }
    rightStyle = { flex: '1 1 100%', width: '100%', minWidth: 0 }
  } else if (!isMemoOpen) {
    leftStyle = { flex: '1 1 100%', width: '100%', minWidth: 0 }
    rightStyle = { display: 'none' }
  }

  const showResize = isMemoOpen && !isFullscreen

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
        <Outlet />
      </div>

      {showResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          className="resize-handle resize-handle--app"
          onMouseDown={onResizeMouseDown}
        />
      ) : null}

      <div className="workspace-right workspace-right--app-fixed" style={rightStyle}>
        <MemoWorkspaceProvider>
          <MemoPanel
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            isListOpen={isListOpen}
            onToggleList={() => setIsListOpen((v) => !v)}
            onClosePanel={() => setIsMemoOpen(false)}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
          />
        </MemoWorkspaceProvider>
      </div>
    </div>
  )
}
