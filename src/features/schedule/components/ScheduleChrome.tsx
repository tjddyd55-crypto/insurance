import type { ReactNode } from 'react'
import { Button } from '../../../components/ui'
import { formatScheduleRefreshedAt } from '../api/scheduleApi'
import { isScheduleFilterGroupOn, SCHEDULE_FILTER_GROUPS, type ScheduleViewProps } from '../hooks/useScheduleState'
import { periodTitle, scheduleShiftLabel, type ScheduleView } from '../domain/scheduleRange'

const VIEWS: Array<{ id: ScheduleView; label: string }> = [
  { id: 'month', label: '월간' },
  { id: 'week', label: '주간' },
  { id: 'day', label: '일간' },
  { id: 'list', label: '목록' },
]

/** 상단 오른쪽 Google 상태. 누르면 기존 서비스 연동(연결) 화면으로. */
export function ScheduleGoogleStatus({ google, onOpenIntegrations }: Pick<ScheduleViewProps, 'google' | 'onOpenIntegrations'>) {
  const reauth = google.status === 'needs_reauth' || google.status === 'error'
    || (google.status === 'connected' && Boolean(google.tasks?.needsReconsent || google.tasks?.status === 'scope_missing'))
  const label = reauth ? '재연결 필요' : google.status === 'connected' ? '연동 중' : '미연결'
  const tone = reauth ? 'warn' : google.status === 'connected' ? 'on' : 'off'
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={`schedule-page__google-status schedule-page__google-status--${tone}`}
      aria-label={`Google ${label}`}
      title="Google 연동 관리"
      onClick={onOpenIntegrations}
    >
      <span className="schedule-page__google-status-dot" aria-hidden="true">●</span> Google {label}
    </Button>
  )
}

/** 상단 1줄: 기간 제목 · [이전 달] 오늘 [다음 달] · 월간 주간 일간 목록 */
function SchedulePeriodNav(props: ScheduleViewProps & { groupClass: string }) {
  return (
    <>
      <strong className="schedule-page__period">{periodTitle(props.view, props.anchor)}</strong>
      <div className={props.groupClass}>
        <Button type="button" variant="secondary" size="sm" onClick={() => props.onShift(-1)} aria-label="이전 기간">{scheduleShiftLabel(props.view, props.anchor, -1)}</Button>
        <Button type="button" variant="secondary" size="sm" onClick={props.onToday}>오늘</Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => props.onShift(1)} aria-label="다음 기간">{scheduleShiftLabel(props.view, props.anchor, 1)}</Button>
      </div>
      <div className={props.groupClass} role="tablist" aria-label="일정 보기">
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
    </>
  )
}

