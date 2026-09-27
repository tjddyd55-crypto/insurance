import { formatTotalAmountLabel } from '../../domain/formatAmount'

type Props = {
  heading: string
  currentTotal: number
  proposedTotal: number
}

function formatPeriodSide(amount: number): string {
  if (amount <= 0) return '없음'
  return formatTotalAmountLabel(amount)
}

export function CoverageScenarioSubtotalRow({ heading, currentTotal, proposedTotal }: Props) {
  return (
    <div className="cs-alt-subtotal" data-testid="coverage-alt-subtotal" aria-label={`${heading} 기존 및 제안`}>
      <span className="cs-alt-subtotal__spacer" aria-hidden="true" />
      <span className="cs-alt-amount cs-alt-amount--current">{formatPeriodSide(currentTotal)}</span>
      <span className="cs-alt-subtotal__label">{heading}</span>
      <span className="cs-alt-amount cs-alt-amount--proposed">{formatPeriodSide(proposedTotal)}</span>
      <span className="cs-alt-subtotal__spacer" aria-hidden="true" />
    </div>
  )
}
