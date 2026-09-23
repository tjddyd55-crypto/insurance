import { useMemo, useState } from 'react'

import {
  CATALOG_TABS,
  COVERAGE_ITEM_CATALOG,
  TIME_MARKER_PRESETS,
  type CatalogTabId,
} from '../domain/itemCatalog'
import type { ScenarioItemCategory } from '../domain/types'

type AddItemSheetProps = {
  open: boolean
  onClose: () => void
  onSelectCoverage: (input: { label: string; category: ScenarioItemCategory }) => void
  onSelectTimeMarker: (label: string) => void
}

export function AddItemSheet({ open, onClose, onSelectCoverage, onSelectTimeMarker }: AddItemSheetProps) {
  const [tab, setTab] = useState<CatalogTabId>('favorite')
  const [customLabel, setCustomLabel] = useState('')
  const [customCategory, setCustomCategory] = useState<ScenarioItemCategory>('other')
  const [customTimeLabel, setCustomTimeLabel] = useState('')

  const items = useMemo(() => {
    if (tab === 'favorite') {
      return COVERAGE_ITEM_CATALOG.filter((item) => item.defaultFavorite)
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
  }, [tab])

  if (!open) return null

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="coverage-simulator-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="항목 추가"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header">
          <div className="coverage-simulator-sheet__title">항목 추가</div>
          <button type="button" className="coverage-simulator-sheet-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="coverage-simulator-tabs">
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
        <div className="coverage-simulator-catalog-grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="coverage-simulator-catalog-item"
              onClick={() => {
                onSelectCoverage({ label: item.label, category: item.category })
                onClose()
              }}
            >
              <span>{item.label}</span>
              {item.defaultFavorite ? <span className="coverage-simulator-catalog-item__star" aria-hidden="true">★</span> : <span />}
            </button>
          ))}
          <button
            type="button"
            className="coverage-simulator-catalog-item"
            onClick={() => {
              const label = customLabel.trim() || '직접 입력 항목'
              onSelectCoverage({ label, category: customCategory })
              onClose()
            }}
          >
            <span>+ 기타 직접 입력</span>
            <span />
          </button>
        </div>

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

        <div className="coverage-simulator-sheet__title" style={{ marginTop: 8, marginBottom: 12 }}>시간 구간</div>
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
        <div className="coverage-simulator-form-field">
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
      </div>
    </div>
  )
}
