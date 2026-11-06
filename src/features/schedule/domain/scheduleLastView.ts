import type { ScheduleView } from './scheduleRange'

/** 브라우저에만 둔다. 서버 설정·DB 컬럼이 아니다. */
export const SCHEDULE_LAST_VIEW_KEY = 'onefc.schedule.lastView'

const VIEWS: readonly ScheduleView[] = ['month', 'week', 'day', 'list']

export function isScheduleView(value: string | null | undefined): value is ScheduleView {
  return VIEWS.includes(value as ScheduleView)
}

/** 라우트에 보기가 적혀 있으면 그 값, 없으면 저장값, 그래도 없으면 월간. */
export function resolveScheduleView(routeView: string | undefined, stored: ScheduleView | null): ScheduleView {
  if (isScheduleView(routeView)) return routeView
  return stored ?? 'month'
}

export function scheduleViewPath(view: ScheduleView): string {
  return view === 'month' ? '/schedule' : `/schedule/${view}`
}

export function readScheduleLastView(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): ScheduleView | null {
  try {
    const raw = storage?.getItem(SCHEDULE_LAST_VIEW_KEY)
    return isScheduleView(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeScheduleLastView(view: ScheduleView, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(SCHEDULE_LAST_VIEW_KEY, view)
  } catch {
    /* 저장소가 막혀 있으면 이번 화면만 유지 */
  }
}
