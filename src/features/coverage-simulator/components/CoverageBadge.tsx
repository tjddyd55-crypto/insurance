import type { ScenarioItemCategory } from '../domain/types'
import { categoryLabel } from '../domain/itemCatalog'

export function CoverageBadge({ category }: { category: ScenarioItemCategory }) {
  return <span className={`coverage-simulator-badge coverage-simulator-badge--${category}`}>{categoryLabel(category)}</span>
}
