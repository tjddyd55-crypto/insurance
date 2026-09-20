import test from 'node:test'
import assert from 'node:assert/strict'
import { registerInsuranceContactsApi } from './registerInsuranceContactsApi.js'

const USER_A = 'user-general-a'
const USER_B = 'user-general-b'
const GA_USER_A = 'user-ga-a'
const GA_USER_B = 'user-ga-b'
const GA_ID_A = 101
const GA_ID_B = 202

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
    headers: {},
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
    setHeader(key, value) {
      this.headers[key] = value
    },
  }
}

async function runHandlers(handlers, req, res) {
  for (const handler of handlers) {
    await handler(req, res, () => {})
  }
}

function generalUser(id) {
  return {
    id,
    role: 'USER',
    gaCode: 'GENERAL',
    gaName: '공용',
  }
}

function gaUser(id, gaId, gaCode, gaName) {
  return {
    id,
    role: 'USER',
    gaCode,
    gaName,
    gaId,
  }
}

function createContactsStore() {
  /** @type {Array<Record<string, unknown>>} */
  const contacts = []
  /** @type {Map<string, number>} */
  const gaIdByUser = new Map([
    [GA_USER_A, GA_ID_A],
    [GA_USER_B, GA_ID_B],
  ])

  const safeQuery = async (_executor, sql, params = []) => {
    const text = String(sql)

    if (text.includes('INSERT INTO insurance_contacts')) {
      const row = {
        id: String(params[0]),
        owner_scope: 'USER',
        user_id: String(params[1]),
        ga_id: null,
        category: String(params[2]),
        company_name: String(params[3]),
        manager_name: String(params[4]),
        position: String(params[5]),
        phone_number: String(params[6]),
        created_at: new Date('2026-09-20T00:00:00.000Z'),
        updated_at: new Date('2026-09-20T00:00:00.000Z'),
      }
      contacts.push(row)
      return { rowCount: 1, rows: [row] }
    }

    if (text.includes('UPDATE insurance_contacts')) {
      const contactId = String(params[5])
      const userId = String(params[6])
      const row = contacts.find((item) => item.id === contactId && item.user_id === userId)
      if (!row) {
        return { rowCount: 0, rows: [] }
      }
      row.category = String(params[0])
      row.company_name = String(params[1])
      row.manager_name = String(params[2])
      row.position = String(params[3])
      row.phone_number = String(params[4])
      row.updated_at = new Date('2026-09-20T01:00:00.000Z')
      return { rowCount: 1, rows: [row] }
    }

    if (text.includes('DELETE FROM insurance_contacts')) {
      const contactId = String(params[0])
      const userId = String(params[1])
      const idx = contacts.findIndex((item) => item.id === contactId && item.user_id === userId)
      if (idx < 0) {
        return { rowCount: 0, rows: [] }
      }
      contacts.splice(idx, 1)
      return { rowCount: 1, rows: [] }
    }

    if (text.includes('FROM insurance_contacts') && text.includes('WHERE id = $1')) {
      const contactId = String(params[0])
      const row = contacts.find((item) => {
        if (item.id !== contactId) return false
        if (text.includes("owner_scope = 'USER' AND user_id = $2")) {
          return item.owner_scope === 'USER' && item.user_id === String(params[1])
        }
        if (text.includes('user_id = $2 AND owner_scope = $3')) {
          return item.user_id === String(params[1]) && item.owner_scope === String(params[2])
        }
        if (text.includes('ga_id = $2 AND owner_scope = $3')) {
          return item.ga_id === Number(params[1]) && item.owner_scope === String(params[2])
        }
        return false
      })
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
    }

    if (text.includes('FROM insurance_contacts') && text.includes('ORDER BY')) {
      if (text.includes('ga_id = $1 AND owner_scope = $2')) {
        const gaId = Number(params[0])
        const rows = contacts.filter(
          (item) => item.owner_scope === 'GA' && item.ga_id === gaId,
        )
        return { rowCount: rows.length, rows }
      }
      if (text.includes('user_id = $1 AND owner_scope = $2')) {
        const userId = String(params[0])
        const rows = contacts.filter(
          (item) => item.owner_scope === 'USER' && item.user_id === userId,
        )
        return { rowCount: rows.length, rows }
      }
    }

    if (text.includes('FROM insurance_contact_meta')) {
      return { rowCount: 0, rows: [] }
    }

    if (text.includes('INSERT INTO insurance_contact_meta')) {
      return { rowCount: 1, rows: [] }
    }

    return { rowCount: 0, rows: [] }
  }

  const systemQuery = async (_executor, sql, params = []) => {
    const text = String(sql)
    if (text.includes('FROM insurance_contact_meta')) {
      return { rowCount: 0, rows: [] }
    }
    return { rowCount: 0, rows: [] }
  }

  return {
    contacts,
    gaIdByUser,
    pool: { query: safeQuery },
    safeQuery,
    systemQuery,
    async withTransaction(task) {
      return task({ query: safeQuery })
    },
  }
}

