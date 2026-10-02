import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTodosApi } from './todosApi.js'

/**
 * 할 일 PATCH no-op 저장 회귀 테스트.
 * 실제 저장값이 바뀔 때만 UPDATE + updated_at 갱신, 같으면 UPDATE 없이 기존 행을 돌려준다.
 */

const USER_ID = 'user-1'
const GA_ID = 7

function createFakeDb(seedRows) {
  let clock = Date.parse('2026-10-02T00:00:00.000Z')
  const tick = () => {
    clock += 60_000
    return new Date(clock)
  }
  const rows = new Map(seedRows.map((row) => [String(row.id), { ...row }]))
  const updates = []
  let nextId = 1000

  function applySet(row, setSql, params) {
    for (const part of setSql.split(/,(?![^(]*\))/)) {
      const m = part.trim().match(/^(\w+)\s*=\s*(.+)$/)
      assert.ok(m, `unparsed SET part: ${part}`)
      const [, col, rhs] = m
      if (rhs === 'NULL') row[col] = null
      else if (rhs === 'NOW()') row[col] = tick()
      else {
        const pm = rhs.match(/^\$(\d+)/)
        assert.ok(pm, `unparsed SET value: ${rhs}`)
        const v = params[Number(pm[1]) - 1]
        row[col] = rhs.includes('::jsonb') ? JSON.parse(String(v)) : rhs.includes('::time') ? `${v}:00` : v
      }
    }
  }

  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/^\s*SELECT \*\s+FROM todos/i.test(text)) {
        const row = rows.get(String(params[0]))
        return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 }
      }
      if (/^\s*UPDATE todos/i.test(text)) {
        const setSql = text.match(/SET([\s\S]+?)WHERE/i)[1]
        const idIdx = Number(text.match(/WHERE id = \$(\d+)/)[1])
        const row = rows.get(String(params[idIdx - 1]))
        updates.push({ id: String(params[idIdx - 1]), setSql: setSql.trim() })
        if (row) applySet(row, setSql, params)
        return { rows: [], rowCount: row ? 1 : 0 }
      }
      if (/^\s*INSERT INTO todos/i.test(text)) {
        const now = tick()
        const row = {
          id: String(nextId++),
          tenant_id: params[0],
          ga_id: params[1],
          owner_user_id: params[2],
          assignee_user_id: params[3],
          title: params[4],
          description: params[5],
          due_date: params[6],
          due_time: params[7],
          status: 'pending',
          priority: params[8],
          source_type: params[9],
          source_id: params[10],
          related_entity_type: params[11],
          related_entity_id: params[12],
          metadata: JSON.parse(params[13]),
          created_at: now,
          updated_at: now,
          completed_at: null,
          canceled_at: null,
        }
        rows.set(row.id, row)
        return { rows: [{ ...row }], rowCount: 1 }
      }
      if (/FROM todos t/i.test(text)) {
        return { rows: [...rows.values()].map((row) => ({ ...row })), rowCount: rows.size }
      }
      throw new Error(`unexpected SQL in fake pool: ${text.slice(0, 120)}`)
    },
  }
  return { pool, rows, updates }
}

function todoRow(id, title, minutesAgo, extra = {}) {
  const at = new Date(Date.parse('2026-10-01T00:00:00.000Z') - minutesAgo * 60_000)
  return {
    id,
    tenant_id: null,
    ga_id: GA_ID,
    owner_user_id: USER_ID,
    assignee_user_id: USER_ID,
    title,
    description: title,
    due_date: null,
    due_time: null,
    status: 'pending',
    priority: 'normal',
    source_type: 'manual',
    source_id: null,
    related_entity_type: null,
    related_entity_id: null,
    metadata: {},
    created_at: at,
    updated_at: at,
    completed_at: null,
    canceled_at: null,
    ...extra,
  }
}

