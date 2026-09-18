import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, test } from 'node:test'
import { registerCustomerSpecialDatesApi } from './customerSpecialDatesApi.js'
import { registerPushDevicesApi } from './registerPushDevicesApi.js'
import { buildCustomerMapListQuery } from '../lib/customerMapQuery.js'
import { loadCustomerNewsForAgentComment } from '../lib/customerNewsComments.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function readServer(relPath) {
  return readFileSync(join(repoRoot, relPath), 'utf8')
}

function createRouterCapture() {
  /** @type {Map<string, Function[]>} */
  const routes = new Map()
  const apiRouter = {
    get(routePath, ...handlers) {
      routes.set(`GET ${routePath}`, handlers)
    },
    post(routePath, ...handlers) {
      routes.set(`POST ${routePath}`, handlers)
    },
    patch(routePath, ...handlers) {
      routes.set(`PATCH ${routePath}`, handlers)
    },
    delete(routePath, ...handlers) {
      routes.set(`DELETE ${routePath}`, handlers)
    },
  }
  return { apiRouter, routes }
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    send(payload) {
      this.body = payload
      return this
    },
  }
}

async function runHandlers(handlers, req, res) {
  for (const handler of handlers) {
    await handler(req, res, () => {})
  }
}

const AGENT_A = 'agent-a'
const AGENT_B = 'agent-b'
const GA_A = 10
const GA_B = 20
const CUSTOMER_OWNED = 101
const CUSTOMER_OTHER = 202

function createSpecialDatesPoolMock(ownedCustomerIds = new Set([CUSTOMER_OWNED])) {
  const client = {
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('SELECT id FROM customers') && text.includes('deleted_at IS NULL')) {
        const customerId = Number(params?.[0])
        const userId = String(params?.[1] ?? '')
        const gaId = Number(params?.[2])
        const owned =
          ownedCustomerIds.has(customerId) &&
          userId === AGENT_A &&
          gaId === GA_A
        return owned ? { rowCount: 1, rows: [{ id: customerId }] } : { rowCount: 0, rows: [] }
      }
      if (text.includes('FROM customer_special_dates') && text.includes('deleted_at IS NULL')) {
        return { rowCount: 0, rows: [] }
      }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rowCount: 0, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    },
    release() {},
  }
  return {
    async query(sql, params) {
      return client.query(sql, params)
    },
    async connect() {
      return client
    },
  }
}

describe('native release tenant scope — SQL SSOT', () => {
  it('getOwnedStorageFile scopes by file id, user_id, ga_id, and active status', () => {
    const src = readServer('apis/customerExtraApi.js')
    const fnStart = src.indexOf('async function getOwnedStorageFile')
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 900)
    assert.match(slice, /WHERE id = \$1/)
    assert.match(slice, /AND user_id = \$2/)
    assert.match(slice, /AND ga_id = \$3/)
    assert.match(slice, /AND status = 'active'/)
    assert.match(slice, /AND deleted_at IS NULL/)
    assert.match(slice, /file_path/)
  })

  it('fetchTodoMine scopes mutations to ga_id and owner/assignee', () => {
    const src = readServer('apis/todosApi.js')
    const fnStart = src.indexOf('async function fetchTodoMine')
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 500)
    assert.match(slice, /WHERE id = \$1::bigint AND ga_id = \$2/)
    assert.match(slice, /owner_user_id = \$3 OR assignee_user_id = \$3/)
  })

  it('loadCustomerNewsForAgentComment requires ga_id, publisherId, and published customer-visible newsletter', () => {
    const src = readServer('lib/customerNewsComments.js')
    const fnStart = src.indexOf('export async function loadCustomerNewsForAgentComment')
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 900)
    assert.match(slice, /n\.ga_id = \$2/)
    assert.match(slice, /n\.status = 'PUBLISHED'/)
    assert.match(slice, /n\.deleted_at IS NULL/)
    assert.match(slice, /customerVisible/)
    assert.match(slice, /publisherId/)
  })

  it('customer map list query applies visibility clause before filters', () => {
    const built = buildCustomerMapListQuery({
      visibilityClause: 'c.user_id = $1 AND c.ga_id = $2',
      visibilityParams: ['agent-a', 10],
      userId: 'agent-a',
      gaId: 10,
      favoriteOnly: true,
      keyword: 'kim',
    })
    assert.match(built.sql, /\(c\.user_id = \$1 AND c\.ga_id = \$2\)/)
    assert.match(built.sql, /c\.is_favorite = true/)
    assert.match(built.sql, /ILIKE/)
    assert.ok(built.params.includes('%kim%'))
  })

  it('customer detail GET applies visibility SQL and ga_id', () => {
    const src = readServer('index.js')
    const fnStart = src.indexOf("apiRouter.get('/customers/:id'")
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 1800)
    assert.match(slice, /resolveCustomerVisibilitySqlForSelect/)
    assert.match(slice, /detailParams = \[\.\.\.vis\.params, customerId, userId, gaId\]/)
    assert.match(slice, /accessEarly === 'none'/)
  })

  it('agent claim request detail scopes by request id and agent_id', () => {
    const src = readServer('apis/customerClaimAppApi.js')
    const fnStart = src.indexOf("apiRouter.get('/agent/customer-claim-requests/:requestId'")
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 1200)
    assert.match(slice, /WHERE r\.id = \$1/)
    assert.match(slice, /AND r\.agent_id = \$2/)
  })

  it('special dates assertCustomerOwned requires customer id, user_id, and ga_id', () => {
    const src = readServer('apis/customerSpecialDatesApi.js')
    const fnStart = src.indexOf('async function assertCustomerOwned')
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 350)
    assert.match(slice, /WHERE id = \$1 AND user_id = \$2 AND ga_id = \$3/)
    assert.match(slice, /deleted_at IS NULL/)
  })
})