function registerRoutes(store) {
  const { apiRouter, routes } = createRouterCapture()
  registerInsuranceContactsApi(apiRouter, {
    pool: store.pool,
    safeQuery: store.safeQuery,
    systemQuery: store.systemQuery,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error, _req, res) => {
      res.status(500).json({ message: String(error) })
    },
    effectiveTenantGaId: (req) => store.gaIdByUser.get(String(req.user?.id ?? '')) ?? null,
    forbiddenResponse: (_req, res, message) => {
      res.status(403).json({ message })
    },
    isNewsManagerRole: () => false,
    toIsoString: (value) => String(value),
    withTransaction: store.withTransaction,
  })
  return routes
}

const payload = {
  category: 'LIFE',
  companyName: '테스트생명',
  managerName: '담당자A',
  position: '팀장',
  phoneNumber: '01012345678',
}

test('GENERAL User A can create, list, update, delete own personal contact', async () => {
  const store = createContactsStore()
  const routes = registerRoutes(store)

  const postRes = createMockRes()
  await runHandlers(
    routes.get('POST /insurance/contacts'),
    {
      user: generalUser(USER_A),
      body: {
        ...payload,
        user_id: USER_B,
        ga_id: GA_ID_A,
        owner_scope: 'GA',
      },
    },
    postRes,
  )
  assert.equal(postRes.statusCode, 201)
  const contactId = String(postRes.body?.id ?? '')
  assert.ok(contactId)
  assert.equal(store.contacts[0]?.user_id, USER_A)
  assert.equal(store.contacts[0]?.owner_scope, 'USER')

  const listRes = createMockRes()
  await runHandlers(routes.get('GET /insurance/contacts'), { user: generalUser(USER_A) }, listRes)
  assert.equal(listRes.statusCode, 200)
  assert.equal(listRes.body?.contacts?.length, 1)

  const putRes = createMockRes()
  await runHandlers(
    routes.get('PUT /insurance/contacts/:id'),
    {
      user: generalUser(USER_A),
      params: { id: contactId },
      body: { ...payload, managerName: '담당자A-수정', user_id: USER_B },
    },
    putRes,
  )
  assert.equal(putRes.statusCode, 200)
  assert.equal(putRes.body?.managerName, '담당자A-수정')

  const vcardRes = createMockRes()
  await runHandlers(
    routes.get('GET /insurance/contacts/:id/vcard'),
    { user: generalUser(USER_A), params: { id: contactId } },
    vcardRes,
  )
  assert.equal(vcardRes.statusCode, 200)
  assert.match(String(vcardRes.body), /BEGIN:VCARD/)

  const deleteRes = createMockRes()
  await runHandlers(
    routes.get('DELETE /insurance/contacts/:id'),
    { user: generalUser(USER_A), params: { id: contactId } },
    deleteRes,
  )
  assert.equal(deleteRes.statusCode, 204)
})

