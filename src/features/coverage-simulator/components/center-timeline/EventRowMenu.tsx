import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ItemActionSheet } from '../ItemActionSheet'
import { coverageItemMoveState } from '../../domain/timelinePeriodBounds'
import type { ScenarioItem, ScenarioItemCategory } from '../../domain/types'

type EventRowMenuProps = {
  menuMode?: 'popover' | 'action-sheet'
  items?: ScenarioItem[]
  itemId?: string
  itemCategory?: ScenarioItemCategory
  itemLabel?: string
  onEditAmount: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

type PanelPosition = {
  top: number
  left: number
}

function measurePanelPosition(trigger: HTMLElement, panel: HTMLElement): PanelPosition {
  const triggerRect = trigger.getBoundingClientRect()
  const panelHeight = panel.offsetHeight
  const panelWidth = panel.offsetWidth
  const margin = 8
  const dock = document.querySelector('.cs-mobile-dock')
  const limitBottom = dock ? dock.getBoundingClientRect().top : window.innerHeight

  let top = triggerRect.bottom + 4
  if (top + panelHeight > limitBottom - margin) {
    top = Math.max(margin, triggerRect.top - panelHeight - 4)
  }

  let left = triggerRect.right - panelWidth
  left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

  return { top, left }
}

export function EventRowMenu({
  menuMode = 'popover',
  items = [],
  itemId = '',
  itemCategory,
  itemLabel,
  onEditAmount,
  onMoveUp,
  onMoveDown,
  onDelete,
}: EventRowMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PanelPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const moveState = useMemo(
    () => (itemId ? coverageItemMoveState(items, itemId) : { canMoveUp: false, canMoveDown: false }),
    [items, itemId],
  )

  useLayoutEffect(() => {
    if (menuMode !== 'popover' || !open || !triggerRef.current || !panelRef.current) {
      setPosition(null)
      return
    }
    setPosition(measurePanelPosition(triggerRef.current, panelRef.current))
  }, [open, menuMode])

  useEffect(() => {
    if (menuMode !== 'popover' || !open) return undefined
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onReflow = () => {
      if (triggerRef.current && panelRef.current) {
        setPosition(measurePanelPosition(triggerRef.current, panelRef.current))
      }
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, menuMode])

  const sheetActions = [
    {
      id: 'edit',
      label: '항목 수정',
      onSelect: onEditAmount,
    },
    {
      id: 'up',
      label: '위로 이동',
      onSelect: onMoveUp,
      disabled: !moveState.canMoveUp,
    },
    {
      id: 'down',
      label: '아래로 이동',
      onSelect: onMoveDown,
      disabled: !moveState.canMoveDown,
    },
    {
      id: 'delete',
      label: '삭제',
      onSelect: onDelete,
      destructive: true,
    },
  ]

  const panel =
    menuMode === 'popover' && open ? (
      <div
        ref={panelRef}
        className="cs-axis-row-menu__panel cs-axis-row-menu__panel--portal"
        role="menu"
        style={
          position
            ? {
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 'var(--cs-z-item-popover)',
              }
            : { position: 'fixed', top: -9999, left: 0, visibility: 'hidden' as const }
        }
      >
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onEditAmount() }}>
          항목 수정
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!moveState.canMoveUp}
          onClick={() => { setOpen(false); onMoveUp() }}
        >
          위로 이동
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!moveState.canMoveDown}
          onClick={() => { setOpen(false); onMoveDown() }}
        >
          아래로 이동
        </button>
        <button
          type="button"
          role="menuitem"
          className="cs-axis-row-menu__danger"
          onClick={() => { setOpen(false); onDelete() }}
        >
          삭제
        </button>
      </div>
    ) : null

  return (
    <div className="cs-axis-row-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="cs-axis-row-menu__trigger"
        aria-label="항목 메뉴"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {menuMode === 'popover' && panel ? createPortal(panel, document.body) : null}
      {menuMode === 'action-sheet' ? (
        <ItemActionSheet
          open={open}
          title="항목 작업"
          subject={
            itemCategory && itemLabel
              ? { category: itemCategory, label: itemLabel }
              : undefined
          }
          onClose={() => setOpen(false)}
          actions={sheetActions}
        />
      ) : null}
    </div>
  )
}
