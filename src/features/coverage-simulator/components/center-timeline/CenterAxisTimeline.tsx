import { useMemo } from 'react'

import { CoverageBadge } from '../CoverageBadge'
import { formatCoverageAmountLabel } from '../../domain/formatAmount'
import { periodTotalsByEndMarkerId } from '../../domain/periodTotals'
import {
  buildTimelinePeriodSections,
  type TimelineRenderBlock,
} from '../../domain/timelinePeriodSections'
import { shouldShowTimelineInsertAfterItem } from '../../domain/timelineInsertVisibility'
import type { CoverageScenarioItem, ScenarioItem } from '../../domain/types'
import { CoverageGrandTotal } from './CoverageGrandTotal'

export type CoverageTimelineMode = 'editable' | 'readonly' | 'print'
import { CoverageTimelineReorderButtons } from './CoverageTimelineReorderButtons'
import { EventRowMenu } from './EventRowMenu'
import { InlineAmountQuickEdit, type InlineAmountField } from './InlineAmountQuickEdit'
import { TimelineInsertControl } from './TimelineInsertControl'
import { TimelinePeriodSubtotal } from './TimelinePeriodSubtotal'
import { TimeMarkerRowMenu } from './TimeMarkerRowMenu'

export type InlineAmountEditTarget = { itemId: string; field: InlineAmountField } | null

type InlineAmountOptions = {
  enableInlineAmountEdit: boolean
  inlineAmountEdit: InlineAmountEditTarget
  onInlineAmountEditChange: (target: InlineAmountEditTarget) => void
  onInlineAmountCommit: (itemId: string, field: InlineAmountField, amount: number | null) => void
}

export type CenterAxisTimelineProps = {
  items: ScenarioItem[]
  currentTotal: number
  proposedTotal: number
  variant: 'mobile' | 'pc'
  mode?: CoverageTimelineMode
  readOnly?: boolean
  preserveActionsGeometry?: boolean
  displayTitleByItemId?: ReadonlyMap<string, string>
  showInlineSummary?: boolean
  compactInsert?: boolean
  itemMenuMode?: 'popover' | 'action-sheet'
  onEditItem: (item: CoverageScenarioItem) => void
  onMoveItem: (id: string, direction: 'up' | 'down') => void
  onRemoveItem: (id: string) => void
  onRemoveTimeMarker?: (id: string) => void
  onAddAfter: (afterOrder: number) => void
  enableInlineAmountEdit?: boolean
  inlineAmountEdit?: InlineAmountEditTarget
  onInlineAmountEditChange?: (target: InlineAmountEditTarget) => void
  onInlineAmountCommit?: (itemId: string, field: InlineAmountField, amount: number | null) => void
}

type Handlers = Pick<CenterAxisTimelineProps, 'onEditItem' | 'onMoveItem' | 'onRemoveItem'>

function resolveInlineOptions(props: CenterAxisTimelineProps): InlineAmountOptions | null {
  if (!props.enableInlineAmountEdit || !props.onInlineAmountEditChange || !props.onInlineAmountCommit) {
    return null
  }
  return {
    enableInlineAmountEdit: true,
    inlineAmountEdit: props.inlineAmountEdit ?? null,
    onInlineAmountEditChange: props.onInlineAmountEditChange,
    onInlineAmountCommit: props.onInlineAmountCommit,
  }
}

function renderAmountCell(
  item: CoverageScenarioItem,
  field: InlineAmountField,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Handlers,
  inline: InlineAmountOptions | null,
  readOnly: boolean,
) {
  const amount = field === 'current' ? item.currentAmount : item.proposedAmount
  const baseClass = [
    'cs-axis-amount',
    field === 'current' ? 'cs-axis-amount--current' : 'cs-axis-amount--proposed',
    'coverage-simulator-amount-box',
    field === 'proposed' ? 'coverage-simulator-amount-box--proposed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (readOnly) {
    return (
      <div className={baseClass}>
        <span className="cs-axis-amount__value">{formatCoverageAmountLabel(amount)}</span>
      </div>
    )
  }

  if (variant === 'mobile' && inline) {
    const active = inline.inlineAmountEdit?.itemId === item.id && inline.inlineAmountEdit?.field === field
    return (
      <InlineAmountQuickEdit
        amount={amount}
        field={field}
        active={active}
        className={baseClass}
        onActivate={() => inline.onInlineAmountEditChange({ itemId: item.id, field })}
        onCommit={(next) => inline.onInlineAmountCommit(item.id, field, next)}
        onEndEdit={() => inline.onInlineAmountEditChange(null)}
      />
    )
  }

  return (
    <button type="button" className={baseClass} onClick={() => handlers.onEditItem(item)}>
      <span className="cs-axis-amount__value">{formatCoverageAmountLabel(amount)}</span>
    </button>
  )
}

