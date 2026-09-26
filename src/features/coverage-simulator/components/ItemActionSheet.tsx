import { CoverageBadge } from './CoverageBadge'
import { CoverageSimulatorActionSheetShell } from './CoverageSimulatorActionSheetShell'
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
  return (
    <CoverageSimulatorActionSheetShell
      open={open}
      panelClassName="cs-item-action-sheet"
      ariaLabelledBy="cs-item-action-sheet-title"
      onClose={onClose}
    >
      <header>
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
      <footer className="cs-item-action-sheet__footer">
        <button type="button" className="cs-item-action-sheet__cancel" onClick={onClose}>
          취소
        </button>
      </footer>
    </CoverageSimulatorActionSheetShell>
  )
}
