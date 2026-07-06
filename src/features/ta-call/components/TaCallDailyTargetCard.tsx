type TaCallDailyTargetCardProps = {
  dailyTargetCount: number
  targetFilterSummary?: string
  onOpenSettings: () => void
}

export default function TaCallDailyTargetCard({
  dailyTargetCount,
  targetFilterSummary,
  onOpenSettings,
}: TaCallDailyTargetCardProps) {
  return (
    <section className="ta-daily-target-card" aria-label="하루 목표">
      <div className="ta-daily-target-card__body">
        <p className="ta-daily-target-card__label">
          <span className="ta-daily-target-card__icon" aria-hidden="true">
            ◎
          </span>
          하루 목표
        </p>
        <p className="ta-daily-target-card__value">{dailyTargetCount}명</p>
        {targetFilterSummary ? <p className="ta-daily-target-card__summary">{targetFilterSummary}</p> : null}
      </div>
      <button type="button" className="ta-call-page__settings-btn" onClick={onOpenSettings}>
        <span aria-hidden>⚙</span>
        설정
      </button>
    </section>
  )
}
