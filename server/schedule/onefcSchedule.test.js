import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAutoSyncEventPayload, decideAutoSyncWrite } from '../integrations/google/googleCalendarAutoSync.js'
import { normalizeGoogleCalendarEvent } from './scheduleEvents.js'
import { loadScheduleEvents } from './scheduleQuery.js'
import {
  createOnefcSchedule,
  deleteOnefcSchedule,
  parseOnefcScheduleInput,
  scheduleIdForRequest,
  scheduleRowToAutoSyncItem,
  updateOnefcSchedule,
} from './onefcSchedule.js'

const REQUEST = 'a'.repeat(32)

function memoryDb() {
  const rows = []
  return {
    rows,
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('google_calendar_sync_map')) return { rows: [], rowCount: 0 }
      if (text.includes('ON CONFLICT')) {
        if (rows.some((row) => row.id === params[0])) return { rows: [] }
        const row = {
          id: params[0],
          ga_id: params[1],
          owner_id: params[2],
          title: params[3],
          description: params[4],
          start_at: params[5],
          end_at: params[6],
          all_day: params[7],
          deleted_at: null,
        }
        rows.push(row)
        return { rows: [{ ...row }] }
      }
      if (text.includes('SET deleted_at')) {
        const row = rows.find((item) => item.id === params[0] && item.owner_id === params[1] && item.ga_id === params[2] && !item.deleted_at)
        if (!row) return { rows: [] }
        row.deleted_at = '2026-10-22T00:00:00Z'
        return { rows: [{ id: row.id }] }
      }
      if (text.includes('SET title')) {
        const row = rows.find((item) => item.id === params[0] && item.owner_id === params[1] && item.ga_id === params[2] && !item.deleted_at)
        if (!row) return { rows: [] }
        row.title = params[3]
        row.description = params[4]
        row.start_at = params[5]
        row.end_at = params[6]
        row.all_day = params[7]
        return { rows: [{ ...row }] }
      }
      if (text.includes('WHERE id = $1')) {
        const row = rows.find((item) => item.id === params[0] && item.owner_id === params[1] && item.ga_id === params[2] && !item.deleted_at)
        return { rows: row ? [{ ...row }] : [] }
      }
      return { rows: [] }
    },
  }
}

const timed = {
  title: '상담',
  description: '메모',
  date: '2026-10-22',
  endDate: '2026-10-22',
  allDay: false,
  startTime: '10:00',
  endTime: '11:00',
  requestId: REQUEST,
}

