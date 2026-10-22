import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { loadScheduleEvents } from '../scheduleQuery.js'
import { normalizeGoogleCalendarEvent } from '../scheduleEvents.js'

const FIXTURE = new URL('../__fixtures__/scheduleBaseline.json', import.meta.url)
const RANGE = { fromYmd: '2026-10-01', toYmd: '2026-10-31', todayYmd: '2026-10-22' }

function fakeCrmPool(sqls) {
  return {
    async query(text) {
      const sql = String(text)
      sqls.push(sql)
      if (sql.includes('customer_special_dates')) {
        return { rows: [{ special_date_id: 501, title: '알림 기준', memo: '', date_value: '2000-10-22', created_at: '2026-01-01', customer_id: 11, customer_name: '고객A', phone: '', assignee_name: '담당' }] }
      }
      if (sql.includes('NOT EXISTS')) return { rows: [] }
      if (sql.includes('INNER JOIN customer_cars')) {
        return { rows: [{ customer_id: 12, customer_name: '고객B', phone: '', car_id: 77, car_number: '00가0000', event_date: '2026-10-22', created_at: '2026-01-01', assignee_name: '담당' }] }
      }
      return { rows: [] }
    },
  }
}

function todo(id, title, dueDate, status) {
  return { id, title, description: '', dueDate, dueTime: null, status, relatedEntityType: null, relatedEntityId: null, completedAt: status === 'completed' ? '2026-10-21T00:00:00Z' : null, updatedAt: '2026-10-20T00:00:00Z' }
}

describe('일정 표시 경로는 Phase 2 에서 그대로다', () => {
  it('loadScheduleEvents 는 로컬 동기화 테이블을 읽지 않고 기준선과 같다', async () => {
    const source = readFileSync(new URL('../scheduleQuery.js', import.meta.url), 'utf8')
    assert.equal(source.includes('calendar_items'), false)
    assert.equal(source.includes('sync_outbox'), false)
    assert.equal(source.includes('excludeMirroredGoogleEvents'), false)
    assert.equal(source.includes('ONEFC_GOOGLE_SYNC_V2'), false)

    const sqls = []
    const googleEvents = [
      { id: 'gt1', summary: '일반 일정 시간', status: 'confirmed', start: { dateTime: '2026-10-22T10:00:00+09:00' }, end: { dateTime: '2026-10-22T11:00:00+09:00' } },
      { id: 'ga1', summary: '일반 일정 종일', status: 'confirmed', start: { date: '2026-10-22' }, end: { date: '2026-10-23' } },
    ].map((item) => normalizeGoogleCalendarEvent(item, { id: 'primary', name: '기본' }))
    const data = await loadScheduleEvents(fakeCrmPool(sqls), {
      userId: 'u-baseline',
      gaId: 1,
      ...RANGE,
      sources: ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'],
      viewer: { id: 'u-baseline', gaId: 1 },
      loadGoogle: async () => ({ configured: true, connected: true, status: 'ok', calendars: [], events: googleEvents }),
      loadGoogleTasks: async () => ({ status: 'ok', needsReconsent: false, taskLists: [], tasks: [] }),
      loadTodos: async () => [
        todo('1', '할 일 A', '2026-10-22', 'pending'),
        todo('2', '할 일 B', '2026-10-22', 'pending'),
        todo('3', '할 일 C', '2026-10-25', 'pending'),
        todo('4', '할 일 완료', '2026-10-22', 'completed'),
        todo('5', '할 일 날짜없음1', null, 'pending'),
        todo('6', '할 일 날짜없음2', null, 'pending'),
      ],
    })
    const joined = sqls.join('\n')
    assert.equal(joined.includes('calendar_items'), false)
    assert.equal(joined.includes('sync_outbox'), false)
    assert.equal(joined.includes('external_sync_links'), false)

    const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    const pick = (item, keys) => Object.fromEntries(keys.map((key) => [key, item[key] ?? null]))
    const actual = {
      range: RANGE,
      events: data.events.map((event) => pick(event, ['id', 'source', 'type', 'title', 'startAt', 'endAt', 'allDay'])),
      tasks: data.tasks.map((task) => pick(task, ['id', 'source', 'title', 'dueDate', 'status'])),
      expectedBadge: expected.expectedBadge,
    }
    assert.deepEqual(actual, expected)
    assert.equal(actual.events.filter((event) => event.source === 'google').length, 2)
    assert.equal(actual.expectedBadge['2026-10-22'], 6)
    assert.equal(actual.expectedBadge['2026-10-25'], 1)
  })
})
