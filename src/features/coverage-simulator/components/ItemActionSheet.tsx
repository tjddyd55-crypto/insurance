import { createPortal } from 'react-dom'

import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'
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
  useCoverageSimulatorOverlayScrollLock(open)

  if (!open) return null

  const sheet = (
    <div className="cs-item-action-overlay" role="presentation" onClick={onClose}>
      <div
        className="cs-item-action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-item-action-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cs-item-action-sheet__header">
          <h2 id="cs-item-action-sheet-title" className="cs-item-action-sheet__title">
            {title}
          </h2>
        </header>
        {subject ? (
          <div className="cs-item-action-sheet__subject">
            <CoverageBadge category={subject.category} />
            <span className="cs-item-action-sheet__subject-label">{subject.label}</span>
          </div>
        ) : null}
        <div className="cs-item-action-sheet__group" role="menu">
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
        <div className="cs-item-action-sheet__group cs-item-action-sheet__group--footer">
          <button type="button" className="cs-item-action-sheet__cancel" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
