import { CoverageTimelineReorderButtons } from '../center-timeline/CoverageTimelineReorderButtons'
import { EventRowMenu } from '../center-timeline/EventRowMenu'
import type { AlternativeViewHandlers } from './alternativeViewTypes'
import type { CoverageScenarioItem } from '../../domain/types'

type Props = Pick<AlternativeViewHandlers, 'items' | 'itemMenuMode' | 'onEditItem' | 'onMoveItem' | 'onRemoveItem'> & {
  item: CoverageScenarioItem
  displayTitle: string
}

export function AltRowTools({
  item,
  displayTitle,
  items,
  itemMenuMode,
  onEditItem,
  onMoveItem,
  onRemoveItem,
}: Props) {
  return (
    <div className="cs-alt-row__tools">
      <CoverageTimelineReorderButtons
        items={items}
        itemId={item.id}
        onMoveUp={() => onMoveItem(item.id, 'up')}
        onMoveDown={() => onMoveItem(item.id, 'down')}
      />
      <EventRowMenu
        menuMode={itemMenuMode}
        itemCategory={item.category}
        itemLabel={displayTitle}
        onEditAmount={() => onEditItem(item)}
        onDelete={() => onRemoveItem(item.id)}
      />
    </div>
  )
}
