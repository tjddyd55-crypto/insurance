/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { user: { id: 'user-a' }, token: 'token-a' }

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => auth,
}))

type Pending = { token: string; resolve: (value: unknown) => void }
const pending: Pending[] = []

vi.mock('../api/scheduleApi', async () => {
  const actual = await vi.importActual<typeof import('../api/scheduleApi')>('../api/scheduleApi')
  return {
    ...actual,
    fetchScheduleEvents: vi.fn((token: string) => new Promise((resolve) => pending.push({ token, resolve }))),
  }
})

const { useScheduleState } = await import('./useScheduleState')

function Probe() {
  const state = useScheduleState()
  return (
    <div>
      <span data-google>{state.google.status}</span>
      <span data-account>{state.google.calendars.map((calendar) => calendar.name).join(',')}</span>
      <ul>{state.events.map((event) => <li key={event.id}>{event.title}</li>)}</ul>
      <ol>{state.tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ol>
    </div>
  )
}

function googleEvent(title: string) {
  return {
    id: `google:primary:${title}`, source: 'google', sourceId: title, calendarId: 'primary', calendarName: 'A', type: 'google_event',
    title, description: '', startAt: '2026-10-02T09:00:00+09:00', endAt: '2026-10-02T10:00:00+09:00', allDay: false,
    timezone: 'Asia/Seoul', customerId: null, customerName: '', location: '', status: 'confirmed', readOnly: true, phone: '',
    htmlLink: null, sourceDate: null, sourceTitle: null,
  }
}

describe('로그아웃/로그인 사용자 전환', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    pending.length = 0
    auth.user = { id: 'user-a' }
    auth.token = 'token-a'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('B 로 바뀌면 A 의 Google 상태·일정이 B 응답 전에도 남지 않는다', async () => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/schedule?date=2026-10-02']}><Probe /></MemoryRouter>)
    })
    expect(pending.at(-1)?.token).toBe('token-a')
    await act(async () => {
      pending.at(-1)?.resolve({
        from: '2026-09-27', to: '2026-11-07', sources: [],
        google: { configured: true, connected: true, status: 'connected', calendars: [{ id: 'primary', name: 'alice@example.com', primary: true, accessRole: 'owner', timezone: 'Asia/Seoul', selected: true, defaultVisible: true }] },
        events: [googleEvent('A 비밀 일정')],
        tasks: [{
          id: 'google_task:L1:t1', source: 'google_task', sourceId: 't1', taskListId: 'L1', taskListName: 'A 목록', title: 'A 비밀 할 일',
          notes: '', dueDate: '2026-10-03', dueTime: null, status: 'open', completedAt: null, parentId: null, updatedAt: null,
          customerId: null, customerName: '', readOnly: true,
        }],
        sourceStatus: { google: 'connected', google_task: 'connected', onefc_todo: 'ok', crm: 'ok' },
      })
    })
    expect(container.textContent).toContain('A 비밀 일정')
    expect(container.textContent).toContain('A 비밀 할 일')
    expect(container.querySelector('[data-google]')?.textContent).toBe('connected')

    auth.user = { id: 'user-b' }
    auth.token = 'token-b'
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/schedule?date=2026-10-02']}><Probe /></MemoryRouter>)
    })
    expect(container.textContent).not.toContain('A 비밀 일정')
    expect(container.textContent).not.toContain('A 비밀 할 일')
    expect(container.textContent).not.toContain('alice@example.com')
    expect(container.querySelector('[data-google]')?.textContent).toBe('unconfigured')
    expect(pending.at(-1)?.token).toBe('token-b')

    // 늦게 도착한 A 응답이 B 화면을 덮어쓰지 않는다.
    await act(async () => {
      pending.find((item) => item.token === 'token-a')?.resolve({
        from: '', to: '', sources: [], google: { configured: true, connected: true, status: 'connected', calendars: [] }, events: [googleEvent('A 늦은 응답')],
      })
    })
    expect(container.textContent).not.toContain('A 늦은 응답')
  })
})
