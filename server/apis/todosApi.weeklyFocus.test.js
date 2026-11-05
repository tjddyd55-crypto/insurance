import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTodosApi, parseWeekStartYmd } from './todosApi.js'
import { normalizeOnefcTodo, selectScheduleTasks } from '../schedule/scheduleTasks.js'

/** 주간 할 일(weekly_focus_week_start) API 계약: 응답 필드, PATCH 검증, GET weekStart 조건. */

const USER_ID = 'user-1'
const GA_ID = 7

function baseRow(extra = {}) {
  const at = new Date('2026-10-01T00:00:00.000Z')
  return {
    id: '1', tenant_id: null, ga_id: GA_ID, owner_user_id: USER_ID, assignee_user_id: USER_ID,
    title: '[QA] 주간', description: '', due_date: null, due_time: null, status: 'pending', priority: 'normal',
    source_type: 'manual', source_id: null, related_entity_type: null, related_entity_id: null, metadata: {},
    created_at: at, updated_at: at, completed_at: null, canceled_at: null, weekly_focus_week_start: null,
    ...extra,
  }
}

function setup(row) {
  const state = { row: { ...row }, updates: [], selects: [], inserts: [] }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/^\s*SELECT \*\s+FROM todos/i.test(text)) return { rows: [{ ...state.row }], rowCount: 1 }
      if (/^\s*UPDATE todos/i.test(text)) {
        const setSql = text.match(/SET([\s\S]+?)WHERE/i)[1]
        state.updates.push(setSql.trim())
        for (const part of setSql.split(',')) {
          const m = part.trim().match(/^(\w+)\s*=\s*(.+)$/)
          if (!m) continue
          const [, col, rhs] = m
          if (rhs === 'NULL') state.row[col] = null
          else if (rhs === 'NOW()') state.row[col] = new Date()
          else state.row[col] = params[Number(rhs.match(/^\$(\d+)/)[1]) - 1]
        }
        return { rows: [], rowCount: 1 }
      }
      if (/^\s*INSERT INTO todos/i.test(text)) {
        state.inserts.push({ text, params })
        return { rows: [{ ...state.row, due_date: params[6], due_time: params[7], weekly_focus_week_start: params[14] }], rowCount: 1 }
      }
      if (/FROM todos t/i.test(text)) {
        state.selects.push({ text, params })
        return { rows: [{ ...state.row }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const handlers = {}
  const router = {}
  for (const method of ['get', 'post', 'patch', 'delete']) {
    router[method] = (path, ...fns) => { handlers[`${method} ${path}`] = fns[fns.length - 1] }
  }
  registerTodosApi(router, { pool, requireAuth: (_q, _s, n) => n(), handleDbError: (e) => { throw e } })
  async function call(key, { params = {}, body = {}, query = {} } = {}) {
    const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this }, json(p) { this.body = p; return this }, end() { return this } }
    await handlers[key]({ user: { id: USER_ID, gaId: GA_ID }, gaId: GA_ID, params, body, query }, res)
    return res
  }
  return {
    state,
    patch: (body) => call('patch /todos/:todoId', { params: { todoId: '1' }, body }),
    list: (query) => call('get /todos', { query }),
    create: (body) => call('post /todos', { body }),
  }
}

test('parseWeekStartYmd: 월요일만 허용', () => {
  assert.equal(parseWeekStartYmd('2026-11-02'), '2026-11-02')
  assert.equal(parseWeekStartYmd('2026-11-01'), null) // 일요일
  assert.equal(parseWeekStartYmd('2026-11-03'), null)
  assert.equal(parseWeekStartYmd('2026-02-30'), null)
  assert.equal(parseWeekStartYmd('20261102'), null)
  assert.equal(parseWeekStartYmd(null), null)
})

test('PATCH weeklyFocusWeekStart: 월요일 저장 → 응답 필드, null 로 해제', async () => {
  const api = setup(baseRow())
  const r1 = await api.patch({ weeklyFocusWeekStart: '2026-11-02' })
  assert.equal(r1.statusCode, 200)
  assert.equal(r1.body.weeklyFocusWeekStart, '2026-11-02')
  assert.match(api.state.updates[0], /weekly_focus_week_start = \$1::date/)
  const r2 = await api.patch({ weeklyFocusWeekStart: null })
  assert.equal(r2.statusCode, 200)
  assert.equal(r2.body.weeklyFocusWeekStart, null)
  assert.match(api.state.updates[1], /weekly_focus_week_start = NULL/)
})

