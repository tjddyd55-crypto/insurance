import { useEffect, useRef, useState } from 'react'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'

export type MemoElectronFabDockProps = {
  onMinimize: () => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
}

/** Unified: viewport-fixed + FAB with menu; fullscreen close (X). Wires existing handlers only. */
export function MemoElectronFabDock({ onMinimize, onToggleFullscreen, isFullscreen }: MemoElectronFabDockProps) {
  const { addNote, token } = useMemoWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  if (!token?.trim()) {
    return null
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      {isFullscreen ? (
        <button
          type="button"
          className="memo-fullscreen-exit-electron"
          aria-label="전체화면 종료"
          onClick={() => onToggleFullscreen()}
        >
          ×
        </button>
      ) : null}
      <div className="memo-electron-fab-dock" ref={wrapRef}>
        <button
          type="button"
          className="memo-fab memo-fab--electron-dock"
          aria-label={'\uBA54\uBAA8 \uB354\uBCF4\uAE30'}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          +
        </button>
        {menuOpen ? (
          <div className="memo-fab-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="memo-fab-menu__item"
              onClick={() => {
                closeMenu()
                void addNote()
              }}
            >
              메모 추가
            </button>
            <button
              type="button"
              role="menuitem"
              className="memo-fab-menu__item"
              onClick={() => {
                closeMenu()
                onMinimize()
              }}
            >
              메모 최소화
            </button>
            <button
              type="button"
              role="menuitem"
              className="memo-fab-menu__item"
              onClick={() => {
                closeMenu()
                onToggleFullscreen()
              }}
            >
              메모 전체화면
            </button>
          </div>
        ) : null}
      </div>
    </>
  )
}
