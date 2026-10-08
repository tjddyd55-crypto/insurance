import { getInsuranceAgeDdayLabel } from '../utils/customerDetailPresentation'

type Props = {
  nextAgeDate: string | null | undefined
  className?: string
}

/** Native `CustomerNextAgeDateDetailRow` D-day — primary 색, 배지 없음 */
export function CustomerInsuranceAgeDdayInline({ nextAgeDate, className }: Props) {
  const label = getInsuranceAgeDdayLabel(nextAgeDate)
  if (!label) {
    return null
  }
  return (
    <span className={['customer-insurance-age-dday', className].filter(Boolean).join(' ')}>
      {label}
    </span>
  )
}
