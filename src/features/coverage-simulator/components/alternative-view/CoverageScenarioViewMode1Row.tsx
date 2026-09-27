import { CoverageBadge } from '../CoverageBadge'
import { AltAmount } from './AltAmount'
import { AltRowFrame } from './AltRowFrame'
import { AltRowTools } from './AltRowTools'
import type { AlternativeViewHandlers } from './alternativeViewTypes'
import type { CoverageScenarioItem } from '../../domain/types'

type Props = AlternativeViewHandlers & {
  item: CoverageScenarioItem
  displayTitle: string
}

export function CoverageScenarioViewMode1Row({
  item,
  displayTitle,
  readOnly,
  items,
  itemMenuMode,
  onEditItem,
  onMoveItem,
  onRemoveItem,
}: Props) {
  return (
    <AltRowFrame
      className="cs-alt-row cs-alt-row--option1"
      title={displayTitle}
      readOnly={readOnly}
      onEdit={() => onEditItem(item)}
      tools={
        <AltRowTools
          item={item}
          displayTitle={displayTitle}
          items={items}
          itemMenuMode={itemMenuMode}
          onEditItem={onEditItem}
          onMoveItem={onMoveItem}
          onRemoveItem={onRemoveItem}
        />
      }
    >
      <span className="cs-alt-badge">
        <CoverageBadge category={item.category} />
      </span>
      <AltAmount amount={item.currentAmount} tone="current" />
      <span className="cs-alt-name" title={displayTitle}>
        <span className="cs-alt-name__text">{displayTitle}</span>
      </span>
      <AltAmount amount={item.proposedAmount} tone="proposed" />
    </AltRowFrame>
  )
}
