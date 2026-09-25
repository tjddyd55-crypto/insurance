import { formatTotalAmountLabel } from '../../domain/formatAmount'
import { MobilePreviewStickyDock } from '../MobilePreviewStickyDock'

type Props = {
  currentTotal: number
  proposedTotal: number
  /** Editable mobile dock — position only; visual tokens are identical */
  sticky?: boolean
  className?: string
}

export function CoverageGrandTotal({
  currentTotal,
  proposedTotal,
  sticky = false,
  className = '',
}: Props) {
  if (sticky) {
    return (
      <MobilePreviewStickyDock currentTotal={currentTotal} proposedTotal={proposedTotal} />
    )
  }

  return (
    <footer
      className={[
        'cs-axis-summary coverage-simulator-summary',
        sticky ? 'cs-axis-summary--sticky' : 'cs-axis-summary--static',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="coverage-grand-total"
    >
      <div className="cs-axis-summary__compare">
        <div className="cs-axis-summary__col">
          <span className="cs-axis-summary__label">기존 총 보장</span>
          <span className="cs-axis-summary__value coverage-simulator-summary__value">
            {formatTotalAmountLabel(currentTotal)}
          </span>
        </div>
        <div className="cs-axis-summary__spine" aria-hidden="true" />
        <div className="cs-axis-summary__col cs-axis-summary__col--proposed">
          <span className="cs-axis-summary__label">제안 총 보장</span>
          <span className="cs-axis-summary__value cs-axis-summary__value--proposed coverage-simulator-summary__value coverage-simulator-summary__value--proposed">
            {formatTotalAmountLabel(proposedTotal)}
          </span>
        </div>
      </div>
    </footer>
  )
}
