import { MOCK_LIFE_INSURERS, MOCK_NON_LIFE_INSURERS } from '../domain/mockCompanies'

/** GA 메타 — 향후 ga 테이블·API로 대체 */
export const GA_OPTIONS = Object.freeze([
  { id: 1, name: 'GA 데모 1' },
  { id: 2, name: 'GA 데모 2' },
])

export const ALL_INSURER_OPTIONS = Object.freeze([
  ...MOCK_LIFE_INSURERS,
  ...MOCK_NON_LIFE_INSURERS,
])

export function gaLabel(gaId: number): string {
  return GA_OPTIONS.find((g) => g.id === gaId)?.name ?? `GA #${gaId}`
}

export function insurerLabel(insuranceCompanyId: string): string {
  return ALL_INSURER_OPTIONS.find((c) => c.id === insuranceCompanyId)?.name ?? insuranceCompanyId
}

export function pdfFileNameFromKey(storageKey: string): string {
  const parts = storageKey.split('/')
  return parts[parts.length - 1] || storageKey
}
