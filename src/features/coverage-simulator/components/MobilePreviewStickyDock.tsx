import { formatTotalAmountLabel } from '../domain/formatAmount'

type Props = {
  currentTotal: number
  proposedTotal: number
  onReset: () => void
  onPdf?: () => void
  resetLabel?: string
  secondaryAction?: { label: string; onClick: () => void }
}

export function MobilePreviewStickyDock({
  currentTotal,
  proposedTotal,
  onReset,
  onPdf,
  resetLabel = '초기화',
  secondaryAction,
}: Props) {
  const rightAction = secondaryAction ?? (onPdf ? { label: 'PDF 보기', onClick: onPdf } : null)

  return (
    <div className="cs-mobile-dock" data-testid="coverage-simulator-mobile-sticky-dock">
      <div className="cs-mobile-dock__summary" aria-live="polite">
        <div className="cs-mobile-dock__col">
          <span className="cs-mobile-dock__label">기존 총보장</span>
          <span className="cs-mobile-dock__value">{formatTotalAmountLabel(currentTotal)}</span>
        </div>
        <div className="cs-mobile-dock__col cs-mobile-dock__col--proposed">
          <span className="cs-mobile-dock__label">제안 총보장</span>
          <span className="cs-mobile-dock__value cs-mobile-dock__value--proposed">
            {formatTotalAmountLabel(proposedTotal)}
          </span>
        </div>
      </div>
      <div className="cs-mobile-dock__actions">
        <button type="button" className="cs-mobile-dock__action" onClick={onReset}>
          {resetLabel}
        </button>
        {rightAction ? (
          <button type="button" className="cs-mobile-dock__action cs-mobile-dock__action--secondary" onClick={rightAction.onClick}>
            {rightAction.label}
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
