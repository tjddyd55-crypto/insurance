import { categoryLabel } from '../domain/itemCatalog'
import type { ScenarioItemCategory } from '../domain/types'

const CATEGORIES: ScenarioItemCategory[] = ['diagnosis', 'treatment', 'recovery', 'support', 'other']

type Props = {
  value: ScenarioItemCategory
  onChange: (value: ScenarioItemCategory) => void
}

export function CategoryChipPicker({ value, onChange }: Props) {
  return (
    <div className="cs-category-chips" role="group" aria-label="카테고리">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={`cs-category-chip cs-category-chip--${category}${value === category ? ' cs-category-chip--active' : ''}`}
          aria-pressed={value === category}
          onClick={() => onChange(category)}
        >
          {categoryLabel(category)}
        </button>
      ))}
    </div>
  )
}
