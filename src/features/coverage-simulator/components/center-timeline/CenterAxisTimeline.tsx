import { CoverageBadge } from '../CoverageBadge'
import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../../domain/formatAmount'
import type { CoverageScenarioItem, ScenarioItem } from '../../domain/types'
import { EventRowMenu } from './EventRowMenu'

export type CenterAxisTimelineProps = {
  items: ScenarioItem[]
  currentTotal: number
  proposedTotal: number
  variant: 'mobile' | 'pc'
  onEditItem: (item: CoverageScenarioItem) => void
  onMoveItem: (id: string, direction: 'up' | 'down') => void
  onRemoveItem: (id: string) => void
  onAddAfter: (afterOrder: number) => void
}

function renderCoverageRow(
  item: CoverageScenarioItem,
  variant: CenterAxisTimelineProps['variant'],
  handlers: Pick<CenterAxisTimelineProps, 'onEditItem' | 'onMoveItem' | 'onRemoveItem'>,
) {
  return (
    <div key={item.id} className="cs-axis-event">
      <div className="cs-axis-event__head">
        <div className="cs-axis-event__title">
          <CoverageBadge category={item.category} />
          <span className="cs-axis-event__label">{item.label}</span>
        </div>
        <EventRowMenu
          onEditAmount={() => handlers.onEditItem(item)}
          onMoveUp={() => handlers.onMoveItem(item.id, 'up')}
          onMoveDown={() => handlers.onMoveItem(item.id, 'down')}
          onDelete={() => handlers.onRemoveItem(item.id)}
        />
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
) {
  return (
    <div key={item.id} className="cs-axis-marker coverage-simulator-time-marker">
      <div className="cs-axis-marker__rail" aria-hidden="true">
        <span className="cs-axis-marker__dot" />
      </div>
      <div className="cs-axis-marker__content">
        <span className="cs-axis-marker__label">{item.label}</span>
        <span className="cs-axis-marker__arrow" aria-hidden="true">↓</span>
        <button
          type="button"
          className="cs-axis-marker__delete coverage-simulator-time-marker__delete"
          onClick={() => onRemove(item.id)}
        >
          삭제
        </button>
      </div>
    </div>
  )
}

export function CenterAxisTimeline({
  items,
  currentTotal,
  proposedTotal,
  variant,
  onEditItem,
  onMoveItem,
  onRemoveItem,
  onAddAfter,
}: CenterAxisTimelineProps) {
  const handlers = { onEditItem, onMoveItem, onRemoveItem }

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
          {items.length === 0 ? (
            <button type="button" className="cs-axis-add coverage-simulator-add-slot" onClick={() => onAddAfter(-1)}>
              + 항목 추가
            </button>
          ) : null}
          {items.map((item) => (
            <div key={item.id} className="cs-axis-block">
              {item.type === 'time-marker'
                ? renderTimeMarker(item, onRemoveItem)
                : renderCoverageRow(item, variant, handlers)}
              <button
                type="button"
                className="cs-axis-add coverage-simulator-add-slot"
                onClick={() => onAddAfter(item.order)}
              >
                + 항목 추가
              </button>
            </div>
          ))}
        </div>
      </div>

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
    </section>
  )
}
