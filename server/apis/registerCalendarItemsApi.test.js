import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPgGateway } from '../schedule/googleSyncV2/calendarItemGateway.js'
import { createMemoryCalendarDb } from '../schedule/googleSyncV2/memoryCalendarDb.js'
import { ENQUEUE_OUTBOX_SQL } from '../schedule/googleSyncV2/calendarItemSql.js'
import { registerCalendarItemsApi } from './registerCalendarItemsApi.js'

const DEV = { NODE_ENV: 'test', RAILWAY_ENVIRONMENT: 'development', ONEFC_GOOGLE_SYNC_V2: 'true' }
const USER = { id: 'user-a', gaId: 7 }

function setup(env = DEV, options = {}) {
  const db = createMemoryCalendarDb()
  const gateway = createPgGateway(db)
  let queries = 0
  const counting = {
    async query(sql, params) {
      queries += 1
      return gateway.query(sql, params)
    },
    transaction: (task) => gateway.transaction(async (tx) => {
      const original = tx.query.bind(tx)
      tx.query = async (sql, params) => {
        queries += 1
        if (options.failEnqueue && sql === ENQUEUE_OUTBOX_SQL) {
          const error = new Error('sync_outbox_enqueue_failed')
          error.code = 'sync_outbox_enqueue_failed'
          throw error
        }
        return original(sql, params)
      }
      return task(tx)
    }),
  }
  const handlers = {}
  const apiRouter = {}
  for (const method of ['get', 'post', 'patch', 'delete']) {
    apiRouter[method] = (path, ...fns) => {
      handlers[`${method} ${path}`] = fns.at(-1)
    }
  }
  registerCalendarItemsApi(apiRouter, {
    gateway: counting,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error, _req, res) => {
      res.status(500).json({ success: false, code: error.code || 'db_error' })
    },
    env,
    assertCustomerAccessible: options.assertCustomerAccessible ?? (async () => true),
    pushGoogle: options.pushGoogle,
  })

  async function call(method, path, { user = USER, params = {}, body = {}, query = {} } = {}) {
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
        return this
      },
    }
    await handlers[`${method} ${path}`]({ user, params, body, query, gaId: user?.gaId }, res)
    return res
  }

  return { db, call, queryCount: () => queries }
}

function allDay(title, extra = {}) {
  return { title, allDay: true, startDate: '2026-10-22', ...extra }
}

