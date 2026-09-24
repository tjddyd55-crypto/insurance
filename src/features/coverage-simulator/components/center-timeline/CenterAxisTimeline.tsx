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
import { TimelineInsertControl } from './TimelineInsertControl'
import { TimelinePeriodSubtotal } from './TimelinePeriodSubtotal'
import { TimeMarkerRowMenu } from './TimeMarkerRowMenu'

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
}

type Handlers = Pick<CenterAxisTimelineProps, 'onEditItem' | 'onMoveItem' | 'onRemoveItem'>

function renderCoverageRow(
  item: CoverageScenarioItem,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Handlers,
  options: Pick<CenterAxisTimelineProps, 'items' | 'itemMenuMode'>,
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
        <button
          type="button"
          className="cs-axis-amount cs-axis-amount--current coverage-simulator-amount-box"
          onClick={() => handlers.onEditItem(item)}
        >
          <span className="cs-axis-amount__value">{formatCoverageAmountLabel(item.currentAmount)}</span>
        </button>
        <div className="cs-axis-event__spine" aria-hidden="true" />
        <button
          type="button"
          className="cs-axis-amount cs-axis-amount--proposed coverage-simulator-amount-box coverage-simulator-amount-box--proposed"
          onClick={() => handlers.onEditItem(item)}
        >
          <span className="cs-axis-amount__value">{formatCoverageAmountLabel(item.proposedAmount)}</span>
        </button>
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
        <div className="cs-axis-marker__hline" role="presentation">
          <span className="cs-axis-marker__hline-seg" aria-hidden="true" />
          <span className="cs-axis-marker__hline-label">
            <span className="cs-axis-marker__label">{item.label}</span>
            <span className="cs-axis-marker__arrow" aria-hidden="true">↓</span>
          </span>
          <span className="cs-axis-marker__hline-seg" aria-hidden="true" />
        </div>
        <TimeMarkerRowMenu
          menuMode={markerMenuMode}
          onDelete={() => onRemove(item.id)}
        />
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
  onAddAfter: (afterOrder: number) => void,
) {
  if (block.kind === 'coverage') {
    return (
      <div key={blockKey} className="cs-axis-block">
        {renderCoverageRow(block.item, variant, handlers, options)}
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
                />
              ) : null}
              {renderTimeMarker(item, removeMarker, markerMenuMode)}
            </>
          ) : (
            renderCoverageRow(item, variant, handlers, { items, itemMenuMode })
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
) {
  const sections = buildTimelinePeriodSections(props.items, true, periodByMarkerId)
  const options = { items: props.items, itemMenuMode: props.itemMenuMode }

  return sections.map((section) => (
    <div key={section.key} className="cs-period-section-wrap">
      <div
        className={[
          'cs-period-section',
          section.tintIndex % 2 === 0 ? 'cs-period-section--tint-a' : 'cs-period-section--tint-b',
        ].join(' ')}
      >
        {section.blocks.map((block, index) =>
          renderBlock(
            block,
            `${section.key}-${index}`,
            props.variant,
            handlers,
            options,
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
}: CenterAxisTimelineProps) {
  const handlers = { onEditItem, onMoveItem, onRemoveItem }
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
            ? renderPeriodSections(timelineProps, handlers, markerMenuMode, removeMarker, periodByMarkerId)
            : renderFlatTimeline(timelineProps, handlers, periodByMarkerId, markerMenuMode, removeMarker)}
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
