import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react'

import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
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
import { FormSection } from './form-primitives'

export type AddItemFormBodyHandle = {
  submitDirectAdd: () => boolean
}

type Props = {
  favoriteUserKey?: string | null
  onSelectCoverage: (input: { label: string; category: ScenarioItemCategory }) => void
  onSelectTimeMarker: (label: string) => void
  onClose: () => void
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

export const AddItemFormBody = forwardRef<AddItemFormBodyHandle, Props>(function AddItemFormBody(
  { favoriteUserKey = null, onSelectCoverage, onSelectTimeMarker, onClose },
  ref,
) {
  const [tab, setTab] = useState<CatalogTabId>('favorite')
  const [customLabel, setCustomLabel] = useState('')
  const [customCategory, setCustomCategory] = useState<ScenarioItemCategory>('other')
  const [customTimeLabel, setCustomTimeLabel] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    favoriteUserKey ? getFavoriteCatalogIds(favoriteUserKey) : [],
  )

  const useFavorites = Boolean(favoriteUserKey)
  const items = useMemo(() => filterByTab(tab, favoriteIds), [tab, favoriteIds])

  const selectItem = (item: CatalogItem) => {
    onSelectCoverage({ label: item.label, category: item.category })
    onClose()
  }

  const submitDirectAdd = useCallback((): boolean => {
    const label = customLabel.trim()
    if (!label) return false
    onSelectCoverage({ label, category: customCategory })
    onClose()
    return true
  }, [customCategory, customLabel, onClose, onSelectCoverage])

  useImperativeHandle(ref, () => ({ submitDirectAdd }), [submitDirectAdd])

  const toggleFavorite = (catalogId: string) => {
    if (!favoriteUserKey) return
    setFavoriteIds(toggleFavoriteCatalogId(favoriteUserKey, catalogId))
  }

  return (
    <>
      <FormSection>
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
                <FormButton
                  variant="action"
                  className="coverage-simulator-catalog-row__main"
                  onClick={() => selectItem(item)}
                >
                  {item.label}
                </FormButton>
                {useFavorites ? (
                  <FormButton
                    variant="action"
                    className={`coverage-simulator-catalog-row__star${favoriteIds.includes(item.id) ? ' coverage-simulator-catalog-row__star--on' : ''}`}
                    aria-label={favoriteIds.includes(item.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    onClick={() => toggleFavorite(item.id)}
                  >
                    {favoriteIds.includes(item.id) ? '★' : '☆'}
                  </FormButton>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </FormSection>
      <FormSection title="직접 추가">
        <div className="cs-form-primitive__direct-add">
          <FormInput
            id="cs-add-custom-label"
            value={customLabel}
            placeholder="항목명을 입력하세요"
            className="cs-form-primitive__direct-add-input"
            onChange={(event) => setCustomLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitDirectAdd()
              }
            }}
          />
          <FormButton variant="primary" className="cs-form-primitive__direct-add-btn" onClick={submitDirectAdd}>
            추가
          </FormButton>
        </div>
      </FormSection>
      <FormSection title="카테고리">
        <CategoryChipPicker compact value={customCategory} onChange={setCustomCategory} />
      </FormSection>
      <FormSection title="시간 구간">
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
        <div className="cs-form-primitive__field cs-form-primitive__field--time-custom">
          <label className="cs-form-primitive__label" htmlFor="cs-add-custom-time">직접 입력</label>
          <div className="cs-form-primitive__direct-add">
            <FormInput
              id="cs-add-custom-time"
              value={customTimeLabel}
              placeholder="예: 18개월 후"
              className="cs-form-primitive__direct-add-input"
              onChange={(event) => setCustomTimeLabel(event.target.value)}
            />
            <FormButton
              variant="primary"
              className="cs-form-primitive__direct-add-btn"
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
      </FormSection>
    </>
  )
})
