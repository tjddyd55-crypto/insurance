import { useMemo } from 'react'

import { CoverageBadge } from '../CoverageBadge'
import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../../domain/formatAmount'
import { periodTotalsByEndMarkerId } from '../../domain/periodTotals'
import {
  buildTimelinePeriodSections,
  type TimelineRenderBlock,
} from '../../domain/timelinePeriodSections'
import { shouldShowTimelineInsertAfterItem } from '../../domain/timelineInsertVisibility'
import type { CoverageScenarioItem, ScenarioItem } from '../../domain/types'
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

  if (variant === 'mobile' && inline) {
    const active = inline.inlineAmountEdit?.itemId === item.id && inline.inlineAmountEdit?.field === field
    return (
      <InlineAmountQuickEdit
        amount={amount}
        field={field}
        active={active}
        className={baseClass}
        onActivate={() => inline.onInlineAmountEditChange({ itemId: item.id, field })}
        onCommit={(next) => {
          inline.onInlineAmountCommit(item.id, field, next)
          inline.onInlineAmountEditChange(null)
        }}
        onCancel={() => inline.onInlineAmountEditChange(null)}
      />
    )
  }

  return (
    <button type="button" className={baseClass} onClick={() => handlers.onEditItem(item)}>
      <span className="cs-axis-amount__value">{formatCoverageAmountLabel(amount)}</span>
    </button>
  )
}

function renderCoverageRow(
  item: CoverageScenarioItem,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Handlers,
  options: Pick<CenterAxisTimelineProps, 'items' | 'itemMenuMode'>,
  inline: InlineAmountOptions | null,
) {
  return (
    <div key={item.id} className="cs-axis-event">
      <div className="cs-axis-event__head">
        <div className="cs-axis-event__badge">
          <CoverageBadge category={item.category} />
        </div>
        <p className="cs-axis-event__title-axis">
          <span className="cs-axis-event__label">{item.label}</span>
        </p>
        <div className="cs-axis-event__menu">
          <EventRowMenu
            menuMode={options.itemMenuMode}
            items={options.items}
            itemId={item.id}
            itemCategory={item.category}
            itemLabel={item.label}
            onEditAmount={() => handlers.onEditItem(item)}
            onMoveUp={() => handlers.onMoveItem(item.id, 'up')}
            onMoveDown={() => handlers.onMoveItem(item.id, 'down')}
            onDelete={() => handlers.onRemoveItem(item.id)}
          />
        </div>
      </div>
      <div className="cs-axis-event__compare">
        {renderAmountCell(item, 'current', variant, handlers, inline)}
        <div className="cs-axis-event__spine" aria-hidden="true" />
        {renderAmountCell(item, 'proposed', variant, handlers, inline)}
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
        <div className="cs-axis-marker__menu-slot">
          <TimeMarkerRowMenu
            menuMode={markerMenuMode}
            onDelete={() => onRemove(item.id)}
          />
        </div>
      </div>
    </div>
  )
}

function renderBlock(
  block: TimelineRenderBlock,
  blockKey: string,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Handlers,
  options: Pick<CenterAxisTimelineProps, 'items' | 'itemMenuMode'>,
  inline: InlineAmountOptions | null,
  onAddAfter: (afterOrder: number) => void,
) {
  if (block.kind === 'coverage') {
    return (
      <div key={blockKey} className="cs-axis-block">
        {renderCoverageRow(block.item, variant, handlers, options, inline)}
      </div>
    )
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
  } = props

  return (
    <>
      {compactInsert && items.length === 0 ? (
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
              {renderTimeMarker(item, removeMarker, markerMenuMode)}
            </>
          ) : (
            renderCoverageRow(item, variant, handlers, { items, itemMenuMode }, inline)
          )}
          {compactInsert && shouldShowTimelineInsertAfterItem(item, items, compactInsert) ? (
            <TimelineInsertControl
              afterOrder={item.order}
              onInsert={onAddAfter}
              variant={item.type === 'time-marker' ? 'marker-tail' : 'default'}
            />
          ) : !compactInsert ? (
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
  const options = { items: props.items, itemMenuMode: props.itemMenuMode }

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
          ),
        )}
      </div>
      {section.boundaryMarker ? (
        <div className="cs-period-boundary">
          {renderTimeMarker(section.boundaryMarker, removeMarker, markerMenuMode)}
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

  const timelineProps: CenterAxisTimelineProps = {
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
  }

  return (
    <section className={`cs-axis-sheet cs-axis-sheet--${variant}`} aria-label="보장 비교 타임라인">
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
        <footer className="cs-axis-summary coverage-simulator-summary">
          <div className="cs-axis-summary__compare">
            <div className="cs-axis-summary__col">
              <span className="cs-axis-summary__label">기존 총 보장</span>
              <span className="cs-axis-summary__value coverage-simulator-summary__value">
                {formatTotalAmountLabel(currentTotal)}
              </span>
            </div>
            <div className="cs-axis-summary__spine" aria-hidden="true" />
            <div className="cs-axis-summary__col cs-axis-summary__col--proposed">
              <span className="cs-axis-summary__label">제안 총 보장</span>
              <span className="cs-axis-summary__value cs-axis-summary__value--proposed coverage-simulator-summary__value coverage-simulator-summary__value--proposed">
                {formatTotalAmountLabel(proposedTotal)}
              </span>
            </div>
          </div>
        </footer>
      ) : null}
    </section>
  )
}