function resolveItemDisplayTitle(
  item: CoverageScenarioItem,
  displayTitleByItemId?: ReadonlyMap<string, string>,
): string {
  return displayTitleByItemId?.get(item.id) ?? item.label
}

function renderCoverageRow(
  item: CoverageScenarioItem,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Handlers,
  options: Pick<
    CenterAxisTimelineProps,
    'items' | 'itemMenuMode' | 'readOnly' | 'preserveActionsGeometry' | 'displayTitleByItemId'
  >,
  inline: InlineAmountOptions | null,
) {
  const showTimelineReorder = !options.readOnly && options.itemMenuMode === 'action-sheet'
  const displayTitle = resolveItemDisplayTitle(item, options.displayTitleByItemId)
  const showActionSpacer = Boolean(options.readOnly && options.preserveActionsGeometry)

  return (
    <div key={item.id} className="cs-axis-event">
      <div className="cs-axis-event__head">
        <div className="cs-axis-event__badge">
          <CoverageBadge category={item.category} />
        </div>
        <p className="cs-axis-event__title-axis">
          <span className="cs-axis-event__label">{displayTitle}</span>
        </p>
        {!options.readOnly ? (
          <div className="cs-axis-event__actions">
            {showTimelineReorder ? (
              <CoverageTimelineReorderButtons
                items={options.items}
                itemId={item.id}
                onMoveUp={() => handlers.onMoveItem(item.id, 'up')}
                onMoveDown={() => handlers.onMoveItem(item.id, 'down')}
              />
            ) : null}
            <EventRowMenu
              menuMode={options.itemMenuMode}
              itemCategory={item.category}
              itemLabel={displayTitle}
              onEditAmount={() => handlers.onEditItem(item)}
              onDelete={() => handlers.onRemoveItem(item.id)}
            />
          </div>
        ) : showActionSpacer ? (
          <div className="cs-axis-event__actions cs-axis-event__actions--spacer" aria-hidden="true" />
        ) : null}
      </div>
      <div className="cs-axis-event__compare">
        {renderAmountCell(item, 'current', variant, handlers, inline, Boolean(options.readOnly))}
        <div className="cs-axis-event__spine" aria-hidden="true" />
        {renderAmountCell(item, 'proposed', variant, handlers, inline, Boolean(options.readOnly))}
      </div>
      {variant === 'pc' && item.memo ? (
        <p className="cs-axis-event__memo">{item.memo}</p>
      ) : null}
    </div>
  )
}

