import { useMemo, useState } from 'react'

import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import FormSelect from '../../../components/form/FormSelect'
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

type AddItemSheetProps = {
  open: boolean
  onClose: () => void
  onSelectCoverage: (input: { label: string; category: ScenarioItemCategory }) => void
  onSelectTimeMarker: (label: string) => void
  favoriteUserKey?: string | null
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

/** Desktop / modal sheet — mobile uses `CoverageSimulatorMobileItemForm`. */
export function AddItemSheet({
  open,
  onClose,
  onSelectCoverage,
  onSelectTimeMarker,
  favoriteUserKey = null,
}: AddItemSheetProps) {
  useCoverageSimulatorOverlayScrollLock(open)
  const [tab, setTab] = useState<CatalogTabId>('favorite')
  const [customLabel, setCustomLabel] = useState('')
  const [customCategory, setCustomCategory] = useState<ScenarioItemCategory>('other')
  const [customTimeLabel, setCustomTimeLabel] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    favoriteUserKey && open ? getFavoriteCatalogIds(favoriteUserKey) : [],
  )

  const items = useMemo(() => filterByTab(tab, favoriteIds), [tab, favoriteIds])

  if (!open) return null

  const selectItem = (item: CatalogItem) => {
    onSelectCoverage({ label: item.label, category: item.category })
    onClose()
  }

  const toggleFavorite = (catalogId: string) => {
    if (!favoriteUserKey) return
    setFavoriteIds(toggleFavoriteCatalogId(favoriteUserKey, catalogId))
  }

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="coverage-simulator-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="항목 추가"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header coverage-simulator-sheet-header--compact">
          <div className="coverage-simulator-sheet__title">항목 추가</div>
          <FormButton
            variant="action"
            className="coverage-simulator-sheet-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </FormButton>
        </div>
        <div className="coverage-simulator-tabs coverage-simulator-tabs--compact">
          {CATALOG_TABS.map((entry) => (
            <FormButton
              key={entry.id}
              variant="action"
              className={`coverage-simulator-tab${tab === entry.id ? ' coverage-simulator-tab--active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </FormButton>
          ))}
        </div>
        <div className="coverage-simulator-catalog-grid">
          {items.map((item) => (
            <FormButton key={item.id} variant="action" className="coverage-simulator-catalog-item" onClick={() => selectItem(item)}>
              <span>{item.label}</span>
              {favoriteUserKey ? (
                <FormButton
                  variant="action"
                  className="coverage-simulator-catalog-item__star"
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleFavorite(item.id)
                  }}
                >
                  ★
                </FormButton>
              ) : null}
            </FormButton>
          ))}
        </div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="custom-label">직접 항목명</label>
          <FormInput
            id="custom-label"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            placeholder="예: 간병비"
          />
        </div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="custom-category">카테고리</label>
          <FormSelect
            id="custom-category"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value as ScenarioItemCategory)}
            options={[
              { value: 'diagnosis', label: '진단' },
              { value: 'treatment', label: '치료' },
              { value: 'recovery', label: '회복' },
              { value: 'support', label: '지원' },
              { value: 'other', label: '기타' },
            ]}
          />
        </div>
        <div className="coverage-simulator-sheet__title coverage-simulator-sheet__title--subsection">시간 구간</div>
        <div className="coverage-simulator-catalog-grid coverage-simulator-catalog-grid--time">
          {TIME_MARKER_PRESETS.map((label) => (
            <FormButton
              key={label}
              variant="action"
              className="coverage-simulator-catalog-item"
              onClick={() => {
                onSelectTimeMarker(label)
                onClose()
              }}
            >
              🕐 {label}
            </FormButton>
          ))}
        </div>
        <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
          <label htmlFor="custom-time">직접 입력</label>
          <div className="coverage-simulator-amount-input-row">
            <FormInput
              id="custom-time"
              value={customTimeLabel}
              onChange={(event) => setCustomTimeLabel(event.target.value)}
              placeholder="예: 18개월 후"
            />
            <FormButton
              variant="primary"
              onClick={() => {
                if (!customTimeLabel.trim()) return
                onSelectTimeMarker(customTimeLabel.trim())
                onClose()
              }}
            >
              추가
            </FormButton>
          </div>
        </div>
        <div className="coverage-simulator-sheet-actions">
          <FormButton variant="secondary" onClick={onClose}>취소</FormButton>
          <FormButton
            variant="primary"
            onClick={() => {
              const label = customLabel.trim()
              if (!label) return
              onSelectCoverage({ label, category: customCategory })
              onClose()
            }}
          >
            추가
          </FormButton>
        </div>
      </div>
    </div>
  )
}