function setupApi(seedRows) {
  const db = createFakeDb(seedRows)
  const handlers = {}
  const apiRouter = {}
  for (const method of ['get', 'post', 'patch', 'delete']) {
    apiRouter[method] = (path, ...fns) => {
      handlers[`${method} ${path}`] = fns[fns.length - 1]
    }
  }
  registerTodosApi(apiRouter, {
    pool: db.pool,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error) => {
      throw error
    },
  })

  async function call(key, { params = {}, body = {}, query = {} } = {}) {
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
      end() {
        return this
      },
    }
    const req = { user: { id: USER_ID, gaId: GA_ID }, gaId: GA_ID, params, body, query }
    await handlers[key](req, res)
    return res
  }

  return {
    db,
    patch: (id, body) => call('patch /todos/:todoId', { params: { todoId: id }, body }),
    create: (body) => call('post /todos', { body }),
    list: () => call('get /todos', { query: { bucket: 'open' } }),
  }
}

/** 웹 TodoEditorDialog / 네이티브 TodoFormScreen 수정 저장과 같은 본문 */
function editorBody(content, dueDate = null) {
  return {
    title: content.split(/\r?\n/).find((l) => l.trim())?.trim().slice(0, 40) || '할일',
    description: content,
    dueDate,
    dueTime: null,
    priority: 'normal',
    relatedEntityType: null,
    relatedEntityId: null,
  }
}

/** 클라이언트 기본 정렬과 같은 기준: max(createdAt, updatedAt) DESC, id DESC */
function orderIds(rows) {
  const ms = (r) => Math.max(Date.parse(r.createdAt ?? '') || -Infinity, Date.parse(r.updatedAt ?? '') || -Infinity)
  return [...rows].sort((a, b) => ms(b) - ms(a) || b.id.localeCompare(a.id)).map((r) => r.id)
}

const seed = () => [todoRow('1', 'A 최근', 10), todoRow('2', 'B 중간', 20), todoRow('3', 'C 오래됨', 30)]

test('A: 같은 값으로 저장하면 UPDATE 없이 updatedAt·순서 유지', async () => {
  const api = setupApi(seed())
  const before = (await api.list()).body
  const prevUpdatedAt = before.find((r) => r.id === '3').updatedAt
  const res = await api.patch('3', editorBody('C 오래됨'))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.updatedAt, prevUpdatedAt)
  assert.equal(api.db.updates.length, 0)
  assert.deepEqual(orderIds((await api.list()).body), ['1', '2', '3'])
})

test('B: 제목(첫 줄) 실제 변경이면 updatedAt 증가, 맨 위로', async () => {
  const api = setupApi(seed())
  const prevUpdatedAt = (await api.list()).body.find((r) => r.id === '3').updatedAt
  const res = await api.patch('3', editorBody('보험 갱신 상담'))
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.title, '보험 갱신 상담')
  assert.ok(Date.parse(res.body.updatedAt) > Date.parse(prevUpdatedAt))
  assert.equal(api.db.updates.length, 1)
  assert.match(api.db.updates[0].setSql, /updated_at = NOW\(\)/)
  assert.deepEqual(orderIds((await api.list()).body), ['3', '1', '2'])
})

test('C: A→C→A로 되돌린 뒤 저장(원래 값)은 no-op', async () => {
  const api = setupApi(seed())
  const prevUpdatedAt = (await api.list()).body.find((r) => r.id === '3').updatedAt
  // 편집 중 바뀌었다가 원래 값으로 돌아온 최종 본문만 서버로 간다.
  const res = await api.patch('3', editorBody('C 오래됨'))
  assert.equal(res.body.updatedAt, prevUpdatedAt)
  assert.equal(api.db.updates.length, 0)
  assert.deepEqual(orderIds((await api.list()).body), ['1', '2', '3'])
})

test('D: 메모(내용) 실제 변경이면 최신', async () => {
  const api = setupApi(seed())
  const res = await api.patch('3', editorBody('C 오래됨\n메모 추가'))
  assert.equal(res.body.title, 'C 오래됨')
  assert.equal(res.body.description, 'C 오래됨\n메모 추가')
  assert.equal(api.db.updates.length, 1)
  assert.deepEqual(orderIds((await api.list()).body), ['3', '1', '2'])
})

