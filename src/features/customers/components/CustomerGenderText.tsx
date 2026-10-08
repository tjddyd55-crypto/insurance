import type { CustomerRecord } from '../domain/types'
import { formatCustomerGenderReadLabel } from '../utils/customerDisplayFormat'
import {
  customerGenderPresentationClassName,
  resolveCustomerGenderPresentationTone,
} from '../utils/customerGenderPresentation'

type Props = {
  gender: CustomerRecord['gender']
  ssn?: string | null
  className?: string
}

/** 고객 성별 표시 — Native 이름 옆 (남)/(여) 색상(info/danger)과 동일 */
export function CustomerGenderText({ gender, ssn, className }: Props) {
  const label = formatCustomerGenderReadLabel(gender, ssn ?? null)
  if (!label || label === '-') {
    return <span className={className}>{label || '—'}</span>
  }
  const tone = resolveCustomerGenderPresentationTone(gender, ssn)
  const toneClass = customerGenderPresentationClassName(tone)
  return (
    <span className={[toneClass, className].filter(Boolean).join(' ')}>{label}</span>
  )
}
