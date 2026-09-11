/** Figma ONE FC Customer Detail — section accent SSOT (Web + shared naming). */
export type CustomerSectionId =
  | 'basic'
  | 'car'
  | 'linked'
  | 'business'
  | 'fire'
  | 'anniversary'
  | 'consultation'
  | 'actions'
  | 'insurance-history'
  | 'account'

export type CustomerSectionTheme = {
  id: CustomerSectionId
  accent: string
  tint: string
}

export const CUSTOMER_SECTION_THEMES: Record<CustomerSectionId, CustomerSectionTheme> = {
  basic: { id: 'basic', accent: '#334155', tint: '#F8FAFC' },
  car: { id: 'car', accent: '#2563EB', tint: '#EFF6FF' },
  linked: { id: 'linked', accent: '#14B8A6', tint: '#F0FDFA' },
  business: { id: 'business', accent: '#16A34A', tint: '#F0FDF4' },
  fire: { id: 'fire', accent: '#D97706', tint: '#FFFBEB' },
  anniversary: { id: 'anniversary', accent: '#7C3AED', tint: '#F5F3FF' },
  consultation: { id: 'consultation', accent: '#16A34A', tint: '#F0FDF4' },
  /** 고객 업무 — brand primary (기본 정보 slate와 구분) */
  actions: { id: 'actions', accent: '#16A34A', tint: '#ECFDF5' },
  'insurance-history': { id: 'insurance-history', accent: '#334155', tint: '#F8FAFC' },
  account: { id: 'account', accent: '#334155', tint: '#F8FAFC' },
}

export function customerSectionDataAttr(sectionId: CustomerSectionId): string {
  return sectionId
}
