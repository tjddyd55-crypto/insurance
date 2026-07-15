import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { registerCustomerClaimAppApi } from './customerClaimAppApi.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = fs.readFileSync(path.join(__dirname, 'customerClaimAppApi.js'), 'utf8')
const JWT_SECRET = 'customer-app-profile-lock-test-secret'

function createRouterCapture() {
  /** @type {Map<string, Function[]>} */
  const routes = new Map()
  const apiRouter = {
    get(routePath, ...handlers) {
      routes.set(`GET ${routePath}`, handlers)
    },
    put(routePath, ...handlers) {
      routes.set(`PUT ${routePath}`, handlers)
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
    all(routePath, ...handlers) {
      routes.set(`ALL ${routePath}`, handlers)
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
  }
}

async function runHandlers(handlers, req, res) {
  let index = 0
  const run = async () => {
    if (index >= handlers.length) {
      return
    }
    const handler = handlers[index++]
    await new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn) => {
        if (settled) {
          return
        }
        settled = true
        fn()
      }
      const next = (err) => {
        if (err) {
          finish(() => reject(err))
          return
        }
        finish(() => {
          resolve(run())
        })
      }
      try {
        Promise.resolve(handler(req, res, next)).then(
          () => {
            if (!settled) {
              finish(() => resolve())
            }
          },
          (error) => finish(() => reject(error)),
        )
      } catch (error) {
        finish(() => reject(error))
      }
    })
  }
  await run()
}

