import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { applyTossBillingAuthIssueResult } from './providers/tossBillingService.js'

const dir = dirname(fileURLToPath(import.meta.url))

test('billing auth issue network path is separated from credential save', () => {
  const service = readFileSync(join(dir, 'providers/tossBillingService.js'), 'utf8')
  assert.match(service, /export async function performTossBillingKeyIssueNetwork/)
  assert.match(service, /export async function applyTossBillingAuthIssueResult/)
  assert.match(service, /export async function confirmTossBillingAuth\(pool/)
})

test('auth-confirm API no longer wraps Toss issue call in BEGIN/COMMIT', () => {
  const api = readFileSync(join(dir, '../registerInsuranceBillingApi.js'), 'utf8')
  const block = api.slice(api.indexOf("apiRouter.post('/billing/payment-methods/auth-confirm'"))
  const nextRoute = block.indexOf("apiRouter.post('/billing/payments/request'")
  const handler = block.slice(0, nextRoute)
  assert.equal(handler.includes("await client.query('BEGIN')"), false)
  assert.match(handler, /confirmTossBillingAuth\(pool/)
})

test('applyTossBillingAuthIssueResult upserts credential idempotently per user', async () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  process.env.PAYMENT_SETTINGS_SECRET_KEY = '0'.repeat(64)
  const queries = []
  const client = {
    async query(sql, params) {
      queries.push(String(sql))
      if (String(sql).includes('INSERT INTO billing_payment_credentials')) {
        return { rowCount: 1 }
      }
      if (String(sql).includes('INSERT INTO billing_events')) {
        return { rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }

  try {
    const first = await applyTossBillingAuthIssueResult(client, {
      userId: 'user-1',
      customerKey: 'onefc_cust_1',
      settingsMode: 'virtual',
      issueRes: {
        ok: true,
        json: {
          billingKey: 'toss_bk_1',
          card: { issuerCode: '신한', number: '1234-****-****-5678' },
        },
      },
    })
    const second = await applyTossBillingAuthIssueResult(client, {
      userId: 'user-1',
      customerKey: 'onefc_cust_1',
      settingsMode: 'virtual',
      issueRes: {
        ok: true,
        json: {
          billingKey: 'toss_bk_2',
          card: { issuerCode: '신한', number: '1234-****-****-9999' },
        },
      },
    })

    assert.equal(first.hasBillingKey, true)
    assert.equal(second.hasBillingKey, true)
    assert.equal(
      queries.filter((sql) => sql.includes('INSERT INTO billing_payment_credentials')).length,
      2,
    )
    assert.match(queries.join('\n'), /ON CONFLICT \(user_id\) DO UPDATE/)
  } finally {
    if (prev == null) delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    else process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
  }
})

test('applyTossBillingAuthIssueResult rejects provider failure before credential write', async () => {
  const client = {
    async query() {
      throw new Error('credential_write_should_not_run')
    },
  }

  await assert.rejects(
    () =>
      applyTossBillingAuthIssueResult(client, {
        userId: 'user-1',
        customerKey: 'onefc_cust_1',
        settingsMode: 'virtual',
        issueRes: { ok: false, status: 400, json: { code: 'INVALID_AUTH_KEY' } },
      }),
    /toss_/,
  )
})
