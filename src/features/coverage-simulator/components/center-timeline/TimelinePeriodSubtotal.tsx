import { formatTotalAmountLabel } from '../../domain/formatAmount'

type Props = {
  currentTotal: number
  proposedTotal: number
}

function formatPeriodSide(amount: number): string {
  if (amount <= 0) return '없음'
  return formatTotalAmountLabel(amount)
}

export function TimelinePeriodSubtotal({ currentTotal, proposedTotal }: Props) {
  return (
    <div className="cs-axis-period-total" data-testid="coverage-period-subtotal">
      <div className="cs-axis-period-total__label">구간 합계</div>
      <div className="cs-axis-period-total__compare" aria-label="구간 합계 기존 및 제안">
        <span className="cs-axis-period-total__value">{formatPeriodSide(currentTotal)}</span>
        <span className="cs-axis-period-total__spine" aria-hidden="true" />
        <span className="cs-axis-period-total__value cs-axis-period-total__value--proposed">
          {formatPeriodSide(proposedTotal)}
        </span>
      </div>
    </div>
  )
}