function createPoolMock(overrides = {}) {
  const queries = []
  const pool = {
    queries,
    async query(sql, params) {
      queries.push({ sql: String(sql), params })
      if (typeof overrides.query === 'function') {
        return overrides.query(sql, params, queries)
      }
      const text = String(sql)
      if (text.includes('FROM customer_app_devices') && text.includes('INNER JOIN customer_app_links')) {
        return {
          rowCount: 1,
          rows: [
            {
              device_row_id: 1,
              device_status: 'active',
              link_id: 9,
              link_status: 'active',
              expires_at: null,
            },
          ],
        }
      }
      if (text.includes('UPDATE customer_app_devices') && text.includes('last_active_at')) {
        return { rowCount: 1, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    },
    async connect() {
      return {
        query: (...args) => pool.query(...args),
        release() {},
      }
    },
  }
  return pool
}

test('customer-app source never calls syncProfileToLinkedCustomer', () => {
  const callCount = (SOURCE.match(/await\s+syncProfileToLinkedCustomer\s*\(/g) || []).length
  assert.equal(callCount, 0, 'customer-app must not sync profile into CRM customers')
  assert.match(SOURCE, /customer-app must not mutate CRM customers master profile/)
})

test('PUT /customer-app/profile returns 403 and never updates customers', async () => {
  const pool = createPoolMock()
  const { apiRouter, routes } = createRouterCapture()
  registerCustomerClaimAppApi(apiRouter, {
    pool,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error, _req, res) => {
      res.status(500).json({ message: String(error) })
    },
    jwtSecret: JWT_SECRET,
  })

  const handlers = routes.get('PUT /customer-app/profile')
  assert.ok(handlers, 'PUT /customer-app/profile must be registered')

  const token = jwt.sign(
    {
      kind: 'CUSTOMER_APP',
      linkId: 9,
      agentId: 'agent-1',
      customerId: 42,
      deviceId: 'device-1',
    },
    JWT_SECRET,
  )
  const req = {
    headers: { authorization: `Bearer ${token}` },
    body: {
      name: '변경된 이름',
      birthDate: '900101',
      phone: '01012345678',
    },
  }
  const res = createMockRes()
  await runHandlers(handlers, req, res)

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.success, false)
  assert.match(String(res.body?.message ?? ''), /고객 정보 수정 기능은 현재 사용할 수 없습니다/)
  assert.ok(
    !pool.queries.some((entry) => /UPDATE\s+customers/i.test(entry.sql)),
    'customers table must not be updated',
  )
})

test('POST /customer-app/claim-requests keeps CRM customers.name when requester payload differs', async () => {
  const pool = createPoolMock({
    query(sql, params) {
      const text = String(sql)
      if (text.includes('FROM customer_app_devices') && text.includes('INNER JOIN customer_app_links')) {
        return {
          rowCount: 1,
          rows: [
            {
              device_row_id: 1,
              device_status: 'active',
              link_id: 9,
              link_status: 'active',
              expires_at: null,
            },
          ],
        }
      }
      if (text.includes('UPDATE customer_app_devices') && text.includes('last_active_at')) {
        return { rowCount: 1, rows: [] }
      }
      if (text.includes('FROM users') && text.includes('ga_id')) {
        return { rowCount: 1, rows: [{ ga_id: null }] }
      }
      if (text.trim().startsWith('BEGIN') || text.trim().startsWith('COMMIT') || text.trim().startsWith('ROLLBACK')) {
        return { rowCount: 0, rows: [] }
      }
      if (text.includes('FROM customers') && text.includes('birth_date')) {
        return {
          rowCount: 1,
          rows: [{ name: '박성용', ssn: '9001011', birth_date: '1990-01-01', phone: '01011112222' }],
        }
      }
      if (text.includes('INSERT INTO customer_claim_requests')) {
        assert.equal(params[6], '박성용', 'claim requester_name must use CRM customer name')
        return {
          rowCount: 1,
          rows: [{ id: 1001, status: 'requested', submitted_at: new Date().toISOString() }],
        }
      }
      if (text.includes('INSERT INTO customer_claim_request_files')) {
        return { rowCount: 0, rows: [] }
      }
      if (text.includes('INSERT INTO customer_claim_status_logs')) {
        return { rowCount: 1, rows: [] }
      }
      if (text.includes('INSERT INTO customer_link_audit_logs')) {
        return { rowCount: 1, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    },
  })

  const clientQueries = []
  pool.connect = async () => ({
    async query(sql, params) {
      clientQueries.push({ sql: String(sql), params })
      return pool.query(sql, params)
    },
    release() {},
  })

  const { apiRouter, routes } = createRouterCapture()
  registerCustomerClaimAppApi(apiRouter, {
    pool,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error, _req, res) => {
      res.status(500).json({ message: String(error) })
    },
    jwtSecret: JWT_SECRET,
  })

  const handlers = routes.get('POST /customer-app/claim-requests')
  assert.ok(handlers)

  const token = jwt.sign(
    {
      kind: 'CUSTOMER_APP',
      linkId: 9,
      agentId: 'agent-1',
      customerId: 42,
      deviceId: 'device-1',
    },
    JWT_SECRET,
  )
  const req = {
    headers: { authorization: `Bearer ${token}` },
    body: {
      memo: '통원 청구 요청',
      files: [],
      requester: {
        name: '홍길동',
        birthDate: '880101',
        phone: '01099998888',
      },
    },
  }
  const res = createMockRes()
  await runHandlers(handlers, req, res)

  assert.equal(res.statusCode, 201, `expected 201 got ${res.statusCode}: ${JSON.stringify(res.body)}`)
  assert.equal(res.body?.success, true)
  assert.ok(
    !clientQueries.some((entry) => /UPDATE\s+customers/i.test(entry.sql)),
    'claim submit must not UPDATE customers',
  )
  assert.ok(
    !pool.queries.some((entry) => /UPDATE\s+customers/i.test(entry.sql)),
    'claim submit must not UPDATE customers via pool',
  )
})

test('CRM user customer patch route remains outside customer-app lock', () => {
  const indexSource = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
  assert.match(indexSource, /UPDATE customers[\s\S]*SET \$\{parts\.join/)
  assert.ok(!SOURCE.includes("apiRouter.patch('/customers"))
})
