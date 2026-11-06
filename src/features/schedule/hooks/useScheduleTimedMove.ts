import { useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { updateGoogleEvent, updateOnefcSchedule, type GoogleEventInput, type ScheduleEvent } from '../api/scheduleApi'
import { eventWithTimedRange, timedRangeWriteFields, type TimedRange } from '../domain/scheduleWeekDrag'

type Draft = {
  startAt: string
  endAt: string
  /** 저장이 끝난 뒤, 이 목록이 바뀌기 전까지만 낙관적 시각을 유지한다. 저장 중에는 null. */
  cover: ScheduleEvent[] | null
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return '일정을 옮기지 못했습니다. 다시 시도해 주세요.'
}

function withoutDraft(current: Record<string, Draft>, id: string): Record<string, Draft> {
  if (!current[id]) return current
  const next = { ...current }
  delete next[id]
  return next
}

/**
 * 주간 시간 블록 저장.
 * 요청 중과, 그 요청의 재조회가 오기 전까지만 화면을 덮는다.
 * 재조회·모달 저장·동기화가 새 목록을 주면 그 값이 이긴다.
 */
export function useScheduleTimedMove(token: string, events: ScheduleEvent[], onReload: () => void) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [error, setError] = useState('')
  const staleIds = Object.entries(drafts)
    .filter(([, draft]) => draft.cover !== null && draft.cover !== events)
    .map(([id]) => id)
  if (staleIds.length > 0) {
    setDrafts((current) => {
      let next = current
      for (const id of staleIds) {
        const draft = next[id]
        if (draft?.cover !== null && draft.cover !== events) next = withoutDraft(next, id)
      }
      return next
    })
  }

  const shown = events.map((event) => {
    const draft = drafts[event.id]
    if (!draft || staleIds.includes(event.id)) return event
    return { ...event, startAt: draft.startAt, endAt: draft.endAt }
  })

  const commit = async (event: ScheduleEvent, range: TimedRange) => {
    const nextEvent = eventWithTimedRange(event, range)
    const times = { startAt: nextEvent.startAt, endAt: nextEvent.endAt }
    setDrafts((current) => ({ ...current, [event.id]: { ...times, cover: null } }))
    setError('')
    const input: GoogleEventInput = {
      calendarId: event.calendarId ?? '',
      title: event.title,
      description: event.description,
      ...timedRangeWriteFields(range),
    }
    try {
      if (event.origin === 'onefc') await updateOnefcSchedule(token, event.sourceId, input)
      else await updateGoogleEvent(token, { ...input, eventId: event.sourceId })
      setDrafts((current) => {
        const existing = current[event.id]
        if (!existing || existing.startAt !== times.startAt || existing.endAt !== times.endAt) return current
        return { ...current, [event.id]: { ...existing, cover: events } }
      })
      onReload()
    } catch (saveError) {
      setDrafts((current) => {
        const existing = current[event.id]
        if (existing && (existing.startAt !== times.startAt || existing.endAt !== times.endAt)) return current
        return withoutDraft(current, event.id)
      })
      setError(messageOf(saveError))
    }
  }

  return { events: shown, commit, error }
}
