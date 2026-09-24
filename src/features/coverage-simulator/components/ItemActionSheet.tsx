import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { CoverageBadge } from './CoverageBadge'
import type { ScenarioItemCategory } from '../domain/types'

export type ItemActionSheetAction = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

type Subject = {
  category: ScenarioItemCategory
  label: string
}

type Props = {
  open: boolean
  title: string
  subject?: Subject
  onClose: () => void
  actions: ItemActionSheetAction[]
}

export function ItemActionSheet({ open, title, subject, onClose, actions }: Props) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const sheet = (
    <div
      className="coverage-simulator-sheet-backdrop coverage-simulator-sheet-backdrop--item-action"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="coverage-simulator-sheet coverage-simulator-sheet--compact coverage-simulator-sheet--item-actions"
        role="dialog"
        aria-labelledby="cs-item-action-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header coverage-simulator-sheet-header--compact">
          <h2 id="cs-item-action-sheet-title" className="coverage-simulator-sheet__title">
            {title}
          </h2>
        </div>
        {subject ? (
          <div className="cs-item-action-sheet__subject">
            <CoverageBadge category={subject.category} />
            <span className="cs-item-action-sheet__subject-label">{subject.label}</span>
          </div>
        ) : null}
        <div className="cs-item-action-sheet__list" role="menu">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={[
                'cs-item-action-sheet__row',
                action.destructive ? 'cs-item-action-sheet__row--danger' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return
                onClose()
                action.onSelect()
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className="cs-item-action-sheet__cancel" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
