import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTodosApi } from './todosApi.js'

/**
 * GET /todos?customerId= — 고객 상세 '할 일' 탭.
 * 기존 연결(related_entity_type='customer' + related_entity_id)만 추가 조건으로 붙이고,
 * 소유자·GA·고객 가시성 조건은 그대로 유지되는지 SQL 수준에서 확인한다.
 */
function setup() {
  const queries = []
  const handlers = {}
  const apiRouter = {}
  for (const method of ['get', 'post', 'patch', 'delete']) {
    apiRouter[method] = (path, ...fns) => {
      handlers[`${method} ${path}`] = fns[fns.length - 1]
    }
  }
  registerTodosApi(apiRouter, {
    pool: {
      async query(sql, params = []) {
        queries.push({ sql: String(sql), params })
        return { rows: [], rowCount: 0 }
      },
    },
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error) => {
      throw error
    },
  })
  async function list(query) {
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
    await handlers['get /todos']({ user: { id: 'user-1', gaId: 7 }, gaId: 7, params: {}, body: {}, query }, res)
    return res
  }
  return { list, queries }
}

const listSql = (queries) => queries.find((q) => /FROM todos t/i.test(q.sql))

test('customerId 지정 시 고객 연결 조건 + 기존 소유/GA 조건 유지', async () => {
  const api = setup()
  const res = await api.list({ customerId: '42' })
  assert.equal(res.statusCode, 200)
  const q = listSql(api.queries)
  assert.ok(q, 'list query issued')
  assert.match(q.sql, /t\.related_entity_type = 'customer' AND trim\(t\.related_entity_id\) = \$\d+/)
  assert.match(q.sql, /t\.ga_id = \$1/)
  assert.match(q.sql, /t\.owner_user_id = \$2 OR t\.assignee_user_id = \$2/)
  assert.ok(q.params.includes('42'))
  assert.equal(q.params[0], 7)
  assert.equal(q.params[1], 'user-1')
})

test('customerId 미지정 시 기존 목록 쿼리 그대로(고객 조건 없음)', async () => {
  const api = setup()
  await api.list({})
  const q = listSql(api.queries)
  assert.ok(q)
  assert.doesNotMatch(q.sql, /trim\(t\.related_entity_id\) = \$/)
})

test('customerId 형식 오류는 400, 쿼리 없음', async () => {
  const api = setup()
  const res = await api.list({ customerId: '1 OR 1=1' })
  assert.equal(res.statusCode, 400)
  assert.equal(listSql(api.queries), undefined)
})
