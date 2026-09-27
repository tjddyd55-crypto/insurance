import type { CoverageScenarioItem, ScenarioItem } from '../../domain/types'

export type AlternativeViewMenuMode = 'popover' | 'action-sheet'

export type AlternativeViewHandlers = {
  readOnly: boolean
  items: ScenarioItem[]
  itemMenuMode: AlternativeViewMenuMode
  onEditItem: (item: CoverageScenarioItem) => void
  onMoveItem: (id: string, direction: 'up' | 'down') => void
  onRemoveItem: (id: string) => void
  onRemoveTimeMarker: (id: string) => void
  onAddAfter: (afterOrder: number) => void
}
