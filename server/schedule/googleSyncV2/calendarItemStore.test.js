import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { OWNED_SQL } from './calendarItemSql.js'
import { createCalendarItem } from './calendarItemStore.js'
import { FIND_BY_REQUEST_SQL, INSERT_SQL } from './calendarItemSql.js'

const actor = { userId: 'user-a', gaId: 7 }

function row(id) {
  return {
    id,
    ga_id: 7,
    owner_user_id: 'user-a',
    item_type: 'schedule',
    title: '기존',
    description: '',
    all_day: true,
    start_at: null,
    end_at: null,
    start_date: '2026-10-22',
    end_date: '2026-10-23',
    timezone: 'Asia/Seoul',
    recurrence: null,
    customer_id: null,
    location: '',
    color: null,
    status: 'pending',
    origin: 'onefc',
    version: 1,
    request_id: 'req-1',
    deleted_at: null,
    created_at: '2026-10-22T00:00:00.000Z',
    updated_at: '2026-10-22T00:00:00.000Z',
    outbox_id: null,
    outbox_op: null,
    last_error_class: null,
  }
}

describe('calendar item 저장소 경계', () => {
  it('모든 쓰기·읽기 SQL 은 owner_user_id 로 현재 사용자를 다시 확인한다', () => {
    for (const sql of OWNED_SQL) {
      assert.match(sql, /owner_user_id/)
    }
    const store = readFileSync(new URL('./calendarItemStore.js', import.meta.url), 'utf8')
    const api = readFileSync(new URL('../../apis/registerCalendarItemsApi.js', import.meta.url), 'utf8')
    assert.doesNotMatch(store, /googleSendJson|googleapis|calendar\.events/)
    assert.doesNotMatch(api, /googleSendJson|googleapis/)
    assert.doesNotMatch(store, /INSERT INTO todos/)
    const index = readFileSync(new URL('../../index.js', import.meta.url), 'utf8')
    assert.match(index, /registerCalendarItemsApi\(apiRouter, \{ pool, requireAuth, handleDbError \}\)/)
  })

  it('request 고유 충돌이 나도 같은 사용자의 기존 행을 반환하고 다시 쓰지 않는다', async () => {
    let inserts = 0
    const existing = row('11111111-1111-4111-8111-111111111111')
    const gateway = {
      async transaction(task) {
        return task({
          async query(sql) {
            if (sql === FIND_BY_REQUEST_SQL) return { rows: [], rowCount: 0 }
            if (sql === INSERT_SQL) {
              inserts += 1
              const error = new Error('duplicate')
              error.code = '23505'
              throw error
            }
            throw new Error('unexpected sql')
          },
        })
      },
      async query(sql) {
        if (sql === FIND_BY_REQUEST_SQL) return { rows: [existing], rowCount: 1 }
        throw new Error('unexpected sql')
      },
    }
    const saved = await createCalendarItem(gateway, actor, {
      title: '다른 제목',
      allDay: true,
      startDate: '2026-10-22',
      requestId: 'req-1',
      ownerUserId: 'user-b',
    })
    assert.equal(inserts, 1)
    assert.equal(saved.wrote, false)
    assert.equal(saved.item.id, existing.id)
    assert.equal(saved.item.title, '기존')
    assert.equal(saved.item.ownerUserId, 'user-a')
  })

  it('충돌로 찾은 행의 소유자가 다르면 그 행을 돌려주지 않는다', async () => {
    const foreign = row('22222222-2222-4222-8222-222222222222')
    foreign.owner_user_id = 'user-b'
    const gateway = {
      async transaction(task) {
        return task({
          async query(sql) {
            if (sql === FIND_BY_REQUEST_SQL) return { rows: [], rowCount: 0 }
            if (sql === INSERT_SQL) {
              const error = new Error('duplicate')
              error.code = '23505'
              throw error
            }
            throw new Error('unexpected sql')
          },
        })
      },
      async query() {
        return { rows: [foreign], rowCount: 1 }
      },
    }
    await assert.rejects(
      () => createCalendarItem(gateway, actor, { title: '일정', allDay: true, startDate: '2026-10-22', requestId: 'req-1' }),
      (error) => error.code === '23505',
    )
  })
})
