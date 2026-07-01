import { formatTaWeekRangeLabel } from '../utils/taCallDisplay'

type TaCallWeekNavProps = {
  weekStartDate: string
  weekEndDate: string
  busy: boolean
  onPrev: () => void
  onNext: () => void
}

export default function TaCallWeekNav({
  weekStartDate,
  weekEndDate,
  busy,
  onPrev,
  onNext,
}: TaCallWeekNavProps) {
  return (
    <div className="ta-call-week-nav">
      <button type="button" className="ta-call-week-nav__btn" disabled={busy} onClick={onPrev}>
        ‹
      </button>
      <span className="ta-call-week-nav__label">{formatTaWeekRangeLabel(weekStartDate, weekEndDate)}</span>
      <button type="button" className="ta-call-week-nav__btn" disabled={busy} onClick={onNext}>
        ›
      </button>
    </div>
  )
}
