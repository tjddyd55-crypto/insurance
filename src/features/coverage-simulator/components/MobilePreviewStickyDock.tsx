import { formatTotalAmountLabel } from '../domain/formatAmount'

type Props = {
  currentTotal: number
  proposedTotal: number
}

export function MobilePreviewStickyDock({ currentTotal, proposedTotal }: Props) {
  return (
    <div className="cs-mobile-dock cs-mobile-dock--totals-only" data-testid="coverage-simulator-mobile-sticky-dock">
      <div className="cs-mobile-dock__panel" aria-live="polite">
        <div className="cs-mobile-dock__column">
          <span className="cs-mobile-dock__label">기존 총보장</span>
          <span className="cs-mobile-dock__amount">{formatTotalAmountLabel(currentTotal)}</span>
        </div>
        <div className="cs-mobile-dock__vdiv" aria-hidden="true" />
        <div className="cs-mobile-dock__column cs-mobile-dock__column--proposed">
          <span className="cs-mobile-dock__label">제안 총보장</span>
          <span className="cs-mobile-dock__amount cs-mobile-dock__amount--proposed">
            {formatTotalAmountLabel(proposedTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