describe('native release tenant scope — special dates routes', () => {
  it('GET denies cross-tenant customer access', async () => {
    const pool = createSpecialDatesPoolMock(new Set())
    const { apiRouter, routes } = createRouterCapture()
    registerCustomerSpecialDatesApi(apiRouter, {
      pool,
      requireAuth: (_req, _res, next) => next(),
      handleDbError: (error, _req, res) => res.status(500).json({ message: String(error) }),
    })
    const handlers = routes.get('GET /customers/:customerId/special-dates')
    const res = createMockRes()
    await runHandlers(
      handlers,
      { user: { id: AGENT_A, gaId: GA_A }, params: { customerId: String(CUSTOMER_OTHER) } },
      res,
    )
    assert.equal(res.statusCode, 404)
  })

  it('POST denies cross-tenant customer mutation', async () => {
    const pool = createSpecialDatesPoolMock(new Set())
    const { apiRouter, routes } = createRouterCapture()
    registerCustomerSpecialDatesApi(apiRouter, {
      pool,
      requireAuth: (_req, _res, next) => next(),
      handleDbError: (error, _req, res) => res.status(500).json({ message: String(error) }),
    })
    const handlers = routes.get('POST /customers/:customerId/special-dates')
    const res = createMockRes()
    await runHandlers(
      handlers,
      {
        user: { id: AGENT_A, gaId: GA_A },
        params: { customerId: String(CUSTOMER_OTHER) },
        body: { title: '기념일', dateValue: '2026-09-18' },
      },
      res,
    )
    assert.equal(res.statusCode, 404)
  })

  it('GET allows owned customer access', async () => {
    const pool = createSpecialDatesPoolMock(new Set([CUSTOMER_OWNED]))
    const { apiRouter, routes } = createRouterCapture()
    registerCustomerSpecialDatesApi(apiRouter, {
      pool,
      requireAuth: (_req, _res, next) => next(),
      handleDbError: (error, _req, res) => res.status(500).json({ message: String(error) }),
    })
    const handlers = routes.get('GET /customers/:customerId/special-dates')
    const res = createMockRes()
    await runHandlers(
      handlers,
      { user: { id: AGENT_A, gaId: GA_A }, params: { customerId: String(CUSTOMER_OWNED) } },
      res,
    )
    assert.equal(res.statusCode, 200)
    assert.ok(Array.isArray(res.body?.specialDates))
  })
})

describe('native release tenant scope — push registration', () => {
  it('registerPushDevicesApi binds registration to authenticated user, not request body userId', async () => {
    const src = readServer('apis/registerPushDevicesApi.js')
    assert.match(src, /const userId = String\(req\.user\?\.id/)
    assert.doesNotMatch(src, /body\.userId/)
    assert.doesNotMatch(src, /body\.user_id/)
  })

  it('register route forwards authenticated userId into registerUserPushDevice call site', () => {
    const src = readServer('apis/registerPushDevicesApi.js')
    const fnStart = src.indexOf("apiRouter.post('/push/devices/register'")
    assert.ok(fnStart >= 0)
    const slice = src.slice(fnStart, fnStart + 1200)
    assert.match(slice, /registerUserPushDevice\(pool, \{/)
    assert.match(slice, /userId,/)
    assert.doesNotMatch(slice, /body\.userId/)
  })
})

test('loadCustomerNewsForAgentComment mock denies newsletter owned by another agent/ga', async () => {
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('FROM insurance_company_newsletters n')) {
        const gaId = Number(params?.[1])
        const agentId = String(params?.[2] ?? '')
        if (gaId === GA_B && agentId === AGENT_B) {
          return { rowCount: 1, rows: [{ id: 'news-1' }] }
        }
        return { rowCount: 0, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    },
  }

  const allowed = await loadCustomerNewsForAgentComment(pool, {
    newsId: 'news-1',
    agentId: AGENT_A,
    gaId: GA_A,
  })
  assert.equal(allowed.ok, false)
  if (!allowed.ok) {
    assert.equal(allowed.status, 404)
  }

  const denied = await loadCustomerNewsForAgentComment(pool, {
    newsId: 'news-1',
    agentId: AGENT_B,
    gaId: GA_B,
  })
  assert.equal(denied.ok, true)
})
