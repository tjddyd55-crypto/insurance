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
  if (google.connectAllowed === false) {
    return (
      <div className="schedule-page__google-hint" role="status">
        <p>Google 연동 준비 중입니다. CRM 일정과 ONE FC 할 일은 계속 표시됩니다.</p>
      </div>
    )
  }
  return (
    <div className="schedule-page__google-hint" role="status">
      <p>Google을 연결하면 Google Calendar 일정과 Google Tasks 할 일을 함께 볼 수 있습니다.</p>
      <Button type="button" variant="secondary" size="sm" onClick={onOpenIntegrations}>서비스 연동으로 이동</Button>
    </div>
  )
}

/**
 * Google 할 일만의 안내. Calendar 연결이 정상일 때만 띄운다(미연동·만료는 위 안내가 맡는다).
 * 다른 출처는 그대로 보인다.
 */
export function GoogleTasksNotice({ google, onOpenIntegrations }: Pick<ScheduleViewProps, 'google' | 'onOpenIntegrations'>) {
  const tasks = google.tasks
  if (!tasks || google.status !== 'connected') {
    return null
  }
  if (tasks.status === 'scope_missing' || tasks.needsReconsent) {
    return (
      <div className="schedule-page__google-hint" role="status">
        <p>Google 할 일을 보려면 Google을 다시 연결해 Google Tasks 읽기 권한을 허용해 주세요. Google 일정은 계속 표시됩니다.</p>
        <Button type="button" variant="secondary" size="sm" onClick={onOpenIntegrations}>서비스 연동에서 다시 연결</Button>
      </div>
    )
  }
  if (tasks.status === 'error' || tasks.status === 'needs_reauth') {
    return (
      <div className="schedule-page__google-hint schedule-page__google-hint--warn" role="status">
        <p>Google 할 일을 불러오지 못했습니다. 다른 일정은 계속 표시됩니다.</p>
      </div>
    )
  }
  return null
}

/** CRM·ONE FC 할 일 출처가 실패했을 때. 나머지 출처는 그대로 보인다. */
function SourceFailureNotice({ sources, sourceStatus }: Pick<ScheduleViewProps, 'sources' | 'sourceStatus'>) {
  const messages: string[] = []
  if (sources.includes('onefc_todo') && sourceStatus.onefc_todo === 'error') {
    messages.push('ONE FC 할 일을 불러오지 못했습니다.')
  }
  const crmOn = sources.some((source) => source === 'customer_alert' || source === 'car_expiry' || source === 'insurance_age')
  if (crmOn && sourceStatus.crm === 'error') {
    messages.push('알림일·자동차 만기·상령일을 불러오지 못했습니다.')
  }
  if (messages.length === 0) {
    return null
  }
  return (
    <div className="schedule-page__google-hint schedule-page__google-hint--warn" role="status">
      <p>{messages.join(' ')} 다른 일정은 계속 표시됩니다.</p>
    </div>
  )
}

export default function ScheduleChrome(props: ScheduleViewProps) {
  const allOn = props.sources.length === SCHEDULE_FILTER_KEYS.length
  const googleOn = props.sources.includes('google')
  const googleTasksOn = props.sources.includes('google_task')
  const anyTasksOn = googleTasksOn || props.sources.includes('onefc_todo')
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
          const reauth = (source === 'google' && props.google.status === 'needs_reauth')
            || (source === 'google_task' && props.google.status === 'connected' && Boolean(props.google.tasks?.needsReconsent))
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
        {anyTasksOn ? (
          <Button
            type="button"
            size="sm"
            aria-pressed={props.includeCompleted}
            variant={props.includeCompleted ? 'primary' : 'secondary'}
            onClick={props.onToggleCompleted}
          >
            완료 포함
          </Button>
        ) : null}
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
      {googleOn || googleTasksOn ? <GoogleScheduleNotice google={props.google} onOpenIntegrations={props.onOpenIntegrations} /> : null}
      {googleTasksOn ? <GoogleTasksNotice google={props.google} onOpenIntegrations={props.onOpenIntegrations} /> : null}
      <SourceFailureNotice sources={props.sources} sourceStatus={props.sourceStatus} />
      {props.loading ? <p className="schedule-page__status" role="status">일정을 불러오는 중…</p> : null}
      {props.error ? <p className="schedule-page__error" role="alert">{props.error}</p> : null}
    </>
  )
}
