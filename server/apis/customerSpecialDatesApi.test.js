import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCustomerSpecialDatesApi } from './customerSpecialDatesApi.js'

test('registerCustomerSpecialDatesApi exports a function', () => {
  assert.equal(typeof registerCustomerSpecialDatesApi, 'function')
})

test('registerCustomerSpecialDatesApi accepts router + deps', () => {
  const calls = []
  const apiRouter = {
    get(path, ...handlers) {
      calls.push(['get', path, handlers.length])
    },
    post(path, ...handlers) {
      calls.push(['post', path, handlers.length])
    },
    patch(path, ...handlers) {
      calls.push(['patch', path, handlers.length])
    },
    delete(path, ...handlers) {
      calls.push(['delete', path, handlers.length])
    },
  }
  const requireAuth = () => () => {}
  const handleDbError = () => {}
  registerCustomerSpecialDatesApi(apiRouter, { pool: {}, requireAuth, handleDbError })
  assert.ok(calls.length >= 4)
  assert.ok(calls.some(([method, path]) => method === 'get' && path.includes('special-dates')))
})
