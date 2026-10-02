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
const { filterScheduleTasks, groupListTasks, isOverdueTask } = await import('../../domain/scheduleTasks')

import type { ScheduleEvent, ScheduleTask } from '../../api/scheduleApi'
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

function task(id: string, source: 'google_task' | 'onefc_todo', title: string, dueDate: string | null, extra: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id: `${source}:${id}`,
    source,
    sourceId: id,
    taskListId: source === 'google_task' ? 'L1' : null,
    taskListName: source === 'google_task' ? '업무 목록' : '',
    title,
    notes: '',
    dueDate,
    dueTime: null,
    status: 'open',
    completedAt: null,
    parentId: null,
    updatedAt: null,
    customerId: null,
    customerName: '',
    readOnly: true,
    ...extra,
  }
}

const TASKS: ScheduleTask[] = [
  task('t1', 'google_task', '서류 제출', '2026-10-03', { notes: '원본 서류 지참' }),
  task('t2', 'google_task', '완료한 일', '2026-10-05', { status: 'completed', completedAt: '2026-10-04T08:00:00.000Z' }),
  task('t3', 'google_task', '날짜 없는 일', null),
  task('t4', 'google_task', '지난 일', '2026-09-20'),
  task('o1', 'onefc_todo', '고객 전화', '2026-10-03', { customerName: '김고객', customerId: 9, notes: '오후 통화' }),
  task('o2', 'onefc_todo', '날짜 없는 내 할 일', null),
]

