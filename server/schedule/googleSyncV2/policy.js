/**
 * google-sync-v2 승인 결정. 표시 경로를 바꾸지 않고, 이후 Phase 가 여기만 보게 한다.
 * 1. 연결 해제 시 Google 에서 가져온 항목도 로컬에 남긴다.
 * 2. 만기·상령일·알림일 Calendar 사본(t321)은 유지한다.
 * 3. ONE FC 일정은 새 필터 키를 만들지 않고 기존 'google' 칸에 둔다.
 * 4. import 는 화면에 선택된 캘린더만. 선택이 없으면 전체를 가져오지 않는다.
 * 5. 위젯 빠른 추가는 종일 일정이다.
 */

export const LOCAL_EVENT_FILTER_KEY = 'google'

export const ALERT_COPY_KINDS_KEPT = Object.freeze([
  'car_expiry',
  'insurance_age_date',
  'special_date',
])

export const WIDGET_QUICK_ADD_ALL_DAY = true

export const GOOGLE_SYNC_V2_DECISIONS = Object.freeze({
  disconnectKeepsImportedItems: true,
  keepAlertCalendarCopies: true,
  localEventFilterKey: LOCAL_EVENT_FILTER_KEY,
  importCalendarSelection: 'screen_selected_only',
  widgetQuickAddAllDay: WIDGET_QUICK_ADD_ALL_DAY,
})

/** 연결 해제는 로컬 calendar_items 를 지우지 않는다. */
export function disconnectRemovesLocalItems() {
  return false
}

/**
 * @param {readonly { origin?: string }[]} items
 */
export function itemsRetainedOnDisconnect(items) {
  return [...(items ?? [])]
}

/**
 * 화면에 선택된 캘린더만 import 대상이다. 빈 선택은 전체 가져오기가 아니다.
 * 기존 live read(선택 없을 때 defaultVisible)와는 별개이며, 그 표시 경로는 바꾸지 않는다.
 * @param {readonly { id?: string }[]} calendars
 * @param {readonly string[]} selectedIds
 */
export function calendarsToImport(calendars, selectedIds) {
  const selected = new Set(
    (selectedIds ?? []).map((id) => String(id).trim()).filter(Boolean),
  )
  if (selected.size === 0) return []
  return (calendars ?? []).filter((calendar) => selected.has(String(calendar?.id ?? '')))
}
