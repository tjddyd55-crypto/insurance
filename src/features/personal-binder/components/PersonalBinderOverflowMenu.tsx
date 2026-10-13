import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'

import {
  resolveStorageExplorerFileActionsMenuPosition,
  type FloatingMenuPosition,
} from '../../storage/utils/storageExplorerFileActionsMenuPosition'

import { usePersonalBinderOverflowMenu } from './PersonalBinderOverflowMenuContext'

export type PersonalBinderOverflowMenuItem = {
  id: string
  label: string
  disabled?: boolean
  tone?: 'default' | 'danger'
  onSelect: () => void
}

type Props = {
  menuKey: string
  ariaLabel: string
  items: PersonalBinderOverflowMenuItem[]
  disabled?: boolean
  className?: string
}

export function PersonalBinderOverflowMenu({
  menuKey,
  ariaLabel,
  items,
  disabled = false,
  className = '',
}: Props) {
  const menuContext = usePersonalBinderOverflowMenu()
  const [localOpen, setLocalOpen] = useState(false)
  const open = menuContext ? menuContext.isMenuOpen(menuKey) : localOpen
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const closeMenu = useCallback(() => {
    if (menuContext) {
      menuContext.closeMenu()
    } else {
      setLocalOpen(false)
    }
    setPosition(null)
  }, [menuContext])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    setPosition(
      resolveStorageExplorerFileActionsMenuPosition({
        triggerRect: trigger.getBoundingClientRect(),
        menuSize: {
          width: panel.offsetWidth,
          height: panel.offsetHeight,
        },
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    )
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
  }, [open, updatePosition, items.length])

  useEffect(() => {
    if (!open) return undefined

    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closeMenu()
    }

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    const onReflow = () => {
      updatePosition()
    }

    const scrollRoot =
      triggerRef.current?.closest('.personal-binder-workspace__editor-pane') ??
      triggerRef.current?.closest('.personal-binder-explorer-tree')

    document.addEventListener('mousedown', onDocumentPointerDown)
    document.addEventListener('keydown', onDocumentKeyDown)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    scrollRoot?.addEventListener('scroll', onReflow, { passive: true })

    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown)
      document.removeEventListener('keydown', onDocumentKeyDown)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
      scrollRoot?.removeEventListener('scroll', onReflow)
    }
  }, [open, closeMenu, updatePosition])

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            className={[
              'personal-binder-overflow-menu__panel',
              'personal-binder-overflow-menu__panel--floating',
              position ? `personal-binder-overflow-menu__panel--${position.placement}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="menu"
            style={
              position
                ? { top: `${position.top}px`, left: `${position.left}px` }
                : { visibility: 'hidden' as const, top: 0, left: 0 }
            }
            onClick={(event) => {
              event.stopPropagation()
            }}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={[
                  'personal-binder-overflow-menu__item',
                  item.tone === 'danger' ? 'personal-binder-overflow-menu__item--danger' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(event) => {
                  event.stopPropagation()
                  closeMenu()
                  if (!item.disabled) item.onSelect()
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <div className={['personal-binder-overflow-menu', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="personal-binder-overflow-menu__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event: ReactMouseEvent) => {
          event.stopPropagation()
          if (menuContext) {
            menuContext.toggleMenu(menuKey)
          } else {
            setLocalOpen((value) => !value)
          }
        }}
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
      >
        ⋯
      </button>
      {panel}
    </div>
  )
}
