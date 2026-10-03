import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { registerAdminAiToolsApi } from './adminAiToolsApi.js'

function createMockGuards() {
  const requireAuth = (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }
  const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'FORBIDDEN' })
      return
    }
    next()
  }
  return { requireAuth, requireSuperAdmin }
}

function invokeGet(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code
        return this
      },
      jsonBody: null,
      json(body) {
        this.jsonBody = body
        resolve(this)
      },
    }
    handler(req, res)
  })
}

describe('admin AI tools API', () => {
  it('registers GET /admin/ai-tools with SUPER_ADMIN guards', () => {
    const routes = []
    const apiRouter = {
      get(path, ...handlers) {
        routes.push({ path, handlers })
      },
    }
    const { requireAuth, requireSuperAdmin } = createMockGuards()
    registerAdminAiToolsApi(apiRouter, { requireAuth, requireSuperAdmin })
    assert.equal(routes.length, 1)
    assert.equal(routes[0].path, '/admin/ai-tools')
    assert.equal(routes[0].handlers[0], requireAuth)
    assert.equal(routes[0].handlers[1], requireSuperAdmin)
  })

  it('SUPER_ADMIN → 200 and registry payload', async () => {
    let handler
    const apiRouter = {
      get(_path, _auth, _super, h) {
        handler = h
      },
    }
    const { requireAuth, requireSuperAdmin } = createMockGuards()
    registerAdminAiToolsApi(apiRouter, { requireAuth, requireSuperAdmin })
    assert.ok(handler)

    const req = { user: { role: 'SUPER_ADMIN' } }
    const res = await invokeGet(
      (r, re) => {
        requireAuth(r, re, () => requireSuperAdmin(r, re, () => handler(r, re)))
      },
      req,
    )
    assert.equal(res.statusCode, 200)
    assert.ok(res.jsonBody.tools.length > 0)
    assert.equal(res.jsonBody.summary.total, res.jsonBody.tools.length)
  })

  it('GA_ADMIN → 403', async () => {
    let handler
    const apiRouter = {
      get(_path, _auth, _super, h) {
        handler = h
      },
    }
    const { requireAuth, requireSuperAdmin } = createMockGuards()
    registerAdminAiToolsApi(apiRouter, { requireAuth, requireSuperAdmin })

    const req = { user: { role: 'GA_ADMIN' } }
    const res = await invokeGet(
      (r, re) => {
        requireAuth(r, re, () => requireSuperAdmin(r, re, () => handler(r, re)))
      },
      req,
    )
    assert.equal(res.statusCode, 403)
  })

  it('일반 USER → 403 (인증 후)', async () => {
    const { requireAuth, requireSuperAdmin } = createMockGuards()
    const res = await invokeGet(
      (r, re) => {
        requireAuth(r, re, () => requireSuperAdmin(r, re, () => re.json({ ok: true })))
      },
      { user: { role: 'USER' } },
    )
    assert.equal(res.statusCode, 403)
  })

  it('미인증 → 401', async () => {
    const { requireAuth } = createMockGuards()
    const res = await invokeGet((r, re) => requireAuth(r, re, () => {}), {})
    assert.equal(res.statusCode, 401)
  })
})
