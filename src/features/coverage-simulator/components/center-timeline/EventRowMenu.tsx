import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import FormButton from '../../../../components/form/FormButton'
import { ItemActionSheet } from '../ItemActionSheet'
import type { ScenarioItemCategory } from '../../domain/types'

type EventRowMenuProps = {
  menuMode?: 'popover' | 'action-sheet'
  itemCategory?: ScenarioItemCategory
  itemLabel?: string
  onEditAmount: () => void
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
  itemCategory,
  itemLabel = '',
  onEditAmount,
  onDelete,
}: EventRowMenuProps) {
  const [open, setOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [position, setPosition] = useState<PanelPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (menuMode !== 'popover' || !open) return
    const trigger = rootRef.current?.querySelector('button')
    if (!trigger || !panelRef.current) return
    setPosition(measurePanelPosition(trigger as HTMLElement, panelRef.current))
  }, [open, menuMode])

  useEffect(() => {
    if (menuMode !== 'popover' || !open) return undefined
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onReflow = () => {
      const trigger = rootRef.current?.querySelector('button')
      if (trigger && panelRef.current) {
        setPosition(measurePanelPosition(trigger as HTMLElement, panelRef.current))
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

  if (menuMode === 'action-sheet') {
    return (
      <>
        <div className="cs-axis-row-menu">
          <FormButton
            variant="action"
            className="cs-axis-row-menu__trigger"
            aria-label="항목 메뉴"
            onClick={() => setSheetOpen(true)}
          >
            ⋯
          </FormButton>
        </div>
        <ItemActionSheet
          open={sheetOpen}
          title="항목"
          subject={itemCategory ? { category: itemCategory, label: itemLabel } : undefined}
          onClose={() => setSheetOpen(false)}
          actions={[
            { id: 'edit', label: '항목 수정', onSelect: onEditAmount },
            { id: 'delete', label: '삭제', destructive: true, onSelect: onDelete },
          ]}
        />
      </>
    )
  }

  const panel =
    open ? (
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
          className="cs-axis-row-menu__danger"
          onClick={() => { setOpen(false); onDelete() }}
        >
          삭제
        </button>
      </div>
    ) : null

  return (
    <div className="cs-axis-row-menu" ref={rootRef}>
      <FormButton
        variant="action"
        className="cs-axis-row-menu__trigger"
        aria-label="항목 메뉴"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </FormButton>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