function renderTimeMarker(
  item: Extract<ScenarioItem, { type: 'time-marker' }>,
  onRemove: (id: string) => void,
  markerMenuMode: 'inline-delete' | 'action-sheet',
  readOnly: boolean,
  preserveActionsGeometry: boolean,
) {
  return (
    <div key={item.id} className="cs-axis-marker coverage-simulator-time-marker">
      <div className="cs-axis-marker__row">
        <span className="cs-axis-marker__gutter" aria-hidden="true" />
        <div className="cs-axis-marker__hline" role="presentation">
          <span className="cs-axis-marker__hline-seg" aria-hidden="true" />
          <span className="cs-axis-marker__hline-label">
            <span className="cs-axis-marker__label">{item.label}</span>
            <span className="cs-axis-marker__arrow" aria-hidden="true">↓</span>
          </span>
          <span className="cs-axis-marker__hline-seg" aria-hidden="true" />
        </div>
        {!readOnly ? (
          <div className="cs-axis-marker__menu-slot">
            <TimeMarkerRowMenu menuMode={markerMenuMode} onDelete={() => onRemove(item.id)} />
          </div>
        ) : preserveActionsGeometry ? (
          <div className="cs-axis-marker__menu-slot cs-axis-marker__menu-slot--spacer" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  )
}

function renderBlock(
  block: TimelineRenderBlock,
  blockKey: string,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Handlers,
  options: Pick<
    CenterAxisTimelineProps,
    'items' | 'itemMenuMode' | 'readOnly' | 'preserveActionsGeometry' | 'displayTitleByItemId'
  >,
  inline: InlineAmountOptions | null,
  onAddAfter: (afterOrder: number) => void,
  readOnly: boolean,
  _preserveActionsGeometry: boolean,
) {
  if (block.kind === 'coverage') {
    return (
      <div key={blockKey} className="cs-axis-block">
        {renderCoverageRow(block.item, variant, handlers, { ...options, readOnly }, inline)}
      </div>
    )
  }
  if (readOnly && block.kind === 'insert') {
    return null
  }
  if (block.kind === 'insert') {
    return (
      <div key={blockKey} className="cs-axis-block cs-axis-block--insert">
        <TimelineInsertControl
          afterOrder={block.afterOrder}
          onInsert={onAddAfter}
          variant={block.variant}
        />
      </div>
    )
  }
  return (
    <div key={blockKey} className="cs-axis-block cs-axis-block--subtotal">
      <TimelinePeriodSubtotal
        markerLabel={block.markerLabel}
        currentTotal={block.currentTotal}
        proposedTotal={block.proposedTotal}
        hideColumnLabels={variant === 'mobile'}
      />
    </div>
  )
}

function renderFlatTimeline(
  props: CenterAxisTimelineProps,
  handlers: Handlers,
  periodByMarkerId: Map<string, { currentTotal: number; proposedTotal: number }>,
  markerMenuMode: 'inline-delete' | 'action-sheet',
  removeMarker: (id: string) => void,
  inline: InlineAmountOptions | null,
) {
  const {
    items,
    variant,
    compactInsert,
    itemMenuMode,
    onAddAfter,
    readOnly = false,
    preserveActionsGeometry = false,
    displayTitleByItemId,
  } = props
  const rowOptions = {
    items,
    itemMenuMode,
    readOnly,
    preserveActionsGeometry,
    displayTitleByItemId,
  }

  return (
    <>
      {!readOnly && compactInsert && items.length === 0 ? (
        <TimelineInsertControl afterOrder={-1} onInsert={onAddAfter} />
      ) : null}
      {items.map((item) => (
        <div key={item.id} className="cs-axis-block">
          {item.type === 'time-marker' ? (
            <>
              {periodByMarkerId.has(item.id) ? (
                <TimelinePeriodSubtotal
                  markerLabel={item.label}
                  currentTotal={periodByMarkerId.get(item.id)!.currentTotal}
                  proposedTotal={periodByMarkerId.get(item.id)!.proposedTotal}
                  hideColumnLabels={variant === 'mobile'}
                />
              ) : null}
              {renderTimeMarker(item, removeMarker, markerMenuMode, readOnly, preserveActionsGeometry)}
            </>
          ) : (
            renderCoverageRow(item, variant, handlers, rowOptions, inline)
          )}
          {!readOnly && compactInsert && shouldShowTimelineInsertAfterItem(item, items, compactInsert) ? (
            <TimelineInsertControl
              afterOrder={item.order}
              onInsert={onAddAfter}
              variant={item.type === 'time-marker' ? 'marker-tail' : 'default'}
            />
          ) : !readOnly && !compactInsert ? (
            <button
              type="button"
              className="cs-axis-add coverage-simulator-add-slot"
              onClick={() => onAddAfter(item.order)}
            >
              + 항목 추가
            </button>
          ) : null}
        </div>
      ))}
    </>
  )
}

function renderPeriodSections(
  props: CenterAxisTimelineProps,
  handlers: Handlers,
  markerMenuMode: 'inline-delete' | 'action-sheet',
  removeMarker: (id: string) => void,
  periodByMarkerId: Map<string, { currentTotal: number; proposedTotal: number }>,
  inline: InlineAmountOptions | null,
) {
  const sections = buildTimelinePeriodSections(props.items, true, periodByMarkerId)
  const preserveActionsGeometry = props.preserveActionsGeometry ?? false
  const options = {
    items: props.items,
    itemMenuMode: props.itemMenuMode,
    readOnly: props.readOnly ?? false,
    preserveActionsGeometry,
    displayTitleByItemId: props.displayTitleByItemId,
  }

  return sections.map((section) => (
    <div key={section.key} className="cs-period-section-wrap">
      <div className="cs-period-section">
        {section.blocks.map((block, index) =>
          renderBlock(
            block,
            `${section.key}-${index}`,
            props.variant,
            handlers,
            options,
            inline,
            props.onAddAfter,
            props.readOnly ?? false,
            preserveActionsGeometry,
          ),
        )}
      </div>
      {section.boundaryMarker ? (
        <div className="cs-period-boundary">
          {renderTimeMarker(
            section.boundaryMarker,
            removeMarker,
            markerMenuMode,
            props.readOnly ?? false,
            preserveActionsGeometry,
          )}
        </div>
      ) : null}
    </div>
  ))
}

export function CenterAxisTimeline({
  items,
  currentTotal,
  proposedTotal,
  variant,
  mode = 'editable',
  readOnly = false,
  preserveActionsGeometry = false,
  displayTitleByItemId,
  showInlineSummary = true,
  compactInsert = false,
  itemMenuMode = 'popover',
  onEditItem,
  onMoveItem,
  onRemoveItem,
  onRemoveTimeMarker,
  onAddAfter,
  enableInlineAmountEdit = false,
  inlineAmountEdit = null,
  onInlineAmountEditChange,
  onInlineAmountCommit,
}: CenterAxisTimelineProps) {
  const handlers = { onEditItem, onMoveItem, onRemoveItem }
  const inline = resolveInlineOptions({
    items,
    currentTotal,
    proposedTotal,
    variant,
    showInlineSummary,
    compactInsert,
    itemMenuMode,
    onEditItem,
    onMoveItem,
    onRemoveItem,
    onRemoveTimeMarker,
    onAddAfter,
    enableInlineAmountEdit,
    inlineAmountEdit,
    onInlineAmountEditChange,
    onInlineAmountCommit,
  })
  const periodByMarkerId = useMemo(() => periodTotalsByEndMarkerId(items), [items])
  const markerMenuMode = itemMenuMode === 'action-sheet' ? 'action-sheet' : 'inline-delete'
  const removeMarker = onRemoveTimeMarker ?? onRemoveItem
  const usePeriodSections = compactInsert && variant === 'mobile'

  const resolvedReadOnly = readOnly || mode !== 'editable'

  const timelineProps: CenterAxisTimelineProps = {
    items,
    currentTotal,
    proposedTotal,
    variant,
    mode,
    readOnly: resolvedReadOnly,
    preserveActionsGeometry,
    displayTitleByItemId,
    showInlineSummary,
    compactInsert,
    itemMenuMode,
    onEditItem,
    onMoveItem,
    onRemoveItem,
    onRemoveTimeMarker,
    onAddAfter,
    enableInlineAmountEdit,
    inlineAmountEdit,
    onInlineAmountEditChange,
    onInlineAmountCommit,
  }

  const sheetClass = [
    'cs-axis-sheet',
    `cs-axis-sheet--${variant}`,
    mode === 'print' ? 'cs-axis-sheet--print' : '',
    mode === 'readonly' ? 'cs-axis-sheet--readonly' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sheetClass} aria-label="보장 비교 타임라인">
      <div className="cs-axis-col-header" aria-hidden="true">
        <span className="cs-axis-col-header__current">기존 보장</span>
        <span className="cs-axis-col-header__axis" />
        <span className="cs-axis-col-header__proposed">제안 보장</span>
      </div>

      <div className="cs-axis-timeline">
        <div className="cs-axis-timeline__line" aria-hidden="true" />
        <div className="cs-axis-timeline__rows">
          {usePeriodSections
            ? renderPeriodSections(timelineProps, handlers, markerMenuMode, removeMarker, periodByMarkerId, inline)
            : renderFlatTimeline(timelineProps, handlers, periodByMarkerId, markerMenuMode, removeMarker, inline)}
        </div>
      </div>

      {showInlineSummary ? (
        <CoverageGrandTotal
          currentTotal={currentTotal}
          proposedTotal={proposedTotal}
          sticky={mode === 'editable'}
        />
      ) : null}
    </section>
  )
}
