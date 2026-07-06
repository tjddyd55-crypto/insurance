import type { TaCallDay } from '../types/taCall.types'
import {
  buildTaWeekSummaryItems,
  formatTaWeekRangeCompactLabel,
  type TaWeekSummaryItem,
} from '../utils/taCallWeekSummary'

type TaCallWeekSummaryCardProps = {
  weekStartDate: string
  weekEndDate: string
  days: TaCallDay[]
}

function WeekSummaryRowStatus({ item }: { item: TaWeekSummaryItem }) {
  if (item.status === 'scheduled') {
    return <span className="ta-week-summary-row__muted">예정</span>
  }
  if (item.status === 'empty') {
    return <span className="ta-week-summary-row__muted">없음</span>
  }

  const countClassName =
    item.status === 'completed' || item.status === 'today'
      ? 'ta-week-summary-row__count ta-week-summary-row__count--active'
      : 'ta-week-summary-row__count'

  return (
    <div className="ta-week-summary-row__progress-area">
      <div className="ta-week-progress" aria-hidden="true">
        <div
          className={`ta-week-progress__fill${
            item.status === 'completed' ? ' ta-week-progress__fill--full' : ''
          }`}
          style={{ width: `${item.progressPercent}%` }}
        />
      </div>
      <span className={countClassName}>
        {item.completedCount}/{item.targetCount}
      </span>
      {item.status === 'completed' || (item.status === 'today' && item.progressPercent >= 100) ? (
        <span className="ta-week-summary-row__check" aria-label="완료">
          ✓
        </span>
      ) : null}
      {item.status === 'today' && item.progressPercent < 100 ? (
        <span className="ta-week-summary-row__today-dot" aria-label="오늘">
          ●
        </span>
      ) : null}
    </div>
  )
}

function WeekSummaryRow({ item }: { item: TaWeekSummaryItem }) {
  const rowClassName = [
    'ta-week-summary-row',
    item.isToday ? 'ta-week-summary-row--today' : '',
    item.status === 'completed' ? 'ta-week-summary-row--completed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={rowClassName}>
      <span className="ta-week-summary-row__weekday">{item.dayLabel}</span>
      <span className="ta-week-summary-row__date">{item.displayDate}</span>
      <WeekSummaryRowStatus item={item} />
    </li>
  )
}

export default function TaCallWeekSummaryCard({ weekStartDate, weekEndDate, days }: TaCallWeekSummaryCardProps) {
  const items = buildTaWeekSummaryItems(days)

  return (
    <section className="ta-week-summary-card" aria-labelledby="ta-week-summary-title">
      <header className="ta-week-summary-card__head">
        <h2 id="ta-week-summary-title" className="ta-week-summary-card__title">
          <span className="ta-week-summary-card__icon" aria-hidden="true">
            📅
          </span>
          이번 주 요약
        </h2>
        <p className="ta-week-summary-card__range">{formatTaWeekRangeCompactLabel(weekStartDate, weekEndDate)}</p>
      </header>
      <ul className="ta-week-summary-card__rows">
        {items.map((item) => (
          <WeekSummaryRow key={item.date} item={item} />
        ))}
      </ul>
    </section>
  )
}
