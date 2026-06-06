import assert from 'node:assert/strict'
import test from 'node:test'
import { registerCustomerMapApi } from './customerMapApi.js'

test('registerCustomerMapApi exports a function', () => {
  assert.equal(typeof registerCustomerMapApi, 'function')
})

test('registerCustomerMapApi registers GET /customers/map', () => {
  /** @type {Array<{ method: string; path: string }>} */
  const routes = []
  const apiRouter = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path })
      return apiRouter
    },
  }
  registerCustomerMapApi(apiRouter, {
    pool: {},
    requireAuth: (_req, _res, next) => next?.(),
    handleDbError: () => {},
    requireInsuranceFormUserId: () => 'u',
  })
  assert.ok(routes.some((r) => r.path === '/customers/map'))
})
