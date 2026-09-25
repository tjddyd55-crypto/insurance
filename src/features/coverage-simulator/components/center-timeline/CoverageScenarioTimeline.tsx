import type { ReactNode } from 'react'

import type { CoverageTimelineViewModel } from '../../domain/buildCoverageTimelineViewModel'
import {
  CenterAxisTimeline,
  type CenterAxisTimelineProps,
  type CoverageTimelineMode,
  type InlineAmountEditTarget,
} from './CenterAxisTimeline'

export type { CoverageTimelineMode }

type EditableHandlers = Pick<
  CenterAxisTimelineProps,
  | 'onEditItem'
  | 'onMoveItem'
  | 'onRemoveItem'
  | 'onRemoveTimeMarker'
  | 'onAddAfter'
  | 'enableInlineAmountEdit'
  | 'inlineAmountEdit'
  | 'onInlineAmountEditChange'
  | 'onInlineAmountCommit'
>

type Props = {
  mode: CoverageTimelineMode
  viewModel: CoverageTimelineViewModel
  variant: 'mobile' | 'pc'
  showGrandTotal?: boolean
  compactInsert?: boolean
  itemMenuMode?: CenterAxisTimelineProps['itemMenuMode']
  className?: string
  children?: ReactNode
} & Partial<EditableHandlers>

const noop = () => undefined

export function CoverageScenarioTimeline({
  mode,
  viewModel,
  variant,
  showGrandTotal = true,
  compactInsert,
  itemMenuMode,
  className,
  children,
  onEditItem = noop,
  onMoveItem = noop,
  onRemoveItem = noop,
  onRemoveTimeMarker,
  onAddAfter = noop,
  enableInlineAmountEdit = false,
  inlineAmountEdit = null,
  onInlineAmountEditChange,
  onInlineAmountCommit,
}: Props) {
  const readOnly = mode !== 'editable'
  const resolvedCompactInsert = compactInsert ?? variant === 'mobile'
  const resolvedItemMenuMode = itemMenuMode ?? (variant === 'mobile' ? 'action-sheet' : 'popover')
  const preserveActionsGeometry = readOnly && resolvedItemMenuMode === 'action-sheet'

  return (
    <div
      className={[
        mode === 'print' ? 'cs-axis-sheet-host--print' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-coverage-timeline-mode={mode}
    >
      <CenterAxisTimeline
        items={viewModel.sortedItems}
        currentTotal={viewModel.totals.currentTotal}
        proposedTotal={viewModel.totals.proposedTotal}
        variant={variant}
        mode={mode}
        readOnly={readOnly}
        preserveActionsGeometry={preserveActionsGeometry}
        displayTitleByItemId={viewModel.displayTitleByItemId}
        showInlineSummary={showGrandTotal}
        compactInsert={resolvedCompactInsert}
        itemMenuMode={resolvedItemMenuMode}
        onEditItem={onEditItem}
        onMoveItem={onMoveItem}
        onRemoveItem={onRemoveItem}
        onRemoveTimeMarker={onRemoveTimeMarker}
        onAddAfter={onAddAfter}
        enableInlineAmountEdit={mode === 'editable' && enableInlineAmountEdit}
        inlineAmountEdit={inlineAmountEdit}
        onInlineAmountEditChange={onInlineAmountEditChange}
        onInlineAmountCommit={onInlineAmountCommit}
      />
      {children}
    </div>
  )
}

export type { InlineAmountEditTarget }
