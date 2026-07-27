import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerPremiumPaymentApi } from './registerPremiumPaymentApi.js'

test('registerPremiumPaymentApi exports a function', () => {
  assert.equal(typeof registerPremiumPaymentApi, 'function')
})

test('registerPremiumPaymentApi accepts router + deps', () => {
  const routes = []
  const apiRouter = {
    get(path, ...handlers) {
      routes.push({ method: 'get', path, handlers })
    },
    post(path, ...handlers) {
      routes.push({ method: 'post', path, handlers })
    },
    patch(path, ...handlers) {
      routes.push({ method: 'patch', path, handlers })
    },
  }
  const requireAuth = (_req, _res, next) => next()
  const handleDbError = () => {}
  registerPremiumPaymentApi(apiRouter, {
    pool: {},
    requireAuth,
    handleDbError,
    JWT_SECRET: 'test-secret',
  })
  const paths = routes.map((r) => `${r.method}:${r.path}`)
  assert.ok(paths.includes('get:/customers/:customerId/premium-payments'))
  assert.ok(paths.includes('post:/customers/:customerId/premium-payments'))
  assert.ok(paths.includes('patch:/customers/:customerId/premium-payments/:paymentId'))
  assert.ok(paths.includes('post:/customers/:customerId/premium-payments/:paymentId/disable'))
  assert.ok(paths.includes('post:/customers/:customerId/premium-payments/:paymentId/enable'))
  assert.ok(paths.includes('get:/premium-payments'))
  assert.ok(paths.includes('post:/customers/:customerId/premium-payments/:paymentId/reauthenticate'))
  assert.ok(paths.includes('post:/customers/:customerId/premium-payments/:paymentId/reveal-card-number'))
})
