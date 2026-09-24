export type ItemActionSheetAction = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

type Props = {
  open: boolean
  title: string
  onClose: () => void
  actions: ItemActionSheetAction[]
}

export function ItemActionSheet({ open, title, onClose, actions }: Props) {
  if (!open) return null

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation" onClick={onClose}>
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
}
