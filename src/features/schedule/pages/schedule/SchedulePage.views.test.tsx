import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../components/dialog/BaseDialog', () => ({
  BaseDialog: (props: { open?: boolean; children?: ReactNode; closeOnBackdrop?: boolean }) => (
    props.open ? <div data-dialog data-backdrop={String(Boolean(props.closeOnBackdrop))}>{props.children}</div> : null
  ),
}))

const { default: SchedulePCView } = await import('./SchedulePCView')
const { default: ScheduleMobileView } = await import('./ScheduleMobileView')
const { readScheduleEventsResponse } = await import('../../api/scheduleApi')
const { parseScheduleSources, toggleScheduleSource } = await import('../../hooks/useScheduleState')
const { eventCoversDate, eventEndDay, eventStartDay } = await import('../../domain/scheduleEventTime')

import type { ScheduleEvent } from '../../api/scheduleApi'
import type { ScheduleViewProps } from '../../hooks/useScheduleState'

function google(id: string, title: string, startAt: string, endAt: string, extra: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: `google:primary:${id}`,
    source: 'google',
    sourceId: id,
    calendarId: 'primary',
    calendarName: '내 캘린더',
    type: 'google_event',
    title,
    description: '',
    startAt,
    endAt,
    allDay: !startAt.includes('T'),
    timezone: 'Asia/Seoul',
    customerId: null,
    customerName: '',
    location: '',
    status: 'confirmed',
    readOnly: true,
    phone: '',
    htmlLink: `https://www.google.com/calendar/event?eid=${id}`,
    sourceDate: null,
    sourceTitle: null,
    ...extra,
  }
}

function crm(id: string, type: 'customer_alert' | 'car_expiry' | 'insurance_age', title: string, date: string, endAt: string): ScheduleEvent {
  return {
    id: `crm:${id}`,
    source: 'crm',
    sourceId: id,
    calendarId: null,
    calendarName: '',
    type,
    title,
    description: '',
    startAt: date,
    endAt,
    allDay: true,
    timezone: 'Asia/Seoul',
    customerId: 7,
    customerName: '홍길동',
    location: '',
    status: 'confirmed',
    readOnly: type !== 'customer_alert',
    phone: '',
    htmlLink: null,
    sourceDate: null,
    sourceTitle: null,
  }
}

const EVENTS: ScheduleEvent[] = [
  google('g1', '본사 미팅', '2026-10-02T09:00:00+09:00', '2026-10-02T10:00:00+09:00', { location: '서울 본사', description: '분기 보고' }),
  google('g2', '워크숍', '2026-10-02', '2026-10-03'),
  crm('a1', 'customer_alert', '홍길동 결혼기념일', '2026-10-02', '2026-10-03'),
  crm('c1', 'car_expiry', '홍길동 12가3456', '2026-10-02', '2026-10-03'),
  crm('s1', 'insurance_age', '홍길동 상령일', '2026-10-02', '2026-10-03'),
]

function props(overrides: Partial<ScheduleViewProps> = {}): ScheduleViewProps {
  const noop = () => undefined
  return {
    token: 't',
    view: 'month',
    anchor: '2026-10-02',
    today: '2026-10-02',
    sources: ['google', 'customer_alert', 'car_expiry', 'insurance_age'],
    calendarIds: [],
    events: EVENTS,
    google: { configured: true, connected: true, status: 'connected', calendars: [] },
    loading: false,
    error: '',
    selectedDate: '',
    detail: null,
    editing: null,
    editTitle: '',
    editDate: '',
    editDirty: false,
    onSelectView: noop,
    onShift: noop,
    onToday: noop,
    onSelectDate: noop,
    onOpenDay: noop,
    onToggleSource: noop,
    onToggleCalendar: noop,
    onOpenEvent: noop,
    onCloseDetail: noop,
    onOpenCustomer: noop,
    onOpenIntegrations: noop,
    onEditTitle: noop,
    onEditDate: noop,
    onCloseEdit: noop,
    onSaveEdit: noop,
    ...overrides,
  }
}

function render(view: ScheduleViewProps, mobile = false) {
  const View = mobile ? ScheduleMobileView : SchedulePCView
  return renderToStaticMarkup(<MemoryRouter><View {...view} /></MemoryRouter>)
}

