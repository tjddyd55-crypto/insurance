import { formatTotalAmountLabel } from '../domain/formatAmount'

type Props = {
  currentTotal: number
  proposedTotal: number
}

export function MobilePreviewStickyDock({ currentTotal, proposedTotal }: Props) {
  return (
    <div className="cs-mobile-dock cs-mobile-dock--totals-only" data-testid="coverage-simulator-mobile-sticky-dock">
      <div className="cs-mobile-dock__summary cs-mobile-dock__summary--compact" aria-live="polite">
        <div className="cs-mobile-dock__col">
          <span className="cs-mobile-dock__label">기존 총보장</span>
          <span className="cs-mobile-dock__value">{formatTotalAmountLabel(currentTotal)}</span>
        </div>
        <div className="cs-mobile-dock__divider" aria-hidden="true" />
        <div className="cs-mobile-dock__col cs-mobile-dock__col--proposed">
          <span className="cs-mobile-dock__label">제안 총보장</span>
          <span className="cs-mobile-dock__value cs-mobile-dock__value--proposed">
            {formatTotalAmountLabel(proposedTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
