import { COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY } from './scenarioRepository'

const MOBILE_FAVORITES_KEY = 'coverage-simulator-preview-mobile:favorites:v1'

/** 최초 미설정 시 UI에만 적용. localStorage에 쓰기 전까지 사용자 변경과 구분 */
export const DEFAULT_FAVORITE_CATALOG_IDS = ['nursing', 'hospitalization', 'targeted-therapy'] as const

function storageKeyForUser(userKey: string): string | null {
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY) {
    return MOBILE_FAVORITES_KEY
  }
  return null
}

function readPersisted(userKey: string): string[] | null {
  const key = storageKeyForUser(userKey)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writePersisted(userKey: string, ids: string[]): void {
  const key = storageKeyForUser(userKey)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids))
}

export function getFavoriteCatalogIds(userKey: string): string[] {
  const persisted = readPersisted(userKey)
  if (persisted) return persisted
  return [...DEFAULT_FAVORITE_CATALOG_IDS]
}

export function hasPersistedFavorites(userKey: string): boolean {
  return readPersisted(userKey) !== null
}

export function setFavoriteCatalogIds(userKey: string, ids: string[]): string[] {
  const unique = [...new Set(ids)]
  writePersisted(userKey, unique)
  return unique
}

export function toggleFavoriteCatalogId(userKey: string, catalogId: string): string[] {
  const base = getFavoriteCatalogIds(userKey)
  const next = base.includes(catalogId)
    ? base.filter((id) => id !== catalogId)
    : [...base, catalogId]
  return setFavoriteCatalogIds(userKey, next)
}

export function isFavoriteCatalogId(userKey: string, catalogId: string): boolean {
  return getFavoriteCatalogIds(userKey).includes(catalogId)
}
