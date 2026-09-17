import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCustomerClaimAppApi } from './customerClaimAppApi.js'
import {
  mapCustomerNewsCommentRow,
  validateCustomerNewsCommentContent,
} from '../lib/customerNewsComments.js'

const AGENT_A = 'agent-a'
const AGENT_B = 'agent-b'
const GA_A = 10
const GA_B = 20
const NEWS_ID = 'news-uuid-1'

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
    put() {},
    patch() {},
    delete() {},
    all() {},
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

function createCommentsPoolMock(scenario) {
  const comments = Array.isArray(scenario.initialComments) ? [...scenario.initialComments] : []
  return {
    comments,
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('SELECT ga_id FROM users WHERE id = $1')) {
        const userId = String(params?.[0] ?? '')
        if (userId === AGENT_A) {
          return { rowCount: 1, rows: [{ ga_id: GA_A }] }
        }
        if (userId === AGENT_B) {
          return { rowCount: 1, rows: [{ ga_id: GA_B }] }
        }
        return { rowCount: 0, rows: [] }
      }
      if (text.includes('FROM insurance_company_newsletters n') && text.includes('publisherId')) {
        const newsId = String(params?.[0] ?? '')
        const gaId = Number(params?.[1])
        const agentId = String(params?.[2] ?? '')
        const row = scenario.newsletters?.find(
          (item) => item.id === newsId && item.gaId === gaId && item.publisherId === agentId,
        )
        if (!row) {
          return { rowCount: 0, rows: [] }
        }
        return { rowCount: 1, rows: [{ id: row.id }] }
      }
      if (text.includes('FROM customer_news_comments c') && text.includes('ORDER BY c.created_at')) {
        const newsId = String(params?.[0] ?? '')
        const gaId = Number(params?.[1])
        const rows = comments
          .filter((item) => item.newsletter_id === newsId && item.ga_id === gaId)
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        return { rowCount: rows.length, rows }
      }
      if (text.includes('SELECT') && text.includes('FROM users') && text.includes('display_name')) {
        const userId = String(params?.[0] ?? '')
        if (userId === AGENT_A) {
          return { rowCount: 1, rows: [{ display_name: '담당자A' }] }
        }
        return { rowCount: 1, rows: [{ display_name: '담당자' }] }
      }
      if (text.includes('INSERT INTO customer_news_comments')) {
        const row = {
          id: 'comment-new-1',
          newsletter_id: String(params?.[1] ?? ''),
          author_type: 'agent',
          author_name: String(params?.[4] ?? ''),
          content: String(params?.[5] ?? ''),
          created_at: new Date('2026-09-18T00:00:00.000Z'),
        }
        comments.push({
          id: row.id,
          newsletter_id: row.newsletter_id,
          ga_id: Number(params?.[2]),
          author_type: row.author_type,
          author_name: row.author_name,
          content: row.content,
          created_at: row.created_at,
        })
        return { rowCount: 1, rows: [row] }
      }
      return { rowCount: 0, rows: [] }
    },
    async connect() {
      return {
        query: (...args) => this.query(...args),
        release() {},
      }
    },
  }
}

function registerRoutes(pool) {
  const { apiRouter, routes } = createRouterCapture()
  registerCustomerClaimAppApi(apiRouter, {
    pool,
    requireAuth: (_req, _res, next) => next(),
    handleDbError: (error, _req, res) => {
      res.status(500).json({ message: String(error) })
    },
    jwtSecret: 'customer-news-comments-test',
  })
  return routes
}

test('validateCustomerNewsCommentContent rejects empty trimmed content', () => {
  const result = validateCustomerNewsCommentContent('   ')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 400)
  }
})

test('mapCustomerNewsCommentRow normalizes author defaults', () => {
  const mapped = mapCustomerNewsCommentRow({
    id: 'c1',
    newsletter_id: NEWS_ID,
    author_type: 'agent',
    author_name: '',
    content: 'hello',
    created_at: '2026-09-18T00:00:00.000Z',
  })
  assert.equal(mapped.authorName, '담당자')
  assert.equal(mapped.newsId, NEWS_ID)
})

test('GET /agent/customer-news/:newsId/comments returns empty list', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_A, publisherId: AGENT_A }],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('GET /agent/customer-news/:newsId/comments')
  assert.ok(handlers)

  const res = createMockRes()
  await runHandlers(handlers, { user: { id: AGENT_A }, params: { newsId: NEWS_ID } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.success, true)
  assert.deepEqual(res.body?.data, [])
})

test('GET /agent/customer-news/:newsId/comments returns populated list', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_A, publisherId: AGENT_A }],
    initialComments: [
      {
        id: 'c1',
        newsletter_id: NEWS_ID,
        ga_id: GA_A,
        author_type: 'agent',
        author_name: '담당자A',
        content: '첫 댓글',
        created_at: '2026-09-18T00:00:00.000Z',
      },
    ],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('GET /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(handlers, { user: { id: AGENT_A }, params: { newsId: NEWS_ID } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.length, 1)
  assert.equal(res.body?.data?.[0]?.content, '첫 댓글')
  assert.equal(res.body?.data?.[0]?.authorName, '담당자A')
})

test('GET comments returns 404 when newsletter is missing', async () => {
  const pool = createCommentsPoolMock({ newsletters: [] })
  const routes = registerRoutes(pool)
  const handlers = routes.get('GET /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(handlers, { user: { id: AGENT_A }, params: { newsId: 'missing' } }, res)

  assert.equal(res.statusCode, 404)
  assert.match(String(res.body?.message ?? ''), /소식지/)
})

test('GET comments returns 401 without auth user', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_A, publisherId: AGENT_A }],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('GET /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(handlers, { user: {}, params: { newsId: NEWS_ID } }, res)

  assert.equal(res.statusCode, 401)
})

test('GET comments denies cross-tenant newsletter access', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_B, publisherId: AGENT_B }],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('GET /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(handlers, { user: { id: AGENT_A }, params: { newsId: NEWS_ID } }, res)

  assert.equal(res.statusCode, 404)
})

test('POST /agent/customer-news/:newsId/comments creates comment', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_A, publisherId: AGENT_A }],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('POST /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(
    handlers,
    {
      user: { id: AGENT_A },
      params: { newsId: NEWS_ID },
      body: { content: '새 댓글' },
    },
    res,
  )

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.success, true)
  assert.equal(res.body?.data?.content, '새 댓글')
  assert.equal(res.body?.data?.authorName, '담당자A')
  assert.equal(res.body?.data?.newsId, NEWS_ID)
})

test('POST comment rejects empty content', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_A, publisherId: AGENT_A }],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('POST /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(
    handlers,
    {
      user: { id: AGENT_A },
      params: { newsId: NEWS_ID },
      body: { content: '   ' },
    },
    res,
  )

  assert.equal(res.statusCode, 400)
  assert.match(String(res.body?.message ?? ''), /댓글/)
})

test('POST comment denies cross-tenant newsletter access', async () => {
  const pool = createCommentsPoolMock({
    newsletters: [{ id: NEWS_ID, gaId: GA_B, publisherId: AGENT_B }],
  })
  const routes = registerRoutes(pool)
  const handlers = routes.get('POST /agent/customer-news/:newsId/comments')

  const res = createMockRes()
  await runHandlers(
    handlers,
    {
      user: { id: AGENT_A },
      params: { newsId: NEWS_ID },
      body: { content: '차단되어야 함' },
    },
    res,
  )

  assert.equal(res.statusCode, 404)
})
