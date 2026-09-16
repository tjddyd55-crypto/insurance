import type { CustomerDetailCoreSectionId } from './customerDetailCoreSectionOrder'

/** Native `customerSectionTheme.ts` 와 동일한 섹션 accent SSOT */
export type CustomerSectionThemeId =
  | 'basic'
  | 'car'
  | 'linked'
  | 'business'
  | 'fire'
  | 'anniversary'

export type CustomerSectionTheme = {
  accent: string
  tint: string
}

export const CUSTOMER_SECTION_THEMES: Record<CustomerSectionThemeId, CustomerSectionTheme> = {
  basic: { accent: '#334155', tint: '#F8FAFC' },
  car: { accent: '#2563EB', tint: '#EFF6FF' },
  linked: { accent: '#14B8A6', tint: '#F0FDFA' },
  business: { accent: '#16A34A', tint: '#F0FDF4' },
  fire: { accent: '#D97706', tint: '#FFFBEB' },
  anniversary: { accent: '#7C3AED', tint: '#F5F3FF' },
}

const CORE_SECTION_THEME_ID: Record<CustomerDetailCoreSectionId, CustomerSectionThemeId> = {
  basic: 'basic',
  vehicle: 'car',
  linked: 'linked',
  fireInsurance: 'fire',
  business: 'business',
  alertDates: 'anniversary',
}

export function customerDetailSectionTheme(
  sectionId: CustomerDetailCoreSectionId,
): CustomerSectionTheme {
  return CUSTOMER_SECTION_THEMES[CORE_SECTION_THEME_ID[sectionId]]
}

export const CUSTOMER_DETAIL_COLLAPSED_BORDER_WIDTH = 1
export const CUSTOMER_DETAIL_EXPANDED_BORDER_WIDTH = 1.5
