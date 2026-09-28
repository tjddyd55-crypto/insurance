import { formatCoverageAmountLabel } from '../../domain/formatAmount'

type Props = {
  amount: number | null
  tone: 'current' | 'proposed'
}

export function AltAmount({ amount, tone }: Props) {
  const empty = amount == null || amount <= 0
  const className = [
    'cs-alt-amount',
    tone === 'current' ? 'cs-alt-amount--current' : 'cs-alt-amount--proposed',
    empty ? 'cs-alt-amount--empty' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={className}>{formatCoverageAmountLabel(amount)}</span>
}
