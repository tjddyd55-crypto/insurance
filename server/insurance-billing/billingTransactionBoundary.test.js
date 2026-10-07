import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))

test('toss billing charge network path is separated from DB apply path', () => {
  const service = readFileSync(join(dir, 'providers/tossBillingService.js'), 'utf8')
  assert.match(service, /export async function performTossBillingChargeNetwork/)
  assert.match(service, /export async function applyTossBillingChargeResult/)
  assert.match(service, /export async function runTossBillingChargeOutsideTransaction/)
  assert.match(service, /withShortBillingTransaction/)
})

test('payment request API no longer wraps toss provider call in BEGIN/COMMIT', () => {
  const api = readFileSync(join(dir, '../registerInsuranceBillingApi.js'), 'utf8')
  const block = api.slice(api.indexOf("apiRouter.post('/billing/payments/request'"))
  const nextRoute = block.indexOf("apiRouter.get('/billing/manage/summary'")
  const handler = block.slice(0, nextRoute)
  assert.equal(handler.includes("await client.query('BEGIN')"), false)
  assert.match(handler, /provider\.requestPayment\(pool/)
})

test('reconcile service uses Toss order lookup and idempotent finalize', () => {
  const reconcile = readFileSync(join(dir, 'reconcileInsurancePayment.js'), 'utf8')
  assert.match(reconcile, /getTossPaymentByOrderId/)
  assert.match(reconcile, /finalizeReconciledTossPayment/)
  assert.match(reconcile, /finalizeInsurancePaymentAsPaid/)
})
