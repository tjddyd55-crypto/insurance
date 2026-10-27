import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
})

const fetchMock = vi.fn()
const saveMock = vi.fn()
vi.mock('../api/scheduleApi', async (orig) => ({
  ...(await orig<object>()),
  fetchScheduleViewPrefs: (...a: unknown[]) => fetchMock(...a),
  saveScheduleViewPrefs: (...a: unknown[]) => saveMock(...a),
}))

const m = await import('./scheduleViewPrefs')

describe('scheduleViewPrefs store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    m.resetScheduleViewPrefsForTest()
    fetchMock.mockReset()
    saveMock.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('server value overrides local cache; load never saves (no loop)', async () => {
    localStorage.setItem('onefc.schedule.viewPrefs.u1', JSON.stringify({ includeCompleted: false }))
    expect(m.getScheduleViewPrefs('u1').includeCompleted).toBe(false)
    fetchMock.mockResolvedValue({ includeCompleted: true, sources: [] })
    await m.loadScheduleViewPrefs('u1', 't')
    await vi.advanceTimersByTimeAsync(1000)
    expect(m.getScheduleViewPrefs('u1')).toMatchObject({ includeCompleted: true, sources: [] })
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('preserves all-OFF sources and debounces save', async () => {
    saveMock.mockResolvedValue({ prefs: {} })
    m.queueScheduleViewPrefs('u1', 't', { sources: ['google'] })
    m.queueScheduleViewPrefs('u1', 't', { sources: [] })
    expect(m.getScheduleViewPrefs('u1').sources).toEqual([])
    await vi.advanceTimersByTimeAsync(m.SCHEDULE_VIEW_PREFS_SAVE_DELAY_MS + 10)
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock.mock.calls[0][1]).toEqual({ sources: [] })
  })

  it('failed save keeps state and resends with next change', async () => {
    saveMock.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ prefs: {} })
    m.queueScheduleViewPrefs('u1', 't', { includeOverdue: true })
    await vi.advanceTimersByTimeAsync(400)
    expect(m.getScheduleViewPrefs('u1').includeOverdue).toBe(true)
    m.queueScheduleViewPrefs('u1', 't', { includeCompleted: true })
    await vi.advanceTimersByTimeAsync(400)
    expect(saveMock.mock.calls[1][1]).toEqual({ includeOverdue: true, includeCompleted: true })
  })

  it('pending local change wins over late server load', async () => {
    saveMock.mockReturnValue(new Promise(() => {}))
    m.queueScheduleViewPrefs('u1', 't', { includeCompleted: true })
    fetchMock.mockResolvedValue({ includeCompleted: false })
    await m.loadScheduleViewPrefs('u1', 't')
    expect(m.getScheduleViewPrefs('u1').includeCompleted).toBe(true)
  })

  it('isolates users', () => {
    m.queueScheduleViewPrefs('u1', 't', { sources: [] })
    expect(m.getScheduleViewPrefs('u2').sources).toBeUndefined()
  })
})
