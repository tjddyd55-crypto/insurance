import test from 'node:test'
import assert from 'node:assert/strict'
import { registerInsuranceContactsApi } from './registerInsuranceContactsApi.js'
import { safeQuery, systemQuery } from '../utils/dbSafeQuery.js'

const GENERAL_USER = 'general-user-safequery'

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
    put(routePath, ...handlers) {
      routes.set(`PUT ${routePath}`, handlers)
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
  }
}

async function runHandlers(handlers, req, res) {
  for (const handler of handlers) {
    await handler(req, res, () => {})
  }
}

test('GENERAL GET contacts uses systemQuery for insurance_contact_meta (safeQuery would reject)', async () => {
  const { apiRouter, routes } = createRouterCapture()
  const executed = []

  const pool = {
    query: async (sql, params = []) => {
      const text = String(sql)
      executed.push({ text, params })

      if (text.includes('FROM insurance_contacts') && text.includes('user_id = $1')) {
        return { rowCount: 0, rows: [] }
      }
      if (text.includes('FROM insurance_contact_meta')) {
        return { rowCount: 0, rows: [] }
      }
      throw new Error(`unexpected query: ${text}`)
    },
  }

  registerInsuranceContactsApi(apiRouter, {
    pool,
    safeQuery,
    systemQuery,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error, _req, res) => {
      res.status(500).json({ message: String(error?.message ?? error) })
    },
    effectiveTenantGaId: () => null,
    forbiddenResponse: (_req, res, message) => {
      res.status(403).json({ message })
    },
    isNewsManagerRole: () => false,
    toIsoString: (value) => String(value ?? ''),
    withTransaction: async (task) => task(pool),
  })

  const res = createMockRes()
  await runHandlers(routes.get('GET /insurance/contacts'), {
    user: { id: GENERAL_USER, role: 'USER', gaCode: 'GENERAL', gaName: '공용' },
  }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.scope, 'USER')
  assert.deepEqual(res.body?.contacts, [])

  const metaQuery = executed.find((entry) => entry.text.includes('FROM insurance_contact_meta'))
  assert.ok(metaQuery, 'insurance_contact_meta query should run')
  assert.equal(metaQuery.params[0], `contact_last_updated_at:user:${GENERAL_USER}`)
})
