import type { ScenarioItemCategory } from './types'

export type CatalogItem = {
  id: string
  label: string
  category: ScenarioItemCategory
  defaultFavorite?: boolean
}

export type CatalogTabId = 'favorite' | 'treatment' | 'support' | 'other'

export const CATALOG_TABS: { id: CatalogTabId; label: string }[] = [
  { id: 'favorite', label: '즐겨찾기' },
  { id: 'treatment', label: '치료 관련' },
  { id: 'support', label: '생활 지원' },
  { id: 'other', label: '기타' },
]

export const COVERAGE_ITEM_CATALOG: CatalogItem[] = [
  { id: 'nursing', label: '간병비', category: 'support', defaultFavorite: true },
  { id: 'hospitalization', label: '입원비', category: 'treatment' },
  { id: 'outpatient', label: '통원치료비', category: 'treatment' },
  { id: 'targeted-therapy', label: '표적항암치료', category: 'treatment', defaultFavorite: true },
  { id: 'hormone-therapy', label: '항암호르몬치료', category: 'treatment' },
  { id: 'rehab', label: '재활치료비', category: 'recovery' },
  { id: 'living-support', label: '생활비 지원', category: 'support' },
  { id: 'cancer-diagnosis', label: '암 진단금', category: 'diagnosis', defaultFavorite: true },
  { id: 'cancer-surgery', label: '암 수술비', category: 'treatment', defaultFavorite: true },
  { id: 'chemo', label: '항암약물치료', category: 'treatment', defaultFavorite: true },
  { id: 'radiation', label: '방사선치료', category: 'treatment', defaultFavorite: true },
]

export const TIME_MARKER_PRESETS = ['3개월 후', '6개월 후', '1년 후', '2년 후'] as const

export function categoryLabel(category: ScenarioItemCategory): string {
  switch (category) {
    case 'diagnosis':
      return '진단'
    case 'treatment':
      return '치료'
    case 'recovery':
      return '회복'
    case 'support':
      return '지원'
    default:
      return '기타'
  }
}