describe('/api/calendar-items', () => {
  it('플래그가 꺼져 있거나 운영이면 저장소를 건드리지 않고 404', async () => {
    const off = setup({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT: 'development' })
    const prod = setup({ NODE_ENV: 'production', ONEFC_GOOGLE_SYNC_V2: 'true' })
    assert.equal((await off.call('post', '/calendar-items', { body: allDay('일정') })).statusCode, 404)
    assert.equal((await prod.call('get', '/calendar-items', { query: { from: '2026-10-01', to: '2026-10-31' } })).statusCode, 404)
    assert.equal(off.queryCount(), 0)
    assert.equal(prod.queryCount(), 0)
    assert.equal(off.db.state.items.length, 0)
  })

  it('Railway development + NODE_ENV=production 에서는 플래그를 켤 수 있다', async () => {
    const api = setup({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT: 'development', ONEFC_GOOGLE_SYNC_V2: 'true' })
    const created = await api.call('post', '/calendar-items', { body: allDay('개발 일정') })
    assert.equal(created.statusCode, 201)
    assert.equal(created.body.data.item.title, '개발 일정')
  })

  it('로그인 사용자만 만들고, 본문의 소유자·GA 는 무시한다', async () => {
    const api = setup()
    const anon = await api.call('post', '/calendar-items', { user: null, body: allDay('일정') })
    assert.equal(anon.statusCode, 401)
    const created = await api.call('post', '/calendar-items', {
      body: allDay('내 일정', { ownerUserId: 'user-b', gaId: 99, origin: 'google_import' }),
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.body.success, true)
    assert.equal(created.body.data.idempotent, false)
    assert.equal(created.body.data.item.ownerUserId, 'user-a')
    assert.equal(created.body.data.item.gaId, 7)
    assert.equal(created.body.data.item.origin, 'onefc')
    assert.equal(created.body.data.item.allDay, true)
    assert.equal(created.body.data.item.endDate, '2026-10-23')
    assert.equal(created.body.data.item.sync.queued, true)
    assert.equal(created.body.data.item.sync.op, 'upsert')
    assert.equal(api.db.state.outbox.length, 1)
    assert.equal(api.db.state.outbox[0].local_version, 1)
  })

  it('같은 requestId 는 한 행·한 outbox 이고 다른 사용자는 따로 저장한다', async () => {
    const api = setup()
    const first = await api.call('post', '/calendar-items', { body: allDay('원본', { requestId: 'req-1' }) })
    const replay = await api.call('post', '/calendar-items', { body: allDay('바뀐 제목', { requestId: 'req-1' }) })
    const other = await api.call('post', '/calendar-items', {
      user: { id: 'user-b', gaId: 7 },
      body: allDay('다른 사람', { requestId: 'req-1' }),
    })
    assert.equal(replay.statusCode, 200)
    assert.equal(replay.body.data.idempotent, true)
    assert.equal(replay.body.data.item.id, first.body.data.item.id)
    assert.equal(replay.body.data.item.title, '원본')
    assert.equal(other.statusCode, 201)
    assert.notEqual(other.body.data.item.id, first.body.data.item.id)
    assert.equal(api.db.state.items.length, 2)
    assert.equal(api.db.state.outbox.length, 2)
  })

  it('다른 사용자·다른 GA 는 조회·수정·삭제할 수 없다', async () => {
    const api = setup()
    const created = await api.call('post', '/calendar-items', { body: allDay('비밀') })
    const id = created.body.data.item.id
    const outsider = { id: 'user-b', gaId: 7 }
    const otherGa = { id: 'user-a', gaId: 8 }
    for (const user of [outsider, otherGa]) {
      assert.equal((await api.call('get', '/calendar-items/:id', { user, params: { id } })).statusCode, 404)
      assert.equal((await api.call('patch', '/calendar-items/:id', { user, params: { id }, body: { title: '탈취' } })).statusCode, 404)
      assert.equal((await api.call('delete', '/calendar-items/:id', { user, params: { id } })).statusCode, 404)
    }
    assert.equal(api.db.state.items[0].title, '비밀')
    assert.equal(api.db.state.items[0].deleted_at, null)
    assert.equal(api.db.state.outbox.length, 1)
    assert.equal(api.db.state.outbox[0].op, 'upsert')
  })

  it('수정은 같은 outbox 행을 최신 버전으로 맞추고, 값이 같으면 다시 쓰지 않는다', async () => {
    const api = setup()
    const created = await api.call('post', '/calendar-items', { body: allDay('제목') })
    const id = created.body.data.item.id
    const same = await api.call('patch', '/calendar-items/:id', { params: { id }, body: { title: '제목' } })
    assert.equal(same.body.data.idempotent, true)
    assert.equal(same.body.data.item.version, 1)
    assert.equal(api.db.state.outbox[0].local_version, 1)
    const renamed = await api.call('patch', '/calendar-items/:id', { params: { id }, body: { title: '바꾼 제목' } })
    assert.equal(renamed.statusCode, 200)
    assert.equal(renamed.body.data.item.version, 2)
    assert.equal(api.db.state.outbox.length, 1)
    assert.equal(api.db.state.outbox[0].op, 'upsert')
    assert.equal(api.db.state.outbox[0].local_version, 2)
  })

  it('삭제는 소프트 삭제와 outbox delete 를 같은 트랜잭션에서 남긴다', async () => {
    const api = setup()
    const created = await api.call('post', '/calendar-items', { body: allDay('지울 일정') })
    const id = created.body.data.item.id
    const removed = await api.call('delete', '/calendar-items/:id', { params: { id } })
    assert.equal(removed.statusCode, 200)
    assert.equal(removed.body.data.item.deletedAt != null, true)
    assert.equal(removed.body.data.item.status, 'cancelled')
    assert.equal(api.db.state.outbox.length, 1)
    assert.equal(api.db.state.outbox[0].op, 'delete')
    assert.equal(api.db.state.outbox[0].local_version, 2)
    const listed = await api.call('get', '/calendar-items', { query: { from: '2026-10-01', to: '2026-10-31' } })
    assert.deepEqual(listed.body.data.items, [])
    assert.equal((await api.call('get', '/calendar-items/:id', { params: { id } })).statusCode, 404)
  })

  it('할 일은 calendar_items 에 만들지 않는다', async () => {
    const api = setup()
    const response = await api.call('post', '/calendar-items', { body: { ...allDay('할일'), itemType: 'todo' } })
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.code, 'todo_uses_todos_table')
    assert.equal(api.db.state.items.length, 0)
    assert.equal(api.db.state.outbox.length, 0)
  })

  it('outbox 실패는 로컬 행도 롤백하고, Google 실패는 로컬 행을 남긴다', async () => {
    const rolled = setup(DEV, { failEnqueue: true })
    const failed = await rolled.call('post', '/calendar-items', { body: allDay('롤백') })
    assert.equal(failed.statusCode, 500)
    assert.equal(rolled.db.state.items.length, 0)
    assert.equal(rolled.db.state.outbox.length, 0)

    const token = 'ya29.SECRETTOKEN'
    const pushed = setup(DEV, {
      pushGoogle: async () => {
        const error = new Error(`bearer ${token}`)
        error.code = 'network'
        throw error
      },
    })
    const created = await pushed.call('post', '/calendar-items', { body: allDay('로컬 유지') })
    assert.equal(created.statusCode, 201)
    assert.equal(created.body.data.item.sync.lastErrorClass, 'network')
    assert.equal(JSON.stringify(created.body).includes(token), false)
    assert.equal(pushed.db.state.items.length, 1)
    assert.equal(pushed.db.state.items[0].title, '로컬 유지')
    assert.equal(pushed.db.state.outbox.length, 1)
    assert.equal(pushed.db.state.outbox[0].last_error_class, 'network')
    assert.equal(pushed.db.state.outbox[0].last_error, null)
  })

  it('조회는 내 일정만, 기간에 걸친 것만 돌려준다', async () => {
    const api = setup()
    await api.call('post', '/calendar-items', { body: allDay('10월 종일') })
    await api.call('post', '/calendar-items', {
      body: { title: '10월 시간', allDay: false, startAt: '2026-10-22T10:00:00+09:00', endAt: '2026-10-22T11:00:00+09:00' },
    })
    await api.call('post', '/calendar-items', { body: { title: '11월', allDay: true, startDate: '2026-11-02' } })
    await api.call('post', '/calendar-items', { user: { id: 'user-b', gaId: 7 }, body: allDay('남의 일정') })
    const october = await api.call('get', '/calendar-items', { query: { from: '2026-10-01', to: '2026-10-31' } })
    assert.deepEqual(october.body.data.items.map((item) => item.title), ['10월 종일', '10월 시간'])
    const dayAfter = await api.call('get', '/calendar-items', { query: { from: '2026-10-23', to: '2026-10-23' } })
    assert.deepEqual(dayAfter.body.data.items, [])
    const wide = await api.call('get', '/calendar-items', { query: { from: '2026-01-01', to: '2027-06-01' } })
    assert.equal(wide.statusCode, 400)
    assert.equal(wide.body.code, 'range_too_wide')
  })

  it('볼 수 없는 고객으로는 연결하지 않는다', async () => {
    const api = setup(DEV, { assertCustomerAccessible: async () => false })
    const response = await api.call('post', '/calendar-items', { body: allDay('고객 일정', { customerId: 15 }) })
    assert.equal(response.statusCode, 403)
    assert.equal(response.body.code, 'customer_forbidden')
    assert.equal(api.db.state.items.length, 0)
  })
})
