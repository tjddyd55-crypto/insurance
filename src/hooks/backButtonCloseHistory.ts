/**
 * useBackButtonClose 가 history 에 심는 marker / 가드 로직 (React 없는 순수 유틸).
 */

export const UI_LAYER_STATE_KEY = '__uiLayer' as const
export const UI_LAYER_ID_STATE_KEY = '__uiLayerId' as const

export type UiLayerHistoryState = {
  [UI_LAYER_STATE_KEY]?: string
  [UI_LAYER_ID_STATE_KEY]?: string
  [key: string]: unknown
}

/** 모달 open 시 pushState 에 넣을 marker. 기존 state 는 보존한다. */
export function buildUiLayerPushState(
  existing: unknown,
  layerKind: string,
  layerId: string,
): UiLayerHistoryState {
  const base =
    existing != null && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  return {
    ...base,
    [UI_LAYER_STATE_KEY]: layerKind,
    [UI_LAYER_ID_STATE_KEY]: layerId,
  }
}

export function isOwnUiLayerTop(
  top: unknown,
  layerKind: string,
  layerId: string,
): boolean {
  if (top == null || typeof top !== 'object') {
    return false
  }
  const state = top as UiLayerHistoryState
  // 레거시: __uiLayer === layerId 만 쓰던 형식
  if (state[UI_LAYER_ID_STATE_KEY] == null && state[UI_LAYER_STATE_KEY] === layerId) {
    return true
  }
  return state[UI_LAYER_STATE_KEY] === layerKind && state[UI_LAYER_ID_STATE_KEY] === layerId
}

/**
 * X/취소·성공 닫기 cleanup: top 이 내 marker 일 때만 synthetic entry 정리 후보.
 * history.back() 은 React Router 이전 entry 로 이탈할 수 있어 쓰지 않는다.
 * marker 불일치면 정리 금지.
 */
export function shouldStripSyntheticEntryOnDismiss(params: {
  pushed: boolean
  top: unknown
  layerKind: string
  layerId: string
}): boolean {
  if (!params.pushed) {
    return false
  }
  return isOwnUiLayerTop(params.top, params.layerKind, params.layerId)
}

/** @deprecated use shouldStripSyntheticEntryOnDismiss — back() 기반 dismiss 는 SPA 이탈 위험이 있음 */
export function shouldPopSyntheticEntryOnDismiss(params: {
  pushed: boolean
  top: unknown
  layerKind: string
  layerId: string
  historyLength: number
}): boolean {
  if (params.historyLength <= 1) {
    return false
  }
  return shouldStripSyntheticEntryOnDismiss(params)
}

/** dismiss 시 marker 만 제거하고 URL/라우트는 유지 (BaseDialog closeOnHistoryBack 과 동일 전략). */
export function stripOwnUiLayerMarker(
  top: unknown,
  layerKind: string,
  layerId: string,
): Record<string, unknown> {
  const base =
    top != null && typeof top === 'object' && !Array.isArray(top)
      ? { ...(top as Record<string, unknown>) }
      : {}
  if (isOwnUiLayerTop(base, layerKind, layerId)) {
    delete base[UI_LAYER_STATE_KEY]
    delete base[UI_LAYER_ID_STATE_KEY]
  }
  return base
}

/** history top 에 UI 레이어 trap 이 있으면 네이티브 back 을 웹 history.back 에 위임한다. */
export function hasUiLayerTrapOnTop(top: unknown): boolean {
  if (top == null || typeof top !== 'object') {
    return false
  }
  const state = top as Record<string, unknown>
  return Boolean(
    state[UI_LAYER_STATE_KEY] ||
      state.__BASE_DIALOG_BACK_TRAP__ ||
      state.modal === true ||
      state.customerListExpanded === true,
  )
}
