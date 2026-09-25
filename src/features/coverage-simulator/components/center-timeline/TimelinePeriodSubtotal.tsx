import { formatTotalAmountLabel } from '../../domain/formatAmount'
import { periodSubtotalLabelFromMarker } from '../../domain/periodSubtotalLabel'

type Props = {
  markerLabel: string
  currentTotal: number
  proposedTotal: number
  hideColumnLabels?: boolean
}

function formatPeriodSide(amount: number): string {
  if (amount <= 0) return '없음'
  return formatTotalAmountLabel(amount)
}

export function TimelinePeriodSubtotal({
  markerLabel,
  currentTotal,
  proposedTotal,
  hideColumnLabels = false,
}: Props) {
  const heading = periodSubtotalLabelFromMarker(markerLabel)

  return (
    <div className="cs-axis-period-total" data-testid="coverage-period-subtotal">
      <p className="cs-axis-period-total__heading">
        <span className="cs-axis-period-total__heading-mask">{heading}</span>
      </p>
      <div className="cs-axis-period-total__compare" aria-label={`${heading} 기존 및 제안`}>
        <div className="cs-axis-period-total__col">
          {hideColumnLabels ? null : <span className="cs-axis-period-total__side">기존</span>}
          <span className="cs-axis-period-total__value cs-axis-period-total__value-mask">
            {formatPeriodSide(currentTotal)}
          </span>
        </div>
        <span className="cs-axis-period-total__spine" aria-hidden="true" />
        <div className="cs-axis-period-total__col cs-axis-period-total__col--proposed">
          {hideColumnLabels ? null : <span className="cs-axis-period-total__side">제안</span>}
          <span className="cs-axis-period-total__value cs-axis-period-total__value--proposed cs-axis-period-total__value-mask">
            {formatPeriodSide(proposedTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