test('E: 마감일 실제 변경이면 최신, 같은 마감일 재저장은 no-op', async () => {
  const api = setupApi([todoRow('1', 'A 최근', 10), todoRow('2', 'B 중간', 20, { due_date: new Date('2026-10-05T00:00:00+09:00') })])
  const same = await api.patch('2', editorBody('B 중간', '2026-10-05'))
  assert.equal(same.body.dueDate, '2026-10-05')
  assert.equal(api.db.updates.length, 0)
  assert.deepEqual(orderIds((await api.list()).body), ['1', '2'])

  const changed = await api.patch('2', editorBody('B 중간', '2026-10-20'))
  assert.equal(changed.body.dueDate, '2026-10-20')
  assert.equal(api.db.updates.length, 1)
  assert.deepEqual(orderIds((await api.list()).body), ['2', '1'])
})

test('F: 신규 생성은 맨 위', async () => {
  const api = setupApi(seed())
  const res = await api.create({ title: 'D 신규', description: 'D 신규', dueDate: null, priority: 'normal' })
  assert.equal(res.statusCode, 201)
  assert.deepEqual(orderIds((await api.list()).body), [res.body.id, '1', '2', '3'])
})

test('G: no-op 저장을 반복하고 다시 조회해도 저장된 timestamp·순서 그대로', async () => {
  const api = setupApi(seed())
  const before = (await api.list()).body
  await api.patch('3', editorBody('C 오래됨'))
  await api.patch('3', editorBody('C 오래됨'))
  const after = (await api.list()).body
  assert.equal(api.db.updates.length, 0)
  assert.deepEqual(
    after.map((r) => [r.id, r.updatedAt]),
    before.map((r) => [r.id, r.updatedAt]),
  )
  assert.deepEqual(orderIds(after), ['1', '2', '3'])
  // 실제 수정 후 다시 no-op 저장해도 추가 변경 없음
  const edited = await api.patch('3', editorBody('C 수정'))
  const again = await api.patch('3', editorBody('C 수정'))
  assert.equal(again.body.updatedAt, edited.body.updatedAt)
  assert.equal(api.db.updates.length, 1)
})

test('표현만 다른 값(dueTime 초 단위, 마감일 공백, null/빈 문자열, metadata 키 순서)은 변경 아님', async () => {
  const api = setupApi([
    todoRow('5', '보험 상담', 5, {
      due_date: new Date('2026-10-05T00:00:00+09:00'),
      due_time: '09:30:00',
      metadata: { b: 2, a: 1 },
    }),
  ])
  const prevUpdatedAt = (await api.list()).body[0].updatedAt
  const res = await api.patch('5', {
    title: '  보험 상담 ',
    description: '보험 상담',
    dueDate: ' 2026-10-05 ',
    dueTime: '09:30:00',
    priority: 'NORMAL',
    relatedEntityType: '',
    relatedEntityId: '',
    status: 'pending',
    metadata: { a: 1, b: 2 },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.updatedAt, prevUpdatedAt)
  assert.equal(api.db.updates.length, 0)
})

test('일부 필드만 바뀌면 바뀐 컬럼만 UPDATE', async () => {
  const api = setupApi(seed())
  await api.patch('2', { ...editorBody('B 중간'), priority: 'high' })
  assert.equal(api.db.updates.length, 1)
  assert.doesNotMatch(api.db.updates[0].setSql, /title|description|due_date|due_time|related_entity/)
  assert.match(api.db.updates[0].setSql, /priority = \$1/)
})

test('수정 가능 필드가 하나도 없으면 기존처럼 400', async () => {
  const api = setupApi(seed())
  const res = await api.patch('1', { foo: 'bar' })
  assert.equal(res.statusCode, 400)
  assert.equal(api.db.updates.length, 0)
})
