import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_FAVORITE_CATALOG_IDS,
  getFavoriteCatalogIds,
  setFavoriteCatalogIds,
  toggleFavoriteCatalogId,
} from './favoriteRepository'
import { COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY } from './scenarioRepository'

const USER = COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY
const KEY = 'coverage-simulator-preview-mobile:favorites:v1'

describe('favoriteRepository', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null
      },
      setItem(k: string, v: string) {
        this.store[k] = v
      },
      removeItem(k: string) {
        delete this.store[k]
      },
      clear() {
        this.store = {}
      },
    })
    localStorage.clear()
  })

  it('returns default favorites when never persisted', () => {
    expect(getFavoriteCatalogIds(USER)).toEqual([...DEFAULT_FAVORITE_CATALOG_IDS])
  })

  it('toggleFavoriteCatalogId add and remove', () => {
    const afterAdd = toggleFavoriteCatalogId(USER, 'chemo')
    expect(afterAdd).toContain('chemo')
    const afterRemove = toggleFavoriteCatalogId(USER, 'chemo')
    expect(afterRemove).not.toContain('chemo')
  })

  it('deduplicates on save', () => {
    const saved = setFavoriteCatalogIds(USER, ['a', 'a', 'b'])
    expect(saved).toEqual(['a', 'b'])
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['a', 'b'])
  })

  it('ignores unknown user key writes', () => {
    expect(setFavoriteCatalogIds('unknown', ['x'])).toEqual(['x'])
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
