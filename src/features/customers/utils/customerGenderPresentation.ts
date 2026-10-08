import type { CustomerRecord } from '../domain/types'
import { inferGenderFromResidentNumberDigits } from './inferGenderFromResidentNumberDigits'

/** Native `customerDetailPresentation` / `themes.ts` (info·danger) 와 동일 semantic */
export type CustomerGenderPresentationTone = 'male' | 'female'

export const CUSTOMER_GENDER_PRESENTATION_CLASS: Record<CustomerGenderPresentationTone, string> = {
  male: 'customer-gender-text customer-gender-text--male',
  female: 'customer-gender-text customer-gender-text--female',
}

export function getCustomerGenderPresentationTone(
  gender: CustomerRecord['gender'],
): CustomerGenderPresentationTone | null {
  if (gender === 'male' || gender === 'female') {
    return gender
  }
  return null
}

export function resolveCustomerGenderPresentationTone(
  gender: CustomerRecord['gender'],
  ssnRaw?: string | null,
): CustomerGenderPresentationTone | null {
  const fromGender = getCustomerGenderPresentationTone(gender)
  if (fromGender) {
    return fromGender
  }
  const fromSsn = inferGenderFromResidentNumberDigits(ssnRaw)
  return fromSsn === 'male' || fromSsn === 'female' ? fromSsn : null
}

export function customerGenderPresentationClassName(
  tone: CustomerGenderPresentationTone | null,
): string | undefined {
  if (!tone) {
    return undefined
  }
  return CUSTOMER_GENDER_PRESENTATION_CLASS[tone]
}
