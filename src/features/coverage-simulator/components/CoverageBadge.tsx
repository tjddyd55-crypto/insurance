import { coverageCategoryBadgeClass } from '../domain/categoryBadgeTheme'
import type { ScenarioItemCategory } from '../domain/types'
import { categoryLabel } from '../domain/itemCatalog'

export function CoverageBadge({ category }: { category: ScenarioItemCategory }) {
  return (
    <span className={`coverage-simulator-badge ${coverageCategoryBadgeClass(category)}`}>
      <span className="coverage-simulator-badge__label">{categoryLabel(category)}</span>
    </span>
  )
}
