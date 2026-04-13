import { FormButton } from '../../../components/form'
import { useEffect, useRef, useState } from 'react'
import { useMemoWorkspace } from '../context/MemoWorkspaceContext'

export type MemoElectronFabDockProps = {
  onToggleMinimize: () => void
  onToggleFullscreen: () => void
  isMobile?: boolean
}

/** Unified: viewport-fixed + FAB menu. PC/Web exposes fullscreen+minimize toggles, mobile hides them. */
export function MemoElectronFabDock({
  onToggleMinimize,
  onToggleFullscreen,
  isMobile = false,
}: MemoElectronFabDockProps) {
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
    <div className="memo-electron-fab-dock" ref={wrapRef}>
      <FormButton
        htmlType="button"
        className="memo-fab memo-fab--electron-dock"
        aria-label={'\uBA54\uBAA8 \uB354\uBCF4\uAE30'}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        +
      </FormButton>
      {menuOpen ? (
        <div className="memo-fab-menu" role="menu">
          <FormButton
            htmlType="button"
            role="menuitem"
            className="memo-fab-menu__item"
            onClick={() => {
              closeMenu()
              void addNote()
            }}
          >
            메모 추가
          </FormButton>
          {!isMobile ? (
            <FormButton
              htmlType="button"
              role="menuitem"
              className="memo-fab-menu__item"
              onClick={() => {
                closeMenu()
                onToggleFullscreen()
              }}
            >
              메모 전체화면 on/off
            </FormButton>
          ) : null}
          {!isMobile ? (
            <FormButton
              htmlType="button"
              role="menuitem"
              className="memo-fab-menu__item"
              onClick={() => {
                closeMenu()
                onToggleMinimize()
              }}
            >
              메모 최소화 on/off
            </FormButton>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
