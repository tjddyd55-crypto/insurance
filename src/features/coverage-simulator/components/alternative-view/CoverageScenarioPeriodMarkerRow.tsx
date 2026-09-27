import { TimeMarkerRowMenu } from '../center-timeline/TimeMarkerRowMenu'

type Props = {
  label: string
  readOnly: boolean
  menuMode: 'inline-delete' | 'action-sheet'
  onDelete?: () => void
}

export function CoverageScenarioPeriodMarkerRow({ label, readOnly, menuMode, onDelete }: Props) {
  return (
    <div className="cs-alt-marker" data-testid="coverage-alt-marker">
      <span className="cs-alt-marker__line" aria-hidden="true" />
      <span className="cs-alt-marker__label">
        {label}
        <span className="cs-alt-marker__arrow" aria-hidden="true">
          ↓
        </span>
      </span>
      <span className="cs-alt-marker__line" aria-hidden="true" />
      {!readOnly && onDelete ? <TimeMarkerRowMenu menuMode={menuMode} onDelete={onDelete} /> : null}
    </div>
  )
}