test('GENERAL User B cannot read, update, or delete User A personal contact', async () => {
  const store = createContactsStore()
  store.contacts.push({
    id: 'contact-a-1',
    owner_scope: 'USER',
    user_id: USER_A,
    ga_id: null,
    category: 'LIFE',
    company_name: 'A생명',
    manager_name: 'A담당',
    position: '',
    phone_number: '01011112222',
    created_at: new Date(),
    updated_at: new Date(),
  })
  const routes = registerRoutes(store)

  const listRes = createMockRes()
  await runHandlers(routes.get('GET /insurance/contacts'), { user: generalUser(USER_B) }, listRes)
  assert.equal(listRes.statusCode, 200)
  assert.equal(listRes.body?.contacts?.length, 0)

  const vcardRes = createMockRes()
  await runHandlers(
    routes.get('GET /insurance/contacts/:id/vcard'),
    { user: generalUser(USER_B), params: { id: 'contact-a-1' } },
    vcardRes,
  )
  assert.equal(vcardRes.statusCode, 404)

  const putRes = createMockRes()
  await runHandlers(
    routes.get('PUT /insurance/contacts/:id'),
    {
      user: generalUser(USER_B),
      params: { id: 'contact-a-1' },
      body: payload,
    },
    putRes,
  )
  assert.equal(putRes.statusCode, 404)

  const deleteRes = createMockRes()
  await runHandlers(
    routes.get('DELETE /insurance/contacts/:id'),
    { user: generalUser(USER_B), params: { id: 'contact-a-1' } },
    deleteRes,
  )
  assert.equal(deleteRes.statusCode, 404)
  assert.equal(store.contacts.length, 1)
})

test('GA member cannot use personal contact mutation routes', async () => {
  const store = createContactsStore()
  const routes = registerRoutes(store)

  const postRes = createMockRes()
  await runHandlers(
    routes.get('POST /insurance/contacts'),
    { user: gaUser(GA_USER_A, GA_ID_A, 'YJASSET', '영진에셋'), body: payload },
    postRes,
  )
  assert.equal(postRes.statusCode, 403)
})

test('GA tenant B cannot access GA tenant A contact via scoped vcard lookup', async () => {
  const store = createContactsStore()
  store.contacts.push({
    id: 'ga-contact-a',
    owner_scope: 'GA',
    user_id: null,
    ga_id: GA_ID_A,
    category: 'LIFE',
    company_name: 'GA-A생명',
    manager_name: 'GA-A',
    position: '',
    phone_number: '01033334444',
    created_at: new Date(),
    updated_at: new Date(),
  })
  const routes = registerRoutes(store)

  const vcardRes = createMockRes()
  await runHandlers(
    routes.get('GET /insurance/contacts/:id/vcard'),
    { user: gaUser(GA_USER_B, GA_ID_B, 'TESTGA', '테스트GA'), params: { id: 'ga-contact-a' } },
    vcardRes,
  )
  assert.equal(vcardRes.statusCode, 404)
})

test('affiliation switch preserves personal contacts and changes visible source', async () => {
  const store = createContactsStore()
  store.contacts.push({
    id: 'personal-kept',
    owner_scope: 'USER',
    user_id: USER_A,
    ga_id: null,
    category: 'LIFE',
    company_name: '개인보험',
    manager_name: '나',
    position: '',
    phone_number: '01055556666',
    created_at: new Date(),
    updated_at: new Date(),
  })
  store.contacts.push({
    id: 'ga-shared',
    owner_scope: 'GA',
    user_id: null,
    ga_id: GA_ID_A,
    category: 'NON_LIFE',
    company_name: 'GA공용',
    manager_name: 'GA담당',
    position: '',
    phone_number: '01077778888',
    created_at: new Date(),
    updated_at: new Date(),
  })
  store.gaIdByUser.set(USER_A, GA_ID_A)
  const routes = registerRoutes(store)

  const asGaRes = createMockRes()
  await runHandlers(
    routes.get('GET /insurance/contacts'),
    { user: gaUser(USER_A, GA_ID_A, 'YJASSET', '영진에셋') },
    asGaRes,
  )
  assert.equal(asGaRes.statusCode, 200)
  assert.equal(asGaRes.body?.scope, 'GA')
  assert.equal(asGaRes.body?.contacts?.length, 1)
  assert.equal(asGaRes.body?.contacts?.[0]?.companyName, 'GA공용')

  const asGeneralRes = createMockRes()
  await runHandlers(
    routes.get('GET /insurance/contacts'),
    { user: generalUser(USER_A) },
    asGeneralRes,
  )
  assert.equal(asGeneralRes.statusCode, 200)
  assert.equal(asGeneralRes.body?.scope, 'USER')
  assert.equal(asGeneralRes.body?.contacts?.length, 1)
  assert.equal(asGeneralRes.body?.contacts?.[0]?.companyName, '개인보험')
  assert.equal(store.contacts.length, 2)
})
