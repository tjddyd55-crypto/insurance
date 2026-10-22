/**
 * 로컬 일정과 그 Google 미러가 같은 목록에 있으면 Google 쪽을 뺀다.
 * 로컬 항목이 목록에 없으면 Google 이벤트는 유지한다(숨겨서 0건이 되지 않게).
 * Phase 2 표시 경로(loadScheduleEvents)는 이 함수를 호출하지 않는다.
 * @param {readonly Record<string, any>[]} events
 * @param {readonly Record<string, any>[]} links
 */
export function excludeMirroredGoogleEvents(events, links) {
  const presentLocalIds = new Set(
    (events ?? [])
      .map((event) => event?.localItemId)
      .filter((id) => id != null && String(id).trim() !== '')
      .map((id) => String(id)),
  )
  const mirroredRemoteKeys = new Set()
  for (const link of links ?? []) {
    if (!isActiveCalendarLink(link)) continue
    if (!presentLocalIds.has(String(link.localId))) continue
    mirroredRemoteKeys.add(`${link.remoteContainerId}:${link.remoteId}`)
  }
  return (events ?? []).filter((event) => !isMirroredGoogleEvent(event, mirroredRemoteKeys))
}

/**
 * @param {Record<string, any>} link
 */
function isActiveCalendarLink(link) {
  return link?.provider === 'google_calendar'
    && link?.localType === 'calendar_item'
    && link?.status === 'active'
    && link?.remoteContainerId
    && link?.remoteId
    && link?.localId
}

/**
 * @param {Record<string, any>} event
 * @param {Set<string>} mirroredRemoteKeys
 */
function isMirroredGoogleEvent(event, mirroredRemoteKeys) {
  if (event?.source !== 'google') return false
  const key = `${event.calendarId ?? ''}:${event.sourceId ?? ''}`
  return mirroredRemoteKeys.has(key)
}
