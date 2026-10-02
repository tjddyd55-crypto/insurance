import { Button } from '../../../components/ui'
import { SCHEDULE_FILTER_KEYS, SCHEDULE_FILTER_LABEL, type ScheduleFilterKey } from '../api/scheduleApi'
import type { ScheduleViewProps } from '../hooks/useScheduleState'
import { periodTitle, type ScheduleView } from '../domain/scheduleRange'

const VIEWS: Array<{ id: ScheduleView; label: string }> = [
  { id: 'month', label: '월간' },
  { id: 'week', label: '주간' },
  { id: 'day', label: '일간' },
  { id: 'list', label: '목록' },
]

const CHIPS: Array<ScheduleFilterKey | 'all'> = ['all', ...SCHEDULE_FILTER_KEYS]

function chipLabel(source: ScheduleFilterKey | 'all'): string {
  return source === 'all' ? '전체' : SCHEDULE_FILTER_LABEL[source]
}

/** Google 상태별 안내. 연결됨이면 없음. CRM 일정은 상태와 상관없이 계속 보인다. */
export function GoogleScheduleNotice({ google, onOpenIntegrations }: Pick<ScheduleViewProps, 'google' | 'onOpenIntegrations'>) {
  if (google.status === 'connected' || google.status === 'skipped') {
    return null
  }
  if (google.status === 'needs_reauth') {
    return (
      <div className="schedule-page__google-hint schedule-page__google-hint--warn" role="status">
        <p>Google 연결이 만료되어 재연결이 필요합니다. CRM 일정은 계속 표시됩니다.</p>
        <Button type="button" variant="secondary" size="sm" onClick={onOpenIntegrations}>서비스 연동에서 다시 연결</Button>
      </div>
    )
  }
  if (google.status === 'error') {
    return (
      <div className="schedule-page__google-hint schedule-page__google-hint--warn" role="status">
        <p>Google 일정을 지금 불러오지 못했습니다. CRM 일정은 계속 표시됩니다.</p>
      </div>
    )
  }
  return (
    <div className="schedule-page__google-hint" role="status">
      <p>Google Calendar를 연결하면 일정을 함께 볼 수 있습니다.</p>
      <Button type="button" variant="secondary" size="sm" onClick={onOpenIntegrations}>서비스 연동으로 이동</Button>
    </div>
  )
}

export default function ScheduleChrome(props: ScheduleViewProps) {
  const allOn = props.sources.length === SCHEDULE_FILTER_KEYS.length
  const googleOn = props.sources.includes('google')
  const activeCalendarIds = props.calendarIds.length > 0
    ? props.calendarIds
    : props.google.calendars.filter((calendar) => calendar.defaultVisible).map((calendar) => calendar.id)
  return (
    <>
      <header className="schedule-page__header">
        <h1>일정 관리</h1>
        <div className="schedule-page__nav">
          <Button type="button" variant="secondary" size="sm" onClick={() => props.onShift(-1)} aria-label="이전 기간">이전</Button>
          <Button type="button" variant="secondary" size="sm" onClick={props.onToday}>오늘</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => props.onShift(1)} aria-label="다음 기간">다음</Button>
          <strong className="schedule-page__period">{periodTitle(props.view, props.anchor)}</strong>
        </div>
      </header>
      <div className="schedule-page__views" role="tablist" aria-label="일정 보기">
        {VIEWS.map((item) => (
          <Button
            key={item.id}
            type="button"
            role="tab"
            size="sm"
            aria-selected={props.view === item.id}
            variant={props.view === item.id ? 'primary' : 'secondary'}
            onClick={() => props.onSelectView(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="schedule-page__chips" role="group" aria-label="일정 출처">
        {CHIPS.map((source) => {
          const active = source === 'all' ? allOn : !allOn && props.sources.includes(source)
          const reauth = source === 'google' && props.google.status === 'needs_reauth'
          return (
            <Button
              key={source}
              type="button"
              size="sm"
              aria-pressed={active}
              variant={active ? 'primary' : 'secondary'}
              onClick={() => props.onToggleSource(source)}
            >
              {chipLabel(source)}
              {reauth ? <span className="schedule-page__chip-note"> · 재연결 필요</span> : null}
            </Button>
          )
        })}
      </div>
      {googleOn && props.google.status === 'connected' && props.google.calendars.length > 1 ? (
        <div className="schedule-page__chips schedule-page__calendars" role="group" aria-label="Google 캘린더">
          {props.google.calendars.map((calendar) => {
            const on = activeCalendarIds.includes(calendar.id)
            return (
              <Button
                key={calendar.id}
                type="button"
                size="sm"
                aria-pressed={on}
                variant={on ? 'primary' : 'secondary'}
                onClick={() => props.onToggleCalendar(calendar.id)}
              >
                {calendar.name}
              </Button>
            )
          })}
        </div>
      ) : null}
      {googleOn ? <GoogleScheduleNotice google={props.google} onOpenIntegrations={props.onOpenIntegrations} /> : null}
      {props.loading ? <p className="schedule-page__status" role="status">일정을 불러오는 중…</p> : null}
      {props.error ? <p className="schedule-page__error" role="alert">{props.error}</p> : null}
    </>
  )
}
