import { parseGaId } from '../../lib/parseGaId.js'
import { seoulYmd } from '../../lib/seoulCalendarDate.js'
import { loadReminderList } from '../../reminders/reminderQuery.js'

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ day?: 'today' | 'tomorrow' }} input
 */
export async function listScheduleForAssistant(pool, req, input = {}) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = parseGaId(req.user?.gaId)
  if (!userId || gaId == null) {
    return { events: [], day: input.day ?? 'today' }
  }

  let ymd = seoulYmd()
  if (input.day === 'tomorrow') {
    const dt = new Date(`${ymd}T12:00:00+09:00`)
    dt.setDate(dt.getDate() + 1)
    ymd = dt.toISOString().slice(0, 10)
  }

  const data = await loadReminderList(pool, {
    userId,
    gaId,
    fromYmd: ymd,
    toYmd: ymd,
    type: 'all',
    query: '',
    sort: 'soon',
  })

  const events = (data.events ?? []).slice(0, 25).map((ev) => ({
    id: ev.id ?? null,
    title: String(ev.title ?? ev.label ?? '').trim() || '일정',
    date: ev.date ?? ev.eventDate ?? ev.ymd ?? ymd,
    customerName: ev.customerName ?? null,
    type: ev.type ?? ev.reminderType ?? null,
  }))

  return { day: input.day ?? 'today', date: ymd, events }
}
