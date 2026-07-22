/**
 * 프로그램 setCenter/setZoom 직후 idle 처리 계약.
 * viewport 피드백과 bounds sync 를 분리한다.
 */

export type MapIdleSyncAction = 'viewport_and_bounds' | 'bounds_only' | 'skip'

/**
 * skipCenterSync=true (프로그램 이동 중) 이면 viewport state 피드백만 막고
 * bounds idle 은 계속 수행한다. drag idle 은 둘 다 수행.
 */
export function resolveMapIdleSyncAction(skipCenterSync: boolean): MapIdleSyncAction {
  return skipCenterSync ? 'bounds_only' : 'viewport_and_bounds'
}
