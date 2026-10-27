import {
  fetchScheduleViewPrefs,
  saveScheduleViewPrefs,
  SCHEDULE_FILTER_KEYS,
  type ScheduleFilterKey,
  type ScheduleViewPrefs,
} from '../api/scheduleApi'

/**
 * 일정 표시 설정 저장소(사용자별).
 * - SSOT: 서버 /api/me/schedule-view-prefs. 로컬 캐시(onefc.schedule.viewPrefs.<userId>)는 즉시 표시·오프라인용.
 * - 저장은 사용자 토글에서만 queue → 300ms debounce PATCH. 복원(load)은 절대 저장을 부르지 않는다(루프 방지).
 * - 실패해도 화면 상태·일정 데이터에는 영향 없음(다음 토글 때 남은 변경을 함께 재전송).
 */

export const SCHEDULE_VIEW_PREFS_SAVE_DELAY_MS = 300
const CACHE_PREFIX = 'onefc.schedule.viewPrefs.'
const LEGACY_HOLIDAY_PREFIX = 'onefc.schedule.holidayMode.'
const KEYS = ['sources', 'includeCompleted', 'includeOverdue', 'googleCalendarIds', 'holidayMode'] as const

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function sanitizeScheduleViewPrefs(raw: unknown): ScheduleViewPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const src = raw as Record<string, unknown>
  const out: ScheduleViewPrefs = {}
  if (Array.isArray(src.sources)) out.sources = SCHEDULE_FILTER_KEYS.filter((key) => (src.sources as unknown[]).includes(key))
  if (typeof src.includeCompleted === 'boolean') out.includeCompleted = src.includeCompleted
  if (typeof src.includeOverdue === 'boolean') out.includeOverdue = src.includeOverdue
  if (src.googleCalendarIds === null) out.googleCalendarIds = null
  else if (Array.isArray(src.googleCalendarIds)) out.googleCalendarIds = src.googleCalendarIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
  if (src.holidayMode === 'kr' || src.holidayMode === 'none') out.holidayMode = src.holidayMode
  return out
}

export function readCachedScheduleViewPrefs(userId: string): ScheduleViewPrefs {
  if (!userId) return {}
  try {
    const raw = storage()?.getItem(CACHE_PREFIX + userId)
    return raw ? sanitizeScheduleViewPrefs(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

function writeCache(userId: string, prefs: ScheduleViewPrefs) {
  if (!userId) return
  try {
    storage()?.setItem(CACHE_PREFIX + userId, JSON.stringify(prefs))
  } catch {
    /* 캐시 실패는 무시 */
  }
}

type Entry = { prefs: ScheduleViewPrefs; pending: ScheduleViewPrefs; timer: ReturnType<typeof setTimeout> | null; token: string; serverLoaded: boolean }
const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()

function entry(userId: string): Entry {
  let e = entries.get(userId)
  if (!e) {
    e = { prefs: readCachedScheduleViewPrefs(userId), pending: {}, timer: null, token: '', serverLoaded: false }
    entries.set(userId, e)
  }
  return e
}

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeScheduleViewPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 현재 알고 있는 저장값(서버 > 캐시). 없으면 {} → 호출 측 기본값. */
export function getScheduleViewPrefs(userId: string): ScheduleViewPrefs {
  return userId ? entry(userId).prefs : {}
}

function flush(userId: string) {
  const e = entries.get(userId)
  if (!e) return
  e.timer = null
  const patch = e.pending
  if (!e.token || Object.keys(patch).length === 0) return
  e.pending = {}
  saveScheduleViewPrefs(e.token, patch).catch(() => {
    // 실패: 화면은 그대로. 더 새 변경이 없던 키만 다음 저장 때 다시 보낸다.
    const cur = entries.get(userId)
    if (cur) cur.pending = { ...patch, ...cur.pending }
  })
}

/** 사용자 토글 → 즉시 메모리/캐시 반영, 300ms 후 서버 저장(부분 업데이트). */
export function queueScheduleViewPrefs(userId: string, token: string | null | undefined, patch: ScheduleViewPrefs) {
  if (!userId) return
  const clean = sanitizeScheduleViewPrefs(patch)
  for (const key of KEYS) if (key in patch && !(key in clean)) return
  const e = entry(userId)
  e.token = String(token ?? '').trim()
  e.prefs = { ...e.prefs, ...clean }
  e.pending = { ...e.pending, ...clean }
  writeCache(userId, e.prefs)
  if (e.timer) clearTimeout(e.timer)
  e.timer = setTimeout(() => flush(userId), SCHEDULE_VIEW_PREFS_SAVE_DELAY_MS)
  emit()
}

/**
 * 서버 저장값을 읽어 캐시에 반영(저장하지 않음). 아직 보내지 않은 로컬 변경이 있으면 그 키는 로컬 우선.
 * 공휴일: 서버에 holidayMode 가 없고 이전 브라우저 설정이 'none' 이면 1회 이전.
 */
export async function loadScheduleViewPrefs(userId: string, token: string): Promise<ScheduleViewPrefs> {
  if (!userId || !token.trim()) return getScheduleViewPrefs(userId)
  const server = sanitizeScheduleViewPrefs(await fetchScheduleViewPrefs(token))
  const e = entry(userId)
  e.token = token.trim()
  e.prefs = { ...server, ...e.pending }
  e.serverLoaded = true
  writeCache(userId, e.prefs)
  if (server.holidayMode === undefined && e.pending.holidayMode === undefined) {
    try {
      const legacy = storage()?.getItem(LEGACY_HOLIDAY_PREFIX + userId)
      if (legacy === 'none') queueScheduleViewPrefs(userId, token, { holidayMode: 'none' })
    } catch {
      /* ignore */
    }
  }
  emit()
  return e.prefs
}

export function resetScheduleViewPrefsForTest() {
  for (const e of entries.values()) if (e.timer) clearTimeout(e.timer)
  entries.clear()
  listeners.clear()
}

/** prefs → URL 쿼리 패치(useScheduleState replaceQuery 형식). 없는 키는 건드리지 않음. */
export function scheduleViewPrefsToQuery(prefs: ScheduleViewPrefs): Record<string, string> {
  const q: Record<string, string> = {}
  if (prefs.sources) {
    const s: ScheduleFilterKey[] = prefs.sources
    q.sources = s.length === SCHEDULE_FILTER_KEYS.length ? '' : s.length === 0 ? 'none' : s.join(',')
  }
  if (prefs.includeCompleted !== undefined) q.done = prefs.includeCompleted ? '1' : ''
  if (prefs.includeOverdue !== undefined) q.overdue = prefs.includeOverdue ? '1' : ''
  if (prefs.googleCalendarIds !== undefined) q.calendars = (prefs.googleCalendarIds ?? []).join(',')
  return q
}
