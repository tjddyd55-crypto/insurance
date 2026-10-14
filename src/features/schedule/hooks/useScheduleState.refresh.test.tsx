/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'

const auth = { user: { id: 'user-a' }, token: 'token-a' }
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => auth }))

type Call = { refresh: boolean; resolve: (value: unknown) => void; reject: (error: unknown) => void }
const calls: Call[] = []
vi.mock('../api/scheduleApi', async () => {
  const actual = await vi.importActual<typeof import('../api/scheduleApi')>('../api/scheduleApi')
  return {
    ...actual,
    fetchScheduleEvents: vi.fn((_token: string, query: { refresh?: boolean }) => new Promise((resolve, reject) => calls.push({ refresh: Boolean(query.refresh), resolve, reject }))),
  }
})

const { useScheduleState, AUTO_REFETCH_MIN_MS } = await import('./useScheduleState')

let latest: ReturnType<typeof useScheduleState>
function Probe() {
  latest = useScheduleState()
  return <ul>{latest.events.map((event) => <li key={event.id}>{event.title}</li>)}</ul>
}

function response(title: string, fetchedAt: string) {
  return {
    from: '', to: '', sources: [], google: { configured: true, connected: true, status: 'connected', calendars: [], tasks: { status: 'connected', needsReconsent: false, taskLists: [] } },
    sourceStatus: { google: 'connected', google_task: 'connected', onefc_todo: 'ok', crm: 'ok' },
    events: [{ id: title, source: 'google', type: 'google_event', title, startAt: '2026-10-02T09:00:00+09:00', endAt: '2026-10-02T10:00:00+09:00', allDay: false }],
    tasks: [], fetchedAt, cacheBypassed: false,
  }
}

describe('일정 새로고침·마지막 갱신·focus 자동 재조회', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-02T03:00:00.000Z'))
    calls.length = 0
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  async function mount() {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/schedule?date=2026-10-02']}><Probe /></MemoryRouter>)
    })
    await act(async () => { calls[0].resolve(response('첫 조회', '2026-10-02T03:00:00.000Z')) })
  }

  it('수동 새로고침은 refresh=1, 진행 중 표시, 성공 안내, 마지막 갱신 갱신', async () => {
    await mount()
    expect(calls[0].refresh).toBe(false)
    expect(latest.lastRefreshedAt).toBe('2026-10-02T03:00:00.000Z')
    await act(async () => { latest.onRefresh() })
    expect(latest.refreshing).toBe(true)
    expect(calls[1].refresh).toBe(true)
    await act(async () => { calls[1].resolve(response('새 조회', '2026-10-02T03:05:00.000Z')) })
    expect(latest.refreshing).toBe(false)
    expect(latest.refreshMessage).toEqual({ kind: 'success', text: '일정을 새로 불러왔습니다.' })
    expect(latest.lastRefreshedAt).toBe('2026-10-02T03:05:00.000Z')
    expect(container.textContent).toContain('새 조회')
  })

  it('10초 제한(429)이면 보던 일정·마지막 갱신을 유지하고 오류 안내', async () => {
    await mount()
    await act(async () => { latest.onRefresh() })
    await act(async () => { calls[1].reject(new ApiError('일정 새로고침은 잠시 후 다시 시도해 주세요. (7초)', 429, { code: 'refresh_rate_limited', retryAfterSec: 7 })) })
    expect(latest.refreshing).toBe(false)
    expect(latest.refreshMessage).toEqual({ kind: 'error', text: '일정 새로고침은 잠시 후 다시 시도해 주세요. (7초)' })
    expect(container.textContent).toContain('첫 조회')
    expect(latest.lastRefreshedAt).toBe('2026-10-02T03:00:00.000Z')
    expect(latest.error).toBe('')
  })

  it('focus·visibility 로 자동 재조회(refresh 없이), 15초 안이면 건너뜀', async () => {
    await mount()
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(calls.length).toBe(1)
    vi.setSystemTime(Date.now() + AUTO_REFETCH_MIN_MS + 1)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(calls.length).toBe(2)
    expect(calls[1].refresh).toBe(false)
    await act(async () => { calls[1].resolve(response('자동 조회', '2026-10-02T03:01:00.000Z')) })
    expect(latest.lastRefreshedAt).toBe('2026-10-02T03:01:00.000Z')
  })
})
