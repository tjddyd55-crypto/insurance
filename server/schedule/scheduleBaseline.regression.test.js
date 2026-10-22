/**
 * 일정 화면 회귀 기준선(google-sync-v2 Phase 1). 운영 코드는 바꾸지 않는다.
 * 현재 loadScheduleEvents 출력(events·tasks·순서)을 fixture 로 고정한다.
 * 배지 숫자는 웹 countScheduleItemsByDate 가 같은 fixture 로 검증한다
 * (src/features/schedule/domain/scheduleBaseline.regression.test.ts).
 * 갱신: UPDATE_SCHEDULE_BASELINE=1 node --test server/schedule/scheduleBaseline.regression.test.js
 * — 기준선 변경은 표시 정책 변경이므로 사용자 승인 없이 갱신하지 않는다.
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { loadScheduleEvents } from './scheduleQuery.js'
import { normalizeGoogleCalendarEvent } from './scheduleEvents.js'

const FIXTURE = new URL('./__fixtures__/scheduleBaseline.json', import.meta.url)
const RANGE = { fromYmd: '2026-10-01', toYmd: '2026-10-31', todayYmd: '2026-10-22' }

/** CRM 쿼리만 흉내 낸다(실제 SQL 은 그대로 실행 경로를 탄다). 개인정보 없는 가짜 값. */
function fakeCrmPool() {
  return {
    async query(text) {
      const sql = String(text)
      if (sql.includes('customer_special_dates')) {
        return { rows: [{ special_date_id: 501, title: '알림 기준', memo: '', date_value: '2000-10-22', created_at: '2026-01-01', customer_id: 11, customer_name: '고객A', phone: '', assignee_name: '담당' }] }
      }
      if (sql.includes('NOT EXISTS')) return { rows: [] }
      if (sql.includes('INNER JOIN customer_cars')) {
        return { rows: [{ customer_id: 12, customer_name: '고객B', phone: '', car_id: 77, car_number: '00가0000', event_date: '2026-10-22', created_at: '2026-01-01', assignee_name: '담당' }] }
      }
      return { rows: [] } // 상령일 0
    },
  }
}

const googleEvents = [
  { id: 'gt1', summary: '일반 일정 시간', status: 'confirmed', start: { dateTime: '2026-10-22T10:00:00+09:00' }, end: { dateTime: '2026-10-22T11:00:00+09:00' } },
  { id: 'ga1', summary: '일반 일정 종일', status: 'confirmed', start: { date: '2026-10-22' }, end: { date: '2026-10-23' } },
].map((item) => normalizeGoogleCalendarEvent(item, { id: 'primary', name: '기본' }))

function todo(id, title, dueDate, status) {
  return { id, title, description: '', dueDate, dueTime: null, status, relatedEntityType: null, relatedEntityId: null, completedAt: status === 'completed' ? '2026-10-21T00:00:00Z' : null, updatedAt: '2026-10-20T00:00:00Z' }
}
const todos = [
  todo('1', '할 일 A', '2026-10-22', 'pending'),
  todo('2', '할 일 B', '2026-10-22', 'pending'),
  todo('3', '할 일 C', '2026-10-25', 'pending'),
  todo('4', '할 일 완료', '2026-10-22', 'completed'),
  todo('5', '할 일 날짜없음1', null, 'pending'),
  todo('6', '할 일 날짜없음2', null, 'pending'),
]

async function run() {
  return loadScheduleEvents(/** @type {any} */ (fakeCrmPool()), {
    userId: 'u-baseline',
    gaId: 1,
    ...RANGE,
    sources: ['google', 'google_task', 'onefc_todo', 'customer_alert', 'car_expiry', 'insurance_age'],
    viewer: { id: 'u-baseline', gaId: 1 },
    loadGoogle: async () => ({ configured: true, connected: true, status: 'ok', calendars: [], events: googleEvents }),
    loadGoogleTasks: async () => ({ status: 'ok', needsReconsent: false, taskLists: [], tasks: [] }),
    loadTodos: async () => todos,
  })
}

function snapshot(data) {
  const pick = (item, keys) => Object.fromEntries(keys.map((key) => [key, item[key] ?? null]))
  return {
    range: RANGE,
    events: data.events.map((event) => pick(event, ['id', 'source', 'type', 'title', 'startAt', 'endAt', 'allDay'])),
    tasks: data.tasks.map((task) => pick(task, ['id', 'source', 'title', 'dueDate', 'status'])),
    expectedBadge: { '2026-10-22': 6, '2026-10-25': 1 },
  }
}

describe('일정 화면 회귀 기준선 (google-sync-v2 Phase 1)', () => {
  it('일반 일정 2 · 알림 1 · 기한 1 · 미완료 날짜 할 일 3 · 완료 1 · 날짜없음 2', async () => {
    const actual = snapshot(await run())
    if (process.env.UPDATE_SCHEDULE_BASELINE === '1') writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`)
    const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'))
    assert.deepEqual(actual, expected)
    // 사람이 읽는 핵심 규칙
    assert.equal(actual.events.filter((e) => e.source === 'google').length, 2)
    assert.equal(actual.events.filter((e) => e.type === 'customer_alert').length, 1)
    assert.equal(actual.events.filter((e) => e.type === 'car_expiry').length, 1)
    assert.equal(actual.tasks.length, 6, '서버는 완료·날짜없음도 tasks 로 내려주고, 달력 제외는 클라이언트 규칙')
  })
})
