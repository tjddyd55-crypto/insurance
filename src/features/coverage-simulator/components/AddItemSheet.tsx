import { useEffect, useMemo, useState } from 'react'

import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'

import {
  CATALOG_TABS,
  COVERAGE_ITEM_CATALOG,
  TIME_MARKER_PRESETS,
  type CatalogItem,
  type CatalogTabId,
} from '../domain/itemCatalog'
import type { ScenarioItemCategory } from '../domain/types'
import { getFavoriteCatalogIds, toggleFavoriteCatalogId } from '../storage/favoriteRepository'
import { CategoryChipPicker } from './CategoryChipPicker'

type AddItemSheetProps = {
  open: boolean
  onClose: () => void
  onSelectCoverage: (input: { label: string; category: ScenarioItemCategory }) => void
  onSelectTimeMarker: (label: string) => void
  favoriteUserKey?: string | null
  mobileCompact?: boolean
}

function filterByTab(tab: CatalogTabId, favoriteIds: string[]): CatalogItem[] {
  if (tab === 'favorite') {
    return COVERAGE_ITEM_CATALOG.filter((item) => favoriteIds.includes(item.id))
  }
  if (tab === 'treatment') {
    return COVERAGE_ITEM_CATALOG.filter((item) =>
      ['diagnosis', 'treatment', 'recovery'].includes(item.category),
    )
  }
  if (tab === 'support') {
    return COVERAGE_ITEM_CATALOG.filter((item) => item.category === 'support')
  }
  return COVERAGE_ITEM_CATALOG
}

