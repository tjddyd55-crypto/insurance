import { FormButton } from '../components/form'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { loadMemoUiSnapshot, patchMemoUiWorkspace } from '../features/memo/memoUiStorage'
import { MemoWorkspaceProvider, useMemoWorkspace } from '../features/memo/context/MemoWorkspaceContext'
import MemoWorkspacePage from '../features/memo/pages/MemoWorkspacePage'
import MemoList from '../features/memo/components/MemoList'
import useIsMobile from '../hooks/useIsMobile'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { MIN_LEFT_WIDTH, MIN_MEMO_WIDTH } from './memoWorkspaceLayoutConstants'
import { MemoElectronFabDock } from '../features/memo/components/MemoElectronFabDock'

function MemoFab() {
  const { addNote, token } = useMemoWorkspace()
  if (!token?.trim()) {
    return null
  }
  return (
    <FormButton htmlType="button" className="memo-fab" onClick={() => void addNote()} aria-label="메모 추가">
      +
    </FormButton>
  )
}

function MemoPanelBody({
  showList,
  isMobile,
  selectedNoteId,
  onSelectNoteFromList,
  onToggleList,
  omitFab = false,
}: {
  showList: boolean
  isMobile: boolean
  selectedNoteId: string | null
  onSelectNoteFromList: (id: string) => void
  onToggleList: () => void
  omitFab?: boolean
}) {
  return (
    <div className="memo-panel-main">
      <div
        className={`memo-body ${isMobile ? 'memo-body--mobile mobile-container' : 'memo-body--list-row'}`}
      >
        <div className={`memo-canvas-area p-2 min-h-0 ${isMobile ? 'mobile-memo-view' : ''}`}>
          <MemoWorkspacePage />
        </div>
        {isMobile ? (
          <MemoMobileListSection
            showList={showList}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
            onToggleList={onToggleList}
          />
        ) : (
          <MemoPcListSection
            showList={showList}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
            onToggleList={onToggleList}
          />
        )}
      </div>
      {!omitFab ? <MemoFab /> : null}
    </div>
  )
}

type MemoListSectionProps = {
  showList: boolean
  selectedNoteId: string | null
  onSelectNoteFromList: (id: string) => void
  onToggleList: () => void
}

/**
 * 모바일 하단 메모 리스트 영역.
 *
 * - "메모 목록" 헤더 / "정리하기" 버튼 / 작은 동그라미 토글을 한 줄 핸들 바 하나로 통합.
 * - showList 가 false 이면 핸들 바만 노출(▲), true 면 핸들(▼) + 리스트 5개 이상 보이는 영역.
 * - 리스트 헤더는 `hideHeader` 로 숨긴다 (자리 차지 방지, "정리" 는 FAB 영역으로 이동).
 */
function MemoMobileListSection({
  showList,
  selectedNoteId,
  onSelectNoteFromList,
  onToggleList,
}: MemoListSectionProps) {
  const handleLabel = showList ? '메모 목록 접기' : '메모 목록 열기'
  const handleIcon = showList ? '▼' : '▲'
  return (
    <>
      <FormButton
        htmlType="button"
        className={`memo-mobile-list-handle${showList ? '' : ' memo-mobile-list-handle--collapsed'}`}
        onClick={onToggleList}
        aria-label={handleLabel}
        aria-expanded={showList}
      >
        <span className="memo-mobile-list-handle__icon" aria-hidden>
          {handleIcon}
        </span>
      </FormButton>
      {showList ? (
        <div
          className="memo-list-sidebar mobile-list memo-mobile-list"
          data-selected-note={selectedNoteId ?? ''}
        >
          <MemoList onAfterSelectNote={onSelectNoteFromList} hideHeader />
        </div>
      ) : null}
    </>
  )
}

/** PC 우측 메모 리스트 — 기존 방식 유지(좌측 토글 버튼 + 도킹된 사이드바). */
function MemoPcListSection({
  showList,
  selectedNoteId,
  onSelectNoteFromList,
  onToggleList,
}: MemoListSectionProps) {
  if (showList) {
    return (
      <div
        className="memo-list-sidebar memo-list-sidebar--right-dock"
        data-selected-note={selectedNoteId ?? ''}
      >
        <FormButton
          htmlType="button"
          className="memo-list-toggle-btn memo-list-toggle-btn--collapse"
          onClick={onToggleList}
          aria-label="메모 목록 접기"
        >
          &gt;
        </FormButton>
        <MemoList onAfterSelectNote={onSelectNoteFromList} />
      </div>
    )
  }
  return (
    <FormButton
      htmlType="button"
      className="memo-list-toggle-btn memo-list-toggle-btn--expand"
      onClick={onToggleList}
      aria-label="메모 목록 열기"
    >
      &lt;
    </FormButton>
  )
}

type MainWorkspaceLayoutProps = {
  children: ReactNode
}

function MainWorkspaceLayoutInner({ children }: MainWorkspaceLayoutProps) {
  const { isMinimized, setIsMinimized } = useMemoWorkspace()
  const { user } = useAuth()
  const persistenceUserId = String(user?.id ?? '')

  const [memoRatio, setMemoRatio] = useState(0.4)
  const [isMemoOpen, setIsMemoOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const workspaceHydratedRef = useRef(false)
  const skipWorkspacePersistRef = useRef(true)

  useEffect(() => {
    skipWorkspacePersistRef.current = true
  }, [persistenceUserId])

  useEffect(() => {
    if (!persistenceUserId) {
      workspaceHydratedRef.current = false
      return
    }
    const snap = loadMemoUiSnapshot(persistenceUserId)
    if (snap?.workspace) {
      queueMicrotask(() => {
        setMemoRatio(snap.workspace.memoRatio)
        setIsListOpen(snap.workspace.isListOpen)
        setIsMemoOpen(snap.workspace.isMemoOpen)
      })
    }
    workspaceHydratedRef.current = true
  }, [persistenceUserId])

  useEffect(() => {
    if (!persistenceUserId || !workspaceHydratedRef.current) {
      return
    }
    if (skipWorkspacePersistRef.current) {
      skipWorkspacePersistRef.current = false
      return
    }
    patchMemoUiWorkspace(persistenceUserId, { memoRatio, isListOpen, isMemoOpen })
  }, [persistenceUserId, memoRatio, isListOpen, isMemoOpen])

  const isMobile = useIsMobile()
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

  const onToggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => {
      const next = !v
      if (next) {
        setIsMemoOpen(true)
      }
      return next
    })
  }, [])

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
        <FormButton
          htmlType="button"
          className="menu-toggle"
          onClick={() => setLeftDrawerOpen(true)}
          aria-label="메뉴 열기"
        >
          ☰
        </FormButton>
      ) : null}

      {!isMemoOpen ? (
        <FormButton htmlType="button" className="workspace-memo-reopen" onClick={() => setIsMemoOpen(true)}>
          메모 패널 열기
        </FormButton>
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
          <MemoPanelBody
            showList={listVisible}
            isMobile={isMobile}
            selectedNoteId={selectedNoteId}
            onSelectNoteFromList={onSelectNoteFromList}
            onToggleList={() => setIsListOpen((v) => !v)}
            omitFab
          />
        </div>
      ) : null}
      <MemoElectronFabDock
        isMobile={isMobile}
        onToggleMinimize={onToggleMinimize}
        onToggleFullscreen={onToggleFullscreen}
      />
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
