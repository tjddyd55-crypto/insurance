import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOMER_CUSTOM_FIELD_LABEL_MAX,
  CUSTOMER_CUSTOM_FIELD_VALUE_MAX,
  registerCustomerCustomFieldsApi,
} from './customerCustomFieldsApi.js'

test('registerCustomerCustomFieldsApi exports a function', () => {
  assert.equal(typeof registerCustomerCustomFieldsApi, 'function')
})

test('registerCustomerCustomFieldsApi accepts router + deps', () => {
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
  registerCustomerCustomFieldsApi(apiRouter, { pool: {}, requireAuth, handleDbError })
  assert.ok(calls.length >= 4)
  assert.ok(calls.some(([method, path]) => method === 'get' && path.includes('custom-fields')))
})

test('custom field length limits are defined', () => {
  assert.equal(CUSTOMER_CUSTOM_FIELD_LABEL_MAX, 100)
  assert.equal(CUSTOMER_CUSTOM_FIELD_VALUE_MAX, 1000)
})
