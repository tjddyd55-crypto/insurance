import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { StorageFileRow } from '../api/storageApi'
import {
  resolveStorageExplorerFileActionsMenuPosition,
  type FloatingMenuPosition,
} from '../utils/storageExplorerFileActionsMenuPosition'

const EXPLORER_FILE_ACTION_BUTTON_CLASS = 'storage-explorer-file-action-button'
const EXPLORER_FILE_ACTION_DANGER_CLASS =
  'storage-explorer-file-action-button storage-explorer-file-action-button--danger'

type StorageExplorerFileActionsMenuProps = {
  file: StorageFileRow
  downloadHref: string
  downloadFailed: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenFile: (file: StorageFileRow) => void
  onRename: (file: StorageFileRow) => void
  onDelete: (file: StorageFileRow) => void
}

export function StorageExplorerFileActionsMenu({
  file,
  downloadHref,
  downloadFailed,
  open,
  onOpenChange,
  onOpenFile,
  onRename,
  onDelete,
}: StorageExplorerFileActionsMenuProps) {
  const menuId = `storage-explorer-file-actions-menu-${file.id}`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null)

  const closeMenu = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

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
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closeMenu()
    }

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    const onRepositionOrClose = () => {
      closeMenu()
    }

    const listEl = triggerRef.current?.closest('.storage-explorer-files__list')
    document.addEventListener('mousedown', onDocumentMouseDown)
    document.addEventListener('keydown', onDocumentKeyDown)
    window.addEventListener('resize', onRepositionOrClose)
    listEl?.addEventListener('scroll', onRepositionOrClose, { passive: true })

    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown)
      document.removeEventListener('keydown', onDocumentKeyDown)
      window.removeEventListener('resize', onRepositionOrClose)
      listEl?.removeEventListener('scroll', onRepositionOrClose)
    }
  }, [open, closeMenu])

  const runAction = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation()
    closeMenu()
    action()
  }

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            className={[
              'storage-explorer-files__actions-menu-panel',
              'storage-explorer-files__actions-menu-panel--floating',
              position ? `storage-explorer-files__actions-menu-panel--${position.placement}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="menu"
            aria-label="파일 작업"
            style={
              position
                ? { top: `${position.top}px`, left: `${position.left}px` }
                : { visibility: 'hidden' as const }
            }
            onClick={(event) => {
              event.stopPropagation()
            }}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
          >
            <button
              type="button"
              role="menuitem"
              className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
              onClick={runAction(() => onOpenFile(file))}
            >
              열기
            </button>
            {downloadHref ? (
              <a
                href={downloadHref}
                download
                role="menuitem"
                className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
                onClick={(event) => {
                  event.stopPropagation()
                  closeMenu()
                }}
              >
                다운로드
              </a>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
                disabled
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                {downloadFailed ? '준비 실패' : '준비 중'}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={EXPLORER_FILE_ACTION_BUTTON_CLASS}
              onClick={runAction(() => onRename(file))}
            >
              이름 변경
            </button>
            <button
              type="button"
              role="menuitem"
              className={EXPLORER_FILE_ACTION_DANGER_CLASS}
              onClick={runAction(() => onDelete(file))}
            >
              삭제
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="storage-explorer-files__actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="storage-explorer-files__actions-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation()
          onOpenChange(!open)
        }}
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
      >
        더보기
      </button>
      {panel}
    </div>
  )
}
