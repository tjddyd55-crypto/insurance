import { SCHEDULE_SOURCE_LABEL, type ScheduleSource } from '../api/scheduleApi'
import type { ScheduleViewProps } from '../hooks/useScheduleState'
import type { ScheduleView } from '../domain/scheduleRange'

const VIEWS: Array<{ id: ScheduleView; label: string }> = [
  { id: 'month', label: '월간' },
  { id: 'week', label: '주간' },
  { id: 'day', label: '일간' },
  { id: 'list', label: '목록' },
]

const CHIPS: Array<ScheduleSource | 'all'> = ['all', 'google', 'customer_alert', 'car_expiry', 'insurance_age', 'personal']

function chipLabel(source: ScheduleSource | 'all'): string {
  return source === 'all' ? '전체' : SCHEDULE_SOURCE_LABEL[source]
}

export default function ScheduleChrome(props: ScheduleViewProps) {
  const allOn = props.sources.length === 5
  const showGoogleHint = props.google.status !== 'connected'
  return (
    <>
      <header className="schedule-page__header">
        <h1>일정 관리</h1>
        <div className="schedule-page__nav">
          <button type="button" onClick={() => props.onShift(-1)} aria-label="이전">이전</button>
          <strong>{props.anchor}</strong>
          <button type="button" onClick={() => props.onShift(1)} aria-label="다음">다음</button>
        </div>
      </header>
      <div className="schedule-page__views" role="tablist" aria-label="일정 보기">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={props.view === item.id}
            className={props.view === item.id ? 'schedule-page__view schedule-page__view--active' : 'schedule-page__view'}
            onClick={() => props.onSelectView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="schedule-page__chips" aria-label="일정 출처">
        {CHIPS.map((source) => {
          const active = source === 'all' ? allOn : !allOn && props.sources.includes(source)
          return (
            <button
              key={source}
              type="button"
              className={active ? 'schedule-page__chip-filter schedule-page__chip-filter--on' : 'schedule-page__chip-filter'}
              onClick={() => props.onToggleSource(source)}
            >
              {chipLabel(source)}
            </button>
          )
        })}
      </div>
      {showGoogleHint ? (
        <div className="schedule-page__google-hint">
          <p>Google Calendar를 연결하면 Google 일정도 함께 볼 수 있습니다.</p>
          <button type="button" onClick={props.onOpenIntegrations}>서비스 연동</button>
        </div>
      ) : null}
      {props.loading ? <p>일정을 불러오는 중…</p> : null}
      {props.error ? <p className="schedule-page__error">{props.error}</p> : null}
    </>
  )
}
