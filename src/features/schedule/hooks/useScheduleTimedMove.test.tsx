/**
 * @vitest-environment jsdom
 */
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import type { ScheduleEvent } from '../api/scheduleApi'
import { moveTimedRange, readTimedRange } from '../domain/scheduleWeekDrag'

const api = vi.hoisted(() => ({
  updateOnefcSchedule: vi.fn(),
  updateGoogleEvent: vi.fn(),
}))

vi.mock('../api/scheduleApi', async () => {
  const actual = await vi.importActual<typeof import('../api/scheduleApi')>('../api/scheduleApi')
  return { ...actual, updateOnefcSchedule: api.updateOnefcSchedule, updateGoogleEvent: api.updateGoogleEvent }
})

const { useScheduleTimedMove } = await import('./useScheduleTimedMove')

function timed(origin: ScheduleEvent['origin']): ScheduleEvent {
  return {
    id: origin === 'onefc' ? 'onefc:item-1' : 'google:primary:item-1',
    source: 'google',
    sourceId: 'item-1',
    calendarId: origin === 'onefc' ? null : 'primary',
    calendarName: origin === 'onefc' ? 'ONE FC' : '내 캘린더',
    type: 'google_event',
    title: '상담',
    description: '메모',
    startAt: '2026-11-06T14:00:00+09:00',
    endAt: '2026-11-06T16:00:00+09:00',
    allDay: false,
    timezone: 'Asia/Seoul',
    customerId: null,
    customerName: '',
    location: '',
    status: 'confirmed',
    readOnly: false,
    phone: '',
    htmlLink: null,
    sourceDate: null,
    sourceTitle: null,
    writable: true,
    origin,
  }
}

let latest: ReturnType<typeof useScheduleTimedMove>

function Probe({ events, onReload }: { events: ScheduleEvent[]; onReload: () => void }) {
  const state = useScheduleTimedMove('token-1', events, onReload)
  useEffect(() => {
    latest = state
  })
  return <div>{state.events[0]?.startAt}{state.error}</div>
}

describe('주간 시간 블록 저장', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    api.updateOnefcSchedule.mockReset()
    api.updateGoogleEvent.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  async function mount(event: ScheduleEvent, onReload: () => void) {
    await act(async () => {
      root.render(<Probe events={[event]} onReload={onReload} />)
    })
  }

  it('드롭 즉시 화면을 바꾸고 ONE FC 수정 API로 시작·종료를 저장한다', async () => {
    const event = timed('onefc')
    const onReload = vi.fn()
    api.updateOnefcSchedule.mockResolvedValue({ event })
    await mount(event, onReload)
    const range = moveTimedRange(readTimedRange(event)!, 1, 60)

    await act(async () => { await latest.commit(event, range) })

    expect(latest.events[0]?.startAt).toBe('2026-11-07T15:00:00+09:00')
    expect(latest.events[0]?.endAt).toBe('2026-11-07T17:00:00+09:00')
    expect(api.updateOnefcSchedule).toHaveBeenCalledWith('token-1', 'item-1', {
      calendarId: '',
      title: '상담',
      description: '메모',
      date: '2026-11-07',
      endDate: '2026-11-07',
      allDay: false,
      startTime: '15:00',
      endTime: '17:00',
    })
    expect(api.updateGoogleEvent).not.toHaveBeenCalled()
    expect(onReload).toHaveBeenCalledOnce()
    expect(latest.error).toBe('')
  })

  it('저장에 실패하면 원래 시간으로 되돌리고 오류를 보여 준다', async () => {
    const event = timed('onefc')
    const onReload = vi.fn()
    api.updateOnefcSchedule.mockRejectedValue(new ApiError('일정을 저장할 수 없습니다.', 500))
    await mount(event, onReload)

    await act(async () => {
      await latest.commit(event, moveTimedRange(readTimedRange(event)!, 0, 60))
    })

    expect(latest.events[0]?.startAt).toBe(event.startAt)
    expect(latest.events[0]?.endAt).toBe(event.endAt)
    expect(latest.error).toBe('일정을 저장할 수 없습니다.')
    expect(onReload).not.toHaveBeenCalled()
  })

  it('쓰기 가능한 Google 일정은 Google 수정 API로 저장한다', async () => {
    const event = timed(undefined)
    const onReload = vi.fn()
    api.updateGoogleEvent.mockResolvedValue({ event })
    await mount(event, onReload)

    await act(async () => {
      await latest.commit(event, moveTimedRange(readTimedRange(event)!, 0, 30))
    })

    expect(api.updateGoogleEvent).toHaveBeenCalledWith('token-1', expect.objectContaining({
      calendarId: 'primary',
      eventId: 'item-1',
      date: '2026-11-06',
      startTime: '14:30',
      endTime: '16:30',
    }))
    expect(api.updateOnefcSchedule).not.toHaveBeenCalled()
  })
})