describe('ONE FC 일정 저장', () => {
  it('requestId 는 사용자별로 같은 id 를 만들고 다른 사용자는 다르다', () => {
    const first = scheduleIdForRequest('user-a', REQUEST)
    assert.equal(scheduleIdForRequest('user-a', REQUEST), first)
    assert.notEqual(scheduleIdForRequest('user-b', REQUEST), first)
    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('제목·시간 오류는 400 이다', () => {
    assert.equal(parseOnefcScheduleInput(timed).allDay, false)
    assert.throws(() => parseOnefcScheduleInput({ ...timed, title: '  ' }), (error) => error.status === 400 && error.field === 'title')
    assert.throws(() => parseOnefcScheduleInput({ ...timed, endTime: '09:00' }), (error) => error.status === 400)
    assert.throws(() => scheduleIdForRequest('user-a', 'short'), (error) => error.status === 400 && error.field === 'requestId')
  })

  it('같은 requestId 재시도는 한 행이고 다른 사용자 행은 고치지 못한다', async () => {
    const db = memoryDb()
    const scope = { userId: 'user-a', gaId: 7 }
    const created = await createOnefcSchedule(db, scope, timed)
    const again = await createOnefcSchedule(db, scope, { ...timed, title: '다른 제목' })
    assert.equal(created.duplicate, false)
    assert.equal(again.duplicate, true)
    assert.equal(again.row.id, created.row.id)
    assert.equal(again.row.title, '상담')
    assert.equal(db.rows.length, 1)
    await assert.rejects(
      updateOnefcSchedule(db, { userId: 'user-b', gaId: 7, id: created.row.id }, timed),
      (error) => error.status === 404,
    )
    await assert.rejects(
      deleteOnefcSchedule(db, { userId: 'user-b', gaId: 7, id: created.row.id }),
      (error) => error.status === 404,
    )
    const removed = await deleteOnefcSchedule(db, { ...scope, id: created.row.id })
    assert.equal(removed.id, created.row.id)
    assert.equal(db.rows[0].deleted_at != null, true)
  })
})

describe('ONE FC 일정 Google 사본', () => {
  it('시간 일정은 dateTime 과 onefcAutoSync 태그를 쓰고, 시각이 바뀌면 같은 id 로 고친다', () => {
    const item = scheduleRowToAutoSyncItem({
      id: '11111111-1111-4111-8111-111111111111',
      title: '상담',
      description: '메모',
      all_day: false,
      start_at: '2026-10-22T10:00:00+09:00',
      end_at: '2026-10-22T11:00:00+09:00',
    })
    const payload = buildAutoSyncEventPayload(item, { ownerTag: 'owner' })
    assert.equal(payload.summary, '상담')
    assert.equal(payload.start.dateTime, '2026-10-22T10:00:00+09:00')
    assert.equal(payload.extendedProperties.private.app, 'onefcAutoSync')
    assert.equal(payload.extendedProperties.private.kind, 'schedule')
    const decision = decideAutoSyncWrite(undefined, item)
    const same = decideAutoSyncWrite({ status: 'active', content_hash: decision.hash, google_event_id: 'evt-1' }, item)
    assert.equal(same.action, 'skip')
    assert.equal(same.eventId, 'evt-1')
    const moved = decideAutoSyncWrite(
      { status: 'active', content_hash: decision.hash, google_event_id: 'evt-1' },
      { ...item, startTime: '12:00', endTime: '13:00' },
    )
    assert.equal(moved.action, 'update')
    assert.equal(moved.eventId, 'evt-1')
  })

  it('화면에는 로컬 일정 1건만 있고 Google 사본은 숨긴다', async () => {
    const hidden = normalizeGoogleCalendarEvent({
      id: 'onefcasabc',
      status: 'confirmed',
      summary: '상담',
      start: { dateTime: '2026-10-22T10:00:00+09:00' },
      end: { dateTime: '2026-10-22T11:00:00+09:00' },
      extendedProperties: { private: { app: 'onefcAutoSync' } },
    }, { id: 'primary', name: '기본' })
    assert.equal(hidden, null)
    const data = await loadScheduleEvents({
      async query(sql) {
        if (String(sql).includes('FROM calendar_items')) {
          return {
            rows: [{
              id: '11111111-1111-4111-8111-111111111111',
              title: '상담',
              description: '메모',
              all_day: false,
              start_at: '2026-10-22T10:00:00+09:00',
              end_at: '2026-10-22T11:00:00+09:00',
            }],
          }
        }
        return { rows: [] }
      },
    }, {
      userId: 'user-a',
      gaId: 7,
      fromYmd: '2026-10-01',
      toYmd: '2026-10-31',
      todayYmd: '2026-10-22',
      sources: ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'],
      viewer: { id: 'user-a', gaId: 7 },
      loadGoogle: async () => ({ configured: true, connected: true, status: 'ok', calendars: [], events: [] }),
      loadGoogleTasks: async () => ({ status: 'ok', needsReconsent: false, taskLists: [], tasks: [] }),
      loadTodos: async () => [],
    })
    const locals = data.events.filter((event) => event.origin === 'onefc')
    assert.equal(locals.length, 1)
    assert.equal(data.events.length, 1)
    assert.equal(locals[0].source, 'google')
    assert.equal(locals[0].startAt, '2026-10-22T10:00:00+09:00')
    assert.equal(locals[0].calendarName, 'ONE FC')
  })
})