test('PATCH weeklyFocusWeekStart: 월요일 아님/형식 오류는 400, 저장 없음', async () => {
  const api = setup(baseRow())
  for (const bad of ['2026-11-03', 'x', 123]) {
    const r = await api.patch({ weeklyFocusWeekStart: bad })
    assert.equal(r.statusCode, 400)
  }
  assert.equal(api.state.updates.length, 0)
})

test('PATCH 같은 주 재지정은 no-op', async () => {
  const api = setup(baseRow({ weekly_focus_week_start: '2026-11-02' }))
  const r = await api.patch({ weeklyFocusWeekStart: '2026-11-02' })
  assert.equal(r.statusCode, 200)
  assert.equal(api.state.updates.length, 0)
})

test('모든 응답에 weeklyFocusWeekStart(string|null)', async () => {
  const api = setup(baseRow())
  const r = await api.list({})
  assert.ok('weeklyFocusWeekStart' in r.body[0])
  assert.equal(r.body[0].weeklyFocusWeekStart, null)
})

test('GET weekStart: 그 주로 지정한 할 일만(예정일 자동 포함 없음), 기본은 미완료만', async () => {
  const api = setup(baseRow())
  const r = await api.list({ weekStart: '2026-11-02' })
  assert.equal(r.statusCode, 200)
  const { text, params } = api.state.selects.at(-1)
  assert.match(text, /weekly_focus_week_start = \$\d+::date/)
  assert.doesNotMatch(text, /t\.due_date >= \$\d+::date AND t\.due_date <= \$\d+::date\)? OR t\.weekly_focus/)
  assert.match(text, /t\.status = 'pending'/)
  assert.ok(params.includes('2026-11-02') && !params.includes('2026-11-08'))
  const r2 = await api.list({ weekStart: '2026-11-02', includeCompleted: '1' })
  assert.equal(r2.statusCode, 200)
  assert.doesNotMatch(api.state.selects.at(-1).text, /t\.status = 'pending'/)
  const bad = await api.list({ weekStart: '2026-11-04' })
  assert.equal(bad.statusCode, 400)
})

test('일정: 직접 지정 할 일은 기간 밖 예정일이어도 그 주 화면에 포함', () => {
  const t = normalizeOnefcTodo({ id: 5, title: 'x', status: 'pending', dueDate: '2026-12-25', weeklyFocusWeekStart: '2026-11-02' })
  assert.equal(t.weeklyFocusWeekStart, '2026-11-02')
  const range = { fromYmd: '2026-11-02', toYmd: '2026-11-08', todayYmd: '2026-10-28' }
  assert.equal(selectScheduleTasks([t], range).length, 1)
  assert.equal(selectScheduleTasks([t], { ...range, fromYmd: '2026-11-09', toYmd: '2026-11-15' }).length, 0)
})

test('POST weeklyFocusWeekStart: 주간 입력 → 날짜 없음 + 그 주 지정, 월요일 아님 400', async () => {
  const api = setup(baseRow())
  const r = await api.create({ title: '[QA] 주간 입력', weeklyFocusWeekStart: '2026-11-09' })
  assert.equal(r.statusCode, 201)
  const ins = api.state.inserts.at(-1)
  assert.equal(ins.params[6], null) // due_date
  assert.equal(ins.params[7], null) // due_time
  assert.equal(ins.params[14], '2026-11-09')
  const plain = await api.create({ title: '[QA] 일반 입력', dueDate: '2026-11-05' })
  assert.equal(plain.statusCode, 201)
  assert.equal(api.state.inserts.at(-1).params[14], null) // 일반 입력은 주간 자동 포함 없음
  const bad = await api.create({ title: 'x', weeklyFocusWeekStart: '2026-11-04' })
  assert.equal(bad.statusCode, 400)
})