export function AddItemSheet({
  open,
  onClose,
  onSelectCoverage,
  onSelectTimeMarker,
  favoriteUserKey = null,
  mobileCompact = false,
}: AddItemSheetProps) {
  useCoverageSimulatorOverlayScrollLock(open)
  const [tab, setTab] = useState<CatalogTabId>('favorite')
  const [customLabel, setCustomLabel] = useState('')
  const [customCategory, setCustomCategory] = useState<ScenarioItemCategory>('other')
  const [customTimeLabel, setCustomTimeLabel] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  const useFavorites = Boolean(favoriteUserKey)

  useEffect(() => {
    if (!open || !favoriteUserKey) return
    setFavoriteIds(getFavoriteCatalogIds(favoriteUserKey))
  }, [open, favoriteUserKey])

  const items = useMemo(() => filterByTab(tab, favoriteIds), [tab, favoriteIds])

  const toggleFavorite = (catalogId: string) => {
    if (!favoriteUserKey) return
    setFavoriteIds(toggleFavoriteCatalogId(favoriteUserKey, catalogId))
  }

  if (!open) return null

  const selectItem = (item: CatalogItem) => {
    onSelectCoverage({ label: item.label, category: item.category })
    onClose()
  }

  const submitDirectAdd = () => {
    const label = customLabel.trim()
    if (!label) return
    onSelectCoverage({ label, category: customCategory })
    setCustomLabel('')
    onClose()
  }

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`coverage-simulator-sheet${mobileCompact ? ' coverage-simulator-sheet--compact coverage-simulator-sheet--mobile-add' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="항목 추가"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header coverage-simulator-sheet-header--compact">
          <div className="coverage-simulator-sheet__title">항목 추가</div>
          <button type="button" className="coverage-simulator-sheet-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="coverage-simulator-tabs coverage-simulator-tabs--compact">
          {CATALOG_TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`coverage-simulator-tab${tab === entry.id ? ' coverage-simulator-tab--active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {mobileCompact ? (
          <div className="cs-sheet-body-scroll">
            {tab === 'favorite' && items.length === 0 ? (
              <p className="cs-catalog-empty">
                즐겨찾기한 항목이 없습니다.
                <br />
                다른 목록의 ☆를 눌러 추가할 수 있습니다.
              </p>
            ) : (
              <div className="coverage-simulator-catalog-list">
                {items.map((item) => (
                  <div key={item.id} className="coverage-simulator-catalog-row">
                    <button type="button" className="coverage-simulator-catalog-row__main" onClick={() => selectItem(item)}>
                      <span>{item.label}</span>
                    </button>
                    {useFavorites ? (
                      <button
                        type="button"
                        className={`coverage-simulator-catalog-row__star${favoriteIds.includes(item.id) ? ' coverage-simulator-catalog-row__star--on' : ''}`}
                        aria-label={favoriteIds.includes(item.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleFavorite(item.id)
                        }}
                      >
                        {favoriteIds.includes(item.id) ? '★' : '☆'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <div className="cs-direct-add">
              <div className="cs-direct-add__label">직접 추가</div>
              <div className="cs-direct-add__row">
                <input
                  id="custom-label"
                  value={customLabel}
                  placeholder="항목명을 입력하세요"
                  onChange={(event) => setCustomLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      submitDirectAdd()
                    }
                  }}
                />
                <button type="button" className="cs-direct-add__submit" onClick={submitDirectAdd}>
                  추가
                </button>
              </div>
              <CategoryChipPicker compact value={customCategory} onChange={setCustomCategory} />
            </div>

            <div className="coverage-simulator-sheet__title coverage-simulator-sheet__title--subsection">시간 구간</div>
            <div className="coverage-simulator-catalog-grid coverage-simulator-catalog-grid--time">
              {TIME_MARKER_PRESETS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="coverage-simulator-catalog-item"
                  onClick={() => {
                    onSelectTimeMarker(label)
                    onClose()
                  }}
                >
                  🕐 {label}
                </button>
              ))}
            </div>
            <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
              <label htmlFor="custom-time">직접 입력</label>
              <div className="coverage-simulator-amount-input-row">
                <input
                  id="custom-time"
                  value={customTimeLabel}
                  onChange={(event) => setCustomTimeLabel(event.target.value)}
                  placeholder="예: 18개월 후"
                />
                <button
                  type="button"
                  className="coverage-simulator-primary-btn"
                  style={{ padding: '0 12px', height: 36 }}
                  onClick={() => {
                    if (!customTimeLabel.trim()) return
                    onSelectTimeMarker(customTimeLabel.trim())
                    onClose()
                  }}
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="coverage-simulator-catalog-grid">
              {items.map((item) => (
                <button key={item.id} type="button" className="coverage-simulator-catalog-item" onClick={() => selectItem(item)}>
                  <span>{item.label}</span>
                  {item.defaultFavorite ? <span className="coverage-simulator-catalog-item__star" aria-hidden="true">★</span> : <span />}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="coverage-simulator-catalog-item"
              onClick={() => {
                onSelectCoverage({ label: customLabel.trim() || '직접 입력 항목', category: customCategory })
                onClose()
              }}
            >
              <span>+ 기타 직접 입력</span>
            </button>
            <div className="coverage-simulator-form-field" style={{ marginTop: 16 }}>
              <label htmlFor="custom-label">직접 항목명</label>
              <input
                id="custom-label"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="예: 간병비"
              />
            </div>
            <div className="coverage-simulator-form-field">
              <label htmlFor="custom-category">카테고리</label>
              <select
                id="custom-category"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value as ScenarioItemCategory)}
              >
                <option value="diagnosis">진단</option>
                <option value="treatment">치료</option>
                <option value="recovery">회복</option>
                <option value="support">지원</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div className="coverage-simulator-sheet__title coverage-simulator-sheet__title--subsection">시간 구간</div>
            <div className="coverage-simulator-catalog-grid coverage-simulator-catalog-grid--time">
              {TIME_MARKER_PRESETS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="coverage-simulator-catalog-item"
                  onClick={() => {
                    onSelectTimeMarker(label)
                    onClose()
                  }}
                >
                  🕐 {label}
                </button>
              ))}
            </div>
            <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
              <label htmlFor="custom-time">직접 입력</label>
              <div className="coverage-simulator-amount-input-row">
                <input
                  id="custom-time"
                  value={customTimeLabel}
                  onChange={(event) => setCustomTimeLabel(event.target.value)}
                  placeholder="예: 18개월 후"
                />
                <button
                  type="button"
                  className="coverage-simulator-primary-btn"
                  style={{ padding: '0 12px', height: 40 }}
                  onClick={() => {
                    if (!customTimeLabel.trim()) return
                    onSelectTimeMarker(customTimeLabel.trim())
                    onClose()
                  }}
                >
                  추가
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