const OPEN_TASKS = TASKS.filter((item) => item.status === 'open')

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
    sources: ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'],
    calendarIds: [],
    taskListIds: [],
    events: EVENTS,
    tasks: OPEN_TASKS,
    includeCompleted: false,
    google: { configured: true, connected: true, status: 'connected', calendars: [], tasks: { status: 'connected', needsReconsent: false, taskLists: [] } },
    sourceStatus: { google: 'connected', google_task: 'connected', onefc_todo: 'ok', crm: 'ok' },
    loading: false,
    error: '',
    selectedDate: '',
    detail: null,
    taskDetail: null,
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
    onToggleTaskList: noop,
    onOpenEvent: noop,
    onCloseDetail: noop,
    onToggleCompleted: noop,
    onOpenTask: noop,
    onCloseTaskDetail: noop,
    onOpenTodos: noop,
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
  it('월간: 기간 제목, 출처 badge, +N, 필터 칩(전체/Google 일정/Google 할 일/ONE FC 할 일/알림일/자동차 만기/상령일)', () => {
    for (const mobile of [false, true]) {
      const html = render(props({ tasks: [] }), mobile)
      expect(html).toContain('일정 관리')
      expect(html).toContain('2026년 10월')
      expect(html).toContain('이전')
      expect(html).toContain('오늘')
      expect(html).toContain('다음')
      for (const label of ['월간', '주간', '일간', '전체', 'Google 일정', 'Google 할 일', 'ONE FC 할 일', '알림일', '자동차 만기', '상령일', '완료 포함']) {
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

  it('주간: 일~토 머리글(일요일 시작), 종일 영역, 09시 시간 block', () => {
    const html = render(props({ view: 'week' }))
    expect(html).toContain('2026.09.27 – 10.03')
    const heads = [...html.matchAll(/schedule-page__week-day[^"]*">([^<]+)</g)].map((match) => match[1])
    expect(heads).toEqual(['일 27', '월 28', '화 29', '수 30', '목 1', '금 2', '토 3'])
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
    expect(html).toContain('Google을 연결하면 Google Calendar 일정과 Google Tasks 할 일을 함께 볼 수 있습니다.')
    expect(html).toContain('서비스 연동으로 이동')
    expect(html).toContain('schedule-page__chip--customer_alert')
  })

  it('검증 기간 허용 목록 밖: Google 연동 준비 중, 연결 이동 버튼 없음, CRM 일정은 그대로', () => {
    const html = render(props({
      google: { configured: true, connected: false, status: 'disconnected', connectAllowed: false, calendars: [] },
      events: EVENTS.filter((event) => event.source === 'crm'),
    }))
    expect(html).toContain('Google 연동 준비 중입니다.')
    expect(html).not.toContain('서비스 연동으로 이동')
    expect(html).not.toContain('Google을 연결하면')
    expect(html).toContain('schedule-page__chip--customer_alert')
    expect(readScheduleEventsResponse({ events: [], google: { status: 'disconnected', connectAllowed: false } }).google.connectAllowed).toBe(false)
    expect(readScheduleEventsResponse({ events: [], google: { status: 'disconnected' } }).google).not.toHaveProperty('connectAllowed')
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

  it('Google 할 일 목록이 여럿이면 목록별 칩(PC·모바일), taskLists 선택 시 선택한 목록만 ON', () => {
    const taskLists = [{ id: 'QA', name: 'ONE FC QA' }, { id: 'ME', name: '내 할 일 목록' }]
    for (const mobile of [false, true]) {
      const base = { configured: true, connected: true, status: 'connected' as const, calendars: [], tasks: { status: 'connected' as const, needsReconsent: false, taskLists } }
      const all = render(props({ google: base }), mobile)
      expect(all).toContain('aria-label="Google 할 일 목록"')
      expect(all).toMatch(/aria-pressed="true"[^>]*>ONE FC QA/)
      expect(all).toMatch(/aria-pressed="true"[^>]*>내 할 일 목록/)
      const onlyQa = render(props({ google: base, taskListIds: ['QA'] }), mobile)
      expect(onlyQa).toMatch(/aria-pressed="true"[^>]*>ONE FC QA/)
      expect(onlyQa).toMatch(/aria-pressed="false"[^>]*>내 할 일 목록/)
    }
    const single = render(props({ google: { configured: true, connected: true, status: 'connected', calendars: [], tasks: { status: 'connected', needsReconsent: false, taskLists: [taskLists[0]] } } }))
    expect(single).not.toContain('aria-label="Google 할 일 목록"')
  })
})

describe('일정 관리: 요일 색 (일요일 빨강 · 토요일 파랑, PC·모바일)', () => {
  it('월간: 요일 머리글 일/토와 날짜 숫자(10/3 토·10/4 일·10/10 토·10/11 일)에 같은 색 class, 평일 없음', () => {
    for (const mobile of [false, true]) {
      const html = render(props({ events: [], tasks: [] }), mobile)
      expect(html).toMatch(/schedule-page__weekday schedule-page__tone--sun"[^>]*>일</)
      expect(html).toMatch(/schedule-page__weekday schedule-page__tone--sat"[^>]*>토</)
      expect(html).toMatch(/schedule-page__weekday"[^>]*>월</)
      expect(html).toMatch(/schedule-page__date schedule-page__tone--sat"[^>]*aria-label="2026-10-03 [^"]*"[^>]*>3</)
      expect(html).toMatch(/schedule-page__date schedule-page__tone--sun"[^>]*aria-label="2026-10-04 [^"]*"[^>]*>4</)
      expect(html).toMatch(/schedule-page__date schedule-page__tone--sat"[^>]*aria-label="2026-10-10 [^"]*"[^>]*>10</)
      expect(html).toMatch(/schedule-page__date"[^>]*aria-label="2026-10-05 [^"]*"[^>]*>5</)
    }
  })

  it('주간·일간·목록: 머리글/날짜에 같은 규칙', () => {
    for (const mobile of [false, true]) {
      const week = render(props({ view: 'week', anchor: '2026-10-07' }), mobile)
      expect(week).toMatch(/schedule-page__week-day schedule-page__tone--sun"[^>]*>일 (<!-- -->)?4</)
      expect(week).toMatch(/schedule-page__week-day schedule-page__tone--sat"[^>]*>토 (<!-- -->)?10</)
      const day = render(props({ view: 'day', anchor: '2026-10-04' }), mobile)
      expect(day).toMatch(/schedule-page__period schedule-page__tone--sun/)
      const weekday = render(props({ view: 'day', anchor: '2026-10-05' }), mobile)
      expect(weekday).not.toMatch(/schedule-page__period schedule-page__tone/)
      const list = render(props({ view: 'list', events: [crm('x1', 'customer_alert', '토요일 일정', '2026-10-10', '2026-10-11')], tasks: [] }), mobile)
      expect(list).toMatch(/schedule-page__tone--sat">2026-10-10 \(토\)/)
    }
  })
})

describe('일정 관리: 할 일 (Google Tasks · ONE FC 할 일, 읽기 전용)', () => {
  it('월간: 예정일 있는 할 일은 그 날 칸에 ○ 할 일 칩, 날짜 없는 할 일은 칸에 없음', () => {
    for (const mobile of [false, true]) {
      const html = render(props({ events: [] }), mobile)
      expect(html).toContain('schedule-page__chip--task')
      expect(html).toContain('schedule-page__chip--google_task')
      expect(html).toContain('schedule-page__chip--onefc_todo')
      expect(html).toMatch(/Google 할 일 · 할 일 · 서류 제출/)
      expect(html).toContain('○')
      expect(html).toContain('할 일 2건')
      expect(html).not.toContain('날짜 없는 일')
      expect(html).not.toContain('날짜 없는 내 할 일')
    }
  })

  it('월간: 완료 포함이면 완료 할 일도 ✓ 표시', () => {
    const html = render(props({ events: [], tasks: TASKS, includeCompleted: true }))
    expect(html).toContain('schedule-page__chip--done')
    expect(html).toContain('✓')
    expect(html).toMatch(/aria-pressed="true"[^>]*>완료 포함/)
  })

  it('주간: 할 일은 시간 축이 아니라 위쪽 할 일 줄에만', () => {
    const html = render(props({ view: 'week' }))
    expect(html).toContain('aria-label="할 일"')
    const taskRow = html.slice(html.indexOf('schedule-page__task-row'), html.indexOf('schedule-page__hours'))
    expect(taskRow).toContain('서류 제출')
    expect(taskRow).toContain('고객 전화')
    const hours = html.slice(html.indexOf('schedule-page__hours'))
    expect(hours).not.toContain('서류 제출')
    expect(hours).not.toContain('schedule-page__block--task')
  })

  it('일간: 할 일 묶음이 시간 일정과 따로 위에', () => {
    const html = render(props({ view: 'day', anchor: '2026-10-03', events: [google('g9', '오전 미팅', '2026-10-03T09:00:00+09:00', '2026-10-03T10:00:00+09:00')] }))
    const section = html.indexOf('schedule-page__task-section')
    expect(section).toBeGreaterThan(-1)
    expect(html.indexOf('서류 제출')).toBeGreaterThan(section)
    expect(html.indexOf('오전 미팅')).toBeGreaterThan(html.indexOf('서류 제출'))
    expect(html).toContain('김고객')
    expect(html).not.toContain('지난 일')
  })

  it('목록: 지난 할 일, 할 일, 날짜 없음 묶음과 출처 badge·목록 이름·메모', () => {
    for (const mobile of [false, true]) {
      const html = render(props({ view: 'list', tasks: TASKS, includeCompleted: true }), mobile)
      expect(html).toContain('aria-label="지난 할 일"')
      expect(html).toContain('aria-label="날짜 없음"')
      expect(html.indexOf('지난 일')).toBeLessThan(html.indexOf('본사 미팅'))
      expect(html.indexOf('날짜 없는 일')).toBeGreaterThan(html.indexOf('서류 제출'))
      expect(html).toContain('schedule-page__badge--google_task')
      expect(html).toContain('schedule-page__badge--onefc_todo')
      expect(html).toContain('schedule-page__badge--google')
      expect(html).toContain('schedule-page__badge--insurance_age')
      expect(html).toContain('업무 목록')
      expect(html).toContain('원본 서류 지참')
      expect(html).toContain('완료')
      expect(html).toContain('지남')
    }
  })

  it('Google 할 일 상세: 제목·목록·예정일·메모·상태·Google 출처, 편집 UI 없음', () => {
    const html = render(props({ taskDetail: TASKS[0] }))
    expect(html).toContain('서류 제출')
    expect(html).toContain('업무 목록')
    expect(html).toContain('2026-10-03 (토)')
    expect(html).toContain('원본 서류 지참')
    expect(html).toContain('진행 중')
    expect(html).toContain('Google 출처 · 읽기 전용')
    expect(html).toContain('data-backdrop="true"')
    expect(html).not.toContain('저장')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('할 일 화면에서 보기')
  })

  it('ONE FC 할 일 상세는 할 일 화면으로만 이동', () => {
    const html = render(props({ taskDetail: TASKS[4] }))
    expect(html).toContain('김고객')
    expect(html).toContain('할 일 화면에서 보기')
    expect(html).not.toContain('Google 출처')
  })

  it('Tasks 권한 없음: 다시 연결 안내, Google 일정·CRM 은 계속', () => {
    const html = render(props({
      tasks: OPEN_TASKS.filter((item) => item.source === 'onefc_todo'),
      google: { configured: true, connected: true, status: 'connected', calendars: [], tasks: { status: 'scope_missing', needsReconsent: true, taskLists: [] } },
      sourceStatus: { google: 'connected', google_task: 'scope_missing', onefc_todo: 'ok', crm: 'ok' },
    }))
    expect(html).toContain('Google 할 일을 보려면 Google을 다시 연결해 Google Tasks 읽기 권한을 허용해 주세요.')
    expect(html).toContain('재연결 필요')
    expect(html).toContain('schedule-page__chip--google')
    expect(html).toContain('schedule-page__chip--customer_alert')
    expect(html).toContain('schedule-page__chip--onefc_todo')
  })

  it('Google 할 일 실패·ONE FC 할 일 실패는 해당 출처만 안내하고 다른 출처는 그대로', () => {
    const html = render(props({
      view: 'list',
      tasks: OPEN_TASKS.filter((item) => item.source === 'onefc_todo'),
      google: { configured: true, connected: true, status: 'connected', calendars: [], tasks: { status: 'error', needsReconsent: false, taskLists: [] } },
      sourceStatus: { google: 'connected', google_task: 'error', onefc_todo: 'ok', crm: 'ok' },
    }))
    expect(html).toContain('Google 할 일을 불러오지 못했습니다.')
    expect(html).toContain('본사 미팅')
    expect(html).toContain('고객 전화')
    const todoFail = render(props({
      tasks: OPEN_TASKS.filter((item) => item.source === 'google_task'),
      sourceStatus: { google: 'connected', google_task: 'connected', onefc_todo: 'error', crm: 'ok' },
    }))
    expect(todoFail).toContain('ONE FC 할 일을 불러오지 못했습니다.')
    expect(todoFail).toContain('schedule-page__chip--google_task')
  })
})

describe('일정 필터·날짜 규칙', () => {
  it('출처 필터 토글', () => {
    const all = parseScheduleSources(null)
    expect(all).toEqual(['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'])
    expect(parseScheduleSources('google_task,onefc_todo')).toEqual(['google_task', 'onefc_todo'])
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
    expect(readScheduleEventsResponse(body).tasks).toEqual([])
    expect(readScheduleEventsResponse(body).sourceStatus.google_task).toBe('skipped')
    const withTasks = readScheduleEventsResponse({
      success: true,
      data: { ...body, tasks: [TASKS[0]], sourceStatus: { google_task: 'scope_missing' }, google: { ...body.google, tasks: { status: 'scope_missing', needsReconsent: true } } },
    })
    expect(withTasks.tasks).toHaveLength(1)
    expect(withTasks.sourceStatus.google_task).toBe('scope_missing')
    expect(withTasks.google.tasks?.needsReconsent).toBe(true)
  })

  it('할 일 날짜 규칙: 지난 할 일은 오늘(KST) 이전·미완료, 완료 포함 필터, 목록 묶음은 겹치지 않는다', () => {
    expect(isOverdueTask(TASKS[3], '2026-10-02')).toBe(true)
    expect(isOverdueTask({ ...TASKS[3], status: 'completed' }, '2026-10-02')).toBe(false)
    expect(isOverdueTask(TASKS[2], '2026-10-02')).toBe(false)
    expect(isOverdueTask(TASKS[0], '2026-10-03')).toBe(false)
    const all = ['google', 'google_task', 'onefc_todo'] as const
    expect(filterScheduleTasks(TASKS, [...all], false).map((item) => item.sourceId)).toEqual(['t1', 't3', 't4', 'o1', 'o2'])
    expect(filterScheduleTasks(TASKS, [...all], true)).toHaveLength(6)
    expect(filterScheduleTasks(TASKS, ['onefc_todo'], false).map((item) => item.sourceId)).toEqual(['o1', 'o2'])
    const groups = groupListTasks(TASKS, { start: '2026-10-01', end: '2026-10-31' }, '2026-10-02')
    expect(groups.overdue.map((item) => item.sourceId)).toEqual(['t4'])
    expect(groups.dated.map((item) => item.sourceId)).toEqual(['o1', 't1', 't2'])
    expect(groups.undated.map((item) => item.sourceId).sort()).toEqual(['o2', 't3'])
  })
})
