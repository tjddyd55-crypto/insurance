import { useMemo } from 'react'

import FormButton from '../../../../components/form/FormButton'
import { coverageItemMoveState } from '../../domain/timelinePeriodBounds'
import type { ScenarioItem } from '../../domain/types'

type Props = {
  items: ScenarioItem[]
  itemId: string
  onMoveUp: () => void
  onMoveDown: () => void
}

export function CoverageTimelineReorderButtons({ items, itemId, onMoveUp, onMoveDown }: Props) {
  const moveState = useMemo(() => coverageItemMoveState(items, itemId), [items, itemId])

  return (
    <div className="cs-axis-reorder" data-testid="coverage-timeline-reorder">
      <FormButton
        variant="action"
        className="cs-axis-reorder__btn"
        aria-label="위로 이동"
        disabled={!moveState.canMoveUp}
        onClick={onMoveUp}
      >
        ↑
      </FormButton>
      <FormButton
        variant="action"
        className="cs-axis-reorder__btn"
        aria-label="아래로 이동"
        disabled={!moveState.canMoveDown}
        onClick={onMoveDown}
      >
        ↓
      </FormButton>
    </div>
  )
}