describe('일정 관리 화면 (PC·모바일 웹 공통)', () => {
  it('월간: 기간 제목, 출처 badge, +N, 필터 칩(전체/Google/알림일/자동차 만기/상령일)', () => {
    for (const mobile of [false, true]) {
      const html = render(props(), mobile)
      expect(html).toContain('일정 관리')
      expect(html).toContain('2026년 10월')
      expect(html).toContain('이전')
      expect(html).toContain('오늘')
      expect(html).toContain('다음')
      for (const label of ['월간', '주간', '일간', '전체', 'Google', '알림일', '자동차 만기', '상령일']) {
        expect(html).toContain(label)
      }
      expect(html).not.toContain('개인 일정')
      expect(html).toContain('schedule-page__chip--google')
      expect(html).toContain('schedule-page__chip--car_expiry')
      expect(html).toContain('+2')
      expect(html).toContain(mobile ? 'schedule-page--mobile' : 'schedule-page--pc')
    }
  })

  it('월간: 날짜를 고르면 그 날 상세 목록이 열린다', () => {
    const html = render(props({ selectedDate: '2026-10-02' }))
    expect(html).toContain('2026-10-02 (금)')
    expect(html).toContain('일간 보기')
    expect(html).toContain('본사 미팅')
    expect(html).toContain('09:00–10:00')
  })

  it('주간: 월~일 머리글, 종일 영역, 09시 시간 block', () => {
    const html = render(props({ view: 'week' }))
    expect(html).toContain('2026.09.28 – 10.04')
    expect(html).toContain('월 28')
    expect(html).toContain('일 4')
    expect(html).toContain('종일')
    expect(html).toMatch(/09:00<\/span>.*schedule-page__block--google/s)
    expect(html).toContain('워크숍')
  })

  it('일간: 시간순, 시간/제목/출처/고객명/설명/위치', () => {
    const html = render(props({ view: 'day' }))
    expect(html).toContain('2026년 10월 2일 (금)')
    expect(html).toContain('서울 본사')
    expect(html).toContain('분기 보고')
    expect(html).toContain('홍길동')
    const allDayIndex = html.indexOf('워크숍')
    const timedIndex = html.indexOf('본사 미팅', html.indexOf('schedule-page__day-list'))
    expect(allDayIndex).toBeGreaterThan(-1)
    expect(timedIndex).toBeGreaterThan(allDayIndex)
  })

  it('Google 상세는 읽기 전용이고 안전한 링크만 새 탭으로 연다', () => {
    const html = render(props({ detail: EVENTS[0] }))
    expect(html).toContain('Google Calendar에서 열기')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('읽기 전용')
    expect(html).toContain('내 캘린더')
    expect(html).toContain('data-backdrop="true"')
    const noLink = render(props({ detail: { ...EVENTS[0], htmlLink: null } }))
    expect(noLink).not.toContain('Google Calendar에서 열기')
  })

  it('알림일 수정 모달은 바깥 클릭으로 닫히지 않는다', () => {
    const html = render(props({ editing: EVENTS[2], editTitle: '결혼기념일', editDate: '2020-10-02' }))
    expect(html).toContain('알림일 수정')
    expect(html).toContain('data-backdrop="false"')
    expect(html).toContain('고객 상세')
  })

  it('미연동이면 연결 안내와 서비스 연동 이동, CRM 일정은 그대로', () => {
    const html = render(props({
      google: { configured: true, connected: false, status: 'disconnected', calendars: [] },
      events: EVENTS.filter((event) => event.source === 'crm'),
    }))
    expect(html).toContain('Google Calendar를 연결하면 일정을 함께 볼 수 있습니다.')
    expect(html).toContain('서비스 연동으로 이동')
    expect(html).toContain('schedule-page__chip--customer_alert')
  })

  it('재연결 필요·Google 장애는 Google 만 표시하고 CRM 일정은 계속', () => {
    const reauth = render(props({ google: { configured: true, connected: true, status: 'needs_reauth', calendars: [] } }))
    expect(reauth).toContain('재연결 필요')
    expect(reauth).toContain('서비스 연동에서 다시 연결')
    const failed = render(props({ view: 'day', google: { configured: true, connected: true, status: 'error', calendars: [] } }))
    expect(failed).toContain('Google 일정을 지금 불러오지 못했습니다. CRM 일정은 계속 표시됩니다.')
    expect(failed).toContain('홍길동 상령일')
  })

  it('Google 캘린더가 여럿이면 캘린더별 ON/OFF 칩', () => {
    const html = render(props({
      google: {
        configured: true,
        connected: true,
        status: 'connected',
        calendars: [
          { id: 'primary', name: '내 캘린더', primary: true, accessRole: 'owner', timezone: 'Asia/Seoul', selected: true, defaultVisible: true },
          { id: 'team', name: '팀 캘린더', primary: false, accessRole: 'reader', timezone: 'Asia/Seoul', selected: false, defaultVisible: false },
        ],
      },
    }))
    expect(html).toContain('aria-label="Google 캘린더"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>내 캘린더/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>팀 캘린더/)
  })
})

describe('일정 필터·날짜 규칙', () => {
  it('출처 필터 토글', () => {
    const all = parseScheduleSources(null)
    expect(all).toEqual(['google', 'customer_alert', 'car_expiry', 'insurance_age'])
    expect(toggleScheduleSource(all, 'google')).toEqual(['google'])
    expect(toggleScheduleSource(['google'], 'car_expiry')).toEqual(['google', 'car_expiry'])
    expect(toggleScheduleSource(['google'], 'google')).toEqual(all)
    expect(toggleScheduleSource(['google'], 'all')).toEqual(all)
    expect(parseScheduleSources('personal')).toEqual(all)
  })

  it('종일은 달력일 그대로, 시간 일정은 서울 날짜(자정 끝은 다음 날 제외)', () => {
    const allDay = google('x', '종일', '2026-10-31', '2026-11-02')
    expect(eventStartDay(allDay)).toBe('2026-10-31')
    expect(eventEndDay(allDay)).toBe('2026-11-01')
    expect(eventCoversDate(allDay, '2026-11-01')).toBe(true)
    expect(eventCoversDate(allDay, '2026-11-02')).toBe(false)
    const lateNight = google('y', '밤', '2026-10-02T23:00:00+09:00', '2026-10-03T00:00:00+09:00')
    expect(eventEndDay(lateNight)).toBe('2026-10-02')
    const utc = google('z', 'UTC', '2026-10-02T15:30:00Z', '2026-10-02T16:00:00Z')
    expect(eventStartDay(utc)).toBe('2026-10-03')
  })

  it('봉투/풀린 본문 모두 읽는다', () => {
    const body = { from: '2026-10-01', to: '2026-10-31', sources: [], google: { configured: true, connected: false, status: 'disconnected' }, events: [] }
    expect(readScheduleEventsResponse(body).google.status).toBe('disconnected')
    expect(readScheduleEventsResponse({ success: true, data: body }).google.calendars).toEqual([])
    expect(readScheduleEventsResponse(null).google.status).toBe('unconfigured')
  })
})
