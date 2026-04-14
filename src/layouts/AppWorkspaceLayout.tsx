import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { FormButton } from '../components/form'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MemoPanel from './MemoPanel'
import { MemoElectronFabDock } from '../features/memo/components/MemoElectronFabDock'

/**
 * 인증 라우트 전역: 본문은 항상 Outlet으로 렌더하고, 메모는 별도 오버레이 계층에서 관리합니다.
 */
export default function AppWorkspaceLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <MemoWorkspaceProvider>
      <AppWorkspaceLayoutShell isMobile={isMobile} />
    </MemoWorkspaceProvider>
  )
}

function AppWorkspaceLayoutShell({ isMobile }: { isMobile: boolean }) {
  const { isMinimized, setIsMinimized } = useMemoWorkspace()

  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

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

  if (isMobile) {
    return (
      <div className="app-main-content">
        <Outlet />
        <MemoElectronFabDock
          isMobile
          onToggleMinimize={onToggleMinimize}
          onToggleFullscreen={onToggleFullscreen}
        />
      </div>
    )
  }

  return (
    <div className="workspace-root workspace-root--app-pc">
      {!isMemoOpen ? (
        <FormButton
          htmlType="button"
          variant="action"
          className="workspace-memo-reopen"
          onClick={() => setIsMemoOpen(true)}
        >
          메모 패널 열기
        </FormButton>
      ) : null}

      <div className={`workspace-main workspace-main--app${isFullscreen ? ' workspace-main--dimmed' : ''}`}>
        <div className="app-main-content">
          <Outlet />
        </div>
      </div>

      {!isMinimized && isMemoOpen ? (
        <div
          className={`workspace-memo-overlay${isFullscreen ? ' workspace-memo-overlay--fullscreen' : ''}`}
          role="complementary"
          aria-label="메모 도구"
        >
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
