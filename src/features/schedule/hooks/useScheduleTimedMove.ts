import { useMemo, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { updateGoogleEvent, updateOnefcSchedule, type GoogleEventInput, type ScheduleEvent } from '../api/scheduleApi'
import { eventWithTimedRange, timedRangeWriteFields, type TimedRange } from '../domain/scheduleWeekDrag'
import { formatKstDate, formatKstTime } from '../../../utils/displayDateTime'

type Draft = { startAt: string; endAt: string }

function sameClock(event: ScheduleEvent, draft: Draft): boolean {
  return formatKstDate(event.startAt) === formatKstDate(draft.startAt)
    && formatKstTime(event.startAt) === formatKstTime(draft.startAt)
    && formatKstDate(event.endAt) === formatKstDate(draft.endAt)
    && formatKstTime(event.endAt) === formatKstTime(draft.endAt)
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return '일정을 옮기지 못했습니다. 다시 시도해 주세요.'
}

/** 주간 시간 블록 저장. 화면은 바로 바꾸고, 실패하면 되돌린 뒤 알린다. */
export function useScheduleTimedMove(token: string, events: ScheduleEvent[], onReload: () => void) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [error, setError] = useState('')

  const shown = useMemo(
    () => events.map((event) => {
      const draft = drafts[event.id]
      if (!draft || sameClock(event, draft)) return event
      return { ...event, ...draft }
    }),
    [drafts, events],
  )

  const commit = async (event: ScheduleEvent, range: TimedRange) => {
    const nextEvent = eventWithTimedRange(event, range)
    setDrafts((current) => ({ ...current, [event.id]: { startAt: nextEvent.startAt, endAt: nextEvent.endAt } }))
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
      onReload()
    } catch (saveError) {
      setDrafts((current) => {
        const next = { ...current }
        delete next[event.id]
        return next
      })
      setError(messageOf(saveError))
    }
  }

  return { events: shown, commit, error }
}
