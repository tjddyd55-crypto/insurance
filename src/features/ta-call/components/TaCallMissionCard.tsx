import { formatKoreanDateOnlyWithWeekday } from '../../../../shared/dateTimeKst'
import type { TaCallDay } from '../types/taCall.types'

type TaCallMissionCardProps = {
  day: TaCallDay | null
  dailyTargetCount: number
  compact?: boolean
}

export default function TaCallMissionCard({ day, dailyTargetCount, compact = false }: TaCallMissionCardProps) {
  if (!day) {
    return (
      <section className={`ta-call-mission-card${compact ? ' ta-call-mission-card--compact' : ''}`}>
        <p className="ta-call-mission-card__loading">오늘의 TA 대상을 준비하고 있습니다.</p>
      </section>
    )
  }

  const dateLabel = formatKoreanDateOnlyWithWeekday(day.date)
  const target = dailyTargetCount
  const completed = day.completedCount
  const progressPct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0

  return (
    <section
      className={`ta-call-mission-card${compact ? ' ta-call-mission-card--compact' : ''}${
        day.isMissionCompleted ? ' ta-call-mission-card--completed' : ' ta-call-mission-card--active'
      }`}
    >
      <div className="ta-call-mission-card__top">
        <span className="ta-call-mission-card__date">{dateLabel}</span>
        <span
          className={`ta-call-mission-card__badge${
            day.isMissionCompleted ? ' ta-call-mission-card__badge--done' : ''
          }`}
        >
          {day.isMissionCompleted ? '미션 완료' : '진행 중'}
        </span>
      </div>
      <h2 className="ta-call-mission-card__title">
        {day.isMissionCompleted ? '오늘 미션 완료' : '오늘 TA 진행 중'}
      </h2>
      <p className="ta-call-mission-card__subtitle">
        {day.isMissionCompleted
          ? '오늘 배정된 TA 전화를 모두 완료했습니다.'
          : `목표 ${target}명 중 ${completed}명 완료`}
      </p>
      <div className="ta-call-mission-card__stats">
        <div className="ta-call-mission-card__stat ta-call-mission-card__stat--completed">
          <strong>{day.completedCount}</strong>
          <span>통화완료</span>
        </div>
        <div className="ta-call-mission-card__stat ta-call-mission-card__stat--no-answer">
          <strong>{day.noAnswerCount}</strong>
          <span>부재중</span>
        </div>
        <div className="ta-call-mission-card__stat ta-call-mission-card__stat--not-called">
          <strong>{day.notCalledCount}</strong>
          <span>미통화</span>
        </div>
      </div>
      <div className="ta-call-mission-card__progress-wrap">
        <div className="ta-call-mission-card__progress-bar">
          <div className="ta-call-mission-card__progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="ta-call-mission-card__progress-label">
          {completed} / {target} 완료
        </span>
      </div>
    </section>
  )
}