/** 필터: 일정 · 할 일 · 알림일 · 자동차 만기 · 상령일 · 완료 포함 (서로 독립) */
function ScheduleFilterChips(props: ScheduleViewProps) {
  const anyTasksOn = props.sources.includes('google_task') || props.sources.includes('onefc_todo')
  return (
    <>
      {SCHEDULE_FILTER_GROUPS.map((group) => {
        const active = isScheduleFilterGroupOn(props.sources, group.id)
        return (
          <Button key={group.id} type="button" size="sm" aria-pressed={active} variant={active ? 'primary' : 'secondary'} onClick={() => props.onToggleSource(group.id)}>
            {group.label}
          </Button>
        )
      })}
      <Button type="button" size="sm" aria-pressed={props.includeCompleted} variant={props.includeCompleted ? 'primary' : 'secondary'} disabled={!anyTasksOn} onClick={props.onToggleCompleted}>
        완료 포함
      </Button>
    </>
  )
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

/**
 * PC 압축 툴바용 상태 표시. 안내 문장·배너 없이 짧은 chip 하나(필요할 때만).
 * 연결됨·정상이면 아무것도 표시하지 않는다.
 */
export function ScheduleCompactStatus(props: Pick<ScheduleViewProps, 'google' | 'sources' | 'sourceStatus' | 'onOpenIntegrations'>) {
  // Google 연결 상태는 상단 오른쪽 ScheduleGoogleStatus 가 맡는다.
  const chips: ReactNode[] = []
  const g = props.google
  const tasks = g.tasks
  if (props.sources.includes('google_task') && g.status === 'connected' && tasks) {
    if (tasks.status === 'error' || tasks.status === 'needs_reauth') {
      chips.push(<span key="t" className="schedule-page__status-chip schedule-page__status-chip--error" role="status">Google 할 일 실패</span>)
    }
  }
  const failed: string[] = []
  if (props.sources.includes('onefc_todo') && props.sourceStatus.onefc_todo === 'error') failed.push('ONE FC 할 일')
  const crmOn = props.sources.some((source) => source === 'customer_alert' || source === 'car_expiry' || source === 'insurance_age')
  if (crmOn && props.sourceStatus.crm === 'error') failed.push('CRM')
  if (failed.length > 0) {
    chips.push(<span key="s" className="schedule-page__status-chip schedule-page__status-chip--error" role="status">{failed.join('·')} 불러오기 실패</span>)
  }
  return chips.length > 0 ? <>{chips}</> : null
}

/** PC(≥769px) 압축 상단: 제목·이동·보기·상태·갱신 1줄, 출처·캘린더·공휴일 1줄. 동작·필터는 기존과 같다. */
function ScheduleCompactChrome(props: ScheduleViewProps & { toolbarExtra?: ReactNode }) {
  const googleOn = props.sources.includes('google')
  const anyTasksOn = props.sources.includes('google_task') || props.sources.includes('onefc_todo')
  const activeCalendarIds = props.calendarIds.length > 0
    ? props.calendarIds
    : props.google.calendars.filter((calendar) => calendar.defaultVisible).map((calendar) => calendar.id)
  return (
    <div className="schedule-page__toolbar">
      <div className="schedule-page__toolbar-row">
        <SchedulePeriodNav {...props} groupClass="schedule-page__toolbar-group" />
        {props.toolbarExtra ? <div className="schedule-page__toolbar-group schedule-page__toolbar-end">{props.toolbarExtra}</div> : null}
        <div className={props.toolbarExtra ? 'schedule-page__toolbar-group' : 'schedule-page__toolbar-group schedule-page__toolbar-end'}>
          <ScheduleCompactStatus google={props.google} sources={props.sources} sourceStatus={props.sourceStatus} onOpenIntegrations={props.onOpenIntegrations} />
          <ScheduleGoogleStatus google={props.google} onOpenIntegrations={props.onOpenIntegrations} />
          {props.loading ? <span className="schedule-page__status" role="status">불러오는 중…</span> : null}
          {props.error ? <span className="schedule-page__error" role="alert">{props.error}</span> : null}
          {props.refreshMessage ? (
            <span
              className={props.refreshMessage.kind === 'error' ? 'schedule-page__refresh-message schedule-page__refresh-message--error' : 'schedule-page__refresh-message'}
              role={props.refreshMessage.kind === 'error' ? 'alert' : 'status'}
            >
              {props.refreshMessage.text}
            </span>
          ) : null}
          <span className="schedule-page__refreshed" aria-live="polite">
            {props.lastRefreshedAt ? `마지막 갱신 ${formatScheduleRefreshedAt(props.lastRefreshedAt)}` : '마지막 갱신 -'}
          </span>
          <Button type="button" variant="secondary" size="sm" loading={props.refreshing} loadingText="새로고침 중…" onClick={props.onRefresh}>
            일정 새로고침
          </Button>
        </div>
      </div>
      <div className="schedule-page__toolbar-row">
        <div className="schedule-page__toolbar-group" role="group" aria-label="일정 필터">
          <ScheduleFilterChips {...props} />
          {anyTasksOn && props.view === 'list' ? (
            <Button type="button" size="sm" aria-pressed={props.includeOverdue} variant={props.includeOverdue ? 'primary' : 'secondary'} onClick={props.onToggleOverdue}>
              지난 할 일 전체
            </Button>
          ) : null}
        </div>
        {googleOn && props.google.status === 'connected' && props.google.calendars.length > 1 ? (
          <div className="schedule-page__toolbar-group" role="group" aria-label="Google 캘린더">
            {props.google.calendars.map((calendar) => {
              const on = activeCalendarIds.includes(calendar.id)
              return (
                <Button key={calendar.id} type="button" size="sm" aria-pressed={on} variant={on ? 'primary' : 'secondary'} onClick={() => props.onToggleCalendar(calendar.id)}>
                  {calendar.name}
                </Button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ScheduleChrome(props: ScheduleViewProps & { compact?: boolean; toolbarExtra?: ReactNode }) {
  if (props.compact) {
    return <ScheduleCompactChrome {...props} />
  }
  const googleOn = props.sources.includes('google')
  const googleTasksOn = props.sources.includes('google_task')
  const activeCalendarIds = props.calendarIds.length > 0
    ? props.calendarIds
    : props.google.calendars.filter((calendar) => calendar.defaultVisible).map((calendar) => calendar.id)
  return (
    <>
      <header className="schedule-page__header">
        <div className="schedule-page__nav">
          <SchedulePeriodNav {...props} groupClass="schedule-page__nav" />
        </div>
        <ScheduleGoogleStatus google={props.google} onOpenIntegrations={props.onOpenIntegrations} />
      </header>
      <div className="schedule-page__refresh">
        <span className="schedule-page__refreshed" aria-live="polite">
          {props.lastRefreshedAt ? `마지막 갱신 ${formatScheduleRefreshedAt(props.lastRefreshedAt)}` : '마지막 갱신 -'}
        </span>
        <Button type="button" variant="secondary" size="sm" loading={props.refreshing} loadingText="새로고침 중…" onClick={props.onRefresh}>
          일정 새로고침
        </Button>
        {props.toolbarExtra}
        {props.refreshMessage ? (
          <span
            className={props.refreshMessage.kind === 'error' ? 'schedule-page__refresh-message schedule-page__refresh-message--error' : 'schedule-page__refresh-message'}
            role={props.refreshMessage.kind === 'error' ? 'alert' : 'status'}
          >
            {props.refreshMessage.text}
          </span>
        ) : null}
      </div>
      <div className="schedule-page__chips" role="group" aria-label="일정 필터">
        <ScheduleFilterChips {...props} />
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
