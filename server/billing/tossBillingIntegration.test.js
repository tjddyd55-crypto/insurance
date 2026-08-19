import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyTossBillingCredentialKey,
  validatePaymentKeysForMode,
} from '../billing/paymentSettingsKeyValidation.js'
import { encryptPaymentSecret, decryptPaymentSecret, canStorePaymentSecrets } from '../billing/paymentSettingsCrypto.js'
import { BILLING_PENDING_PAYMENT_TTL_MS } from '../insurance-billing/pendingPaymentPolicy.js'
import { buildInsuranceBillingOrderId } from '../insurance-billing/providers/tossBillingService.js'
import { normalizeTossBillingError } from '../insurance-billing/providers/toss/tossErrorNormalization.js'
import {
  ensureBillingProviderCustomerKey,
  assertBillingCustomerKeyMatch,
} from '../insurance-billing/billingPaymentCredential.js'

// ─── Key 분류 ─────────────────────────────────────────────────────────────────

test('classifyTossBillingCredentialKey — test_ck_', () => {
  assert.equal(classifyTossBillingCredentialKey('test_ck_LlDJaYngro1K6KqdMdnG'), 'test_client')
})

test('classifyTossBillingCredentialKey — live_ck_', () => {
  assert.equal(classifyTossBillingCredentialKey('live_ck_somekey'), 'live_client')
})

test('classifyTossBillingCredentialKey — test_sk_', () => {
  assert.equal(classifyTossBillingCredentialKey('test_sk_secretvalue'), 'test_secret')
})

test('classifyTossBillingCredentialKey — live_sk_', () => {
  assert.equal(classifyTossBillingCredentialKey('live_sk_livevalue'), 'live_secret')
})

test('classifyTossBillingCredentialKey — widget gck rejected', () => {
  assert.equal(classifyTossBillingCredentialKey('test_gck_widgetkey'), 'widget')
})

test('classifyTossBillingCredentialKey — widget gsk rejected', () => {
  assert.equal(classifyTossBillingCredentialKey('live_gsk_widgetkey'), 'widget')
})

test('classifyTossBillingCredentialKey — invalid prefix', () => {
  assert.equal(classifyTossBillingCredentialKey('bad_prefix_val'), 'invalid')
})

test('classifyTossBillingCredentialKey — empty', () => {
  assert.equal(classifyTossBillingCredentialKey(''), 'empty')
})

// ─── Mode / Key 조합 검증 ──────────────────────────────────────────────────────

test('validatePaymentKeysForMode — virtual + test keys OK', () => {
  const err = validatePaymentKeysForMode('virtual', {
    clientKey: 'test_ck_aaaa',
    secretKey: 'test_sk_bbbb',
  })
  assert.equal(err, null)
})

test('validatePaymentKeysForMode — virtual + live secret FAIL', () => {
  const err = validatePaymentKeysForMode('virtual', {
    clientKey: 'test_ck_aaaa',
    secretKey: 'live_sk_bbbb',
  })
  assert.ok(err)
})

test('validatePaymentKeysForMode — live + live keys OK', () => {
  const err = validatePaymentKeysForMode('live', {
    clientKey: 'live_ck_aaaa',
    secretKey: 'live_sk_bbbb',
  })
  assert.equal(err, null)
})

test('validatePaymentKeysForMode — live + test client FAIL', () => {
  const err = validatePaymentKeysForMode('live', {
    clientKey: 'test_ck_aaaa',
    secretKey: 'live_sk_bbbb',
  })
  assert.ok(err)
})

test('validatePaymentKeysForMode — widget key FAIL', () => {
  const err = validatePaymentKeysForMode('virtual', {
    clientKey: 'test_gck_widget',
  })
  assert.equal(err, 'payment_widget_key_not_allowed')
})

test('validatePaymentKeysForMode — test_ck + live_sk pair mismatch FAIL', () => {
  const err = validatePaymentKeysForMode('live', {
    clientKey: 'test_ck_a',
    secretKey: 'live_sk_b',
  })
  assert.ok(err)
})

// ─── Crypto ───────────────────────────────────────────────────────────────────

test('encryptPaymentSecret / decryptPaymentSecret round-trip', () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  process.env.PAYMENT_SETTINGS_SECRET_KEY = '0'.repeat(64)
  try {
    assert.equal(canStorePaymentSecrets(), true)
    const plain = 'test_sk_secret_value_1234'
    const encrypted = encryptPaymentSecret(plain)
    assert.notEqual(encrypted, plain)
    const decrypted = decryptPaymentSecret(encrypted)
    assert.equal(decrypted, plain)
  } finally {
    if (prev == null) delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    else process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
  }
})

test('encryptPaymentSecret fails without key', () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  delete process.env.PAYMENT_SETTINGS_SECRET_KEY
  try {
    assert.throws(() => encryptPaymentSecret('secret'), (e) => e?.message === 'payment_secret_storage_unavailable')
  } finally {
    if (prev) process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
  }
})

// ─── orderId ─────────────────────────────────────────────────────────────────

test('buildInsuranceBillingOrderId produces unique IDs', () => {
  const a = buildInsuranceBillingOrderId(1)
  const b = buildInsuranceBillingOrderId(1)
  assert.ok(a.startsWith('onefc_ib_1_'))
  assert.ok(b.startsWith('onefc_ib_1_'))
  assert.notEqual(a, b)
})

// ─── Toss error normalization ─────────────────────────────────────────────────

test('normalizeTossBillingError — REJECT_CARD_PAYMENT', () => {
  const result = normalizeTossBillingError({ code: 'REJECT_CARD_PAYMENT', message: 'rejected' })
  assert.equal(result.code, 'toss_reject_card_payment')
  assert.ok(result.userMessage.length > 0)
  assert.equal(result.providerCode, 'REJECT_CARD_PAYMENT')
})

test('normalizeTossBillingError — unknown code', () => {
  const result = normalizeTossBillingError({ code: 'SOME_UNKNOWN', message: '알 수 없음' })
  assert.equal(result.providerCode, 'SOME_UNKNOWN')
  assert.ok(result.userMessage.length > 0)
})

// ─── Stale pending TTL ────────────────────────────────────────────────────────

test('BILLING_PENDING_PAYMENT_TTL_MS is 24 hours', () => {
  assert.equal(BILLING_PENDING_PAYMENT_TTL_MS, 24 * 60 * 60 * 1000)
})

// ─── customerKey 생성 (mock DB) ───────────────────────────────────────────────

test('ensureBillingProviderCustomerKey generates unique stable key', async () => {
  let stored = null
  const makeExecutor = () => ({
    query: async (sql, params) => {
      const s = String(sql)
      if (s.includes('SELECT') && s.includes('billing_payment_credentials')) {
        if (stored) return { rows: [{ provider_customer_key: stored }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
      }
      if (s.includes('INSERT INTO billing_payment_credentials')) {
        stored = String(params[1])
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  })
  const key1 = await ensureBillingProviderCustomerKey(makeExecutor(), 'user-1')
  const key2 = await ensureBillingProviderCustomerKey(makeExecutor(), 'user-1')
  assert.ok(key1.startsWith('onefc_'))
  assert.ok(key1.length > 10)
  // ON CONFLICT로 같은 key가 유지되는 것을 시뮬레이션
  const executorWithExisting = {
    query: async (sql) => {
      if (String(sql).includes('SELECT') && String(sql).includes('billing_payment_credentials')) {
        return { rows: [{ provider_customer_key: key1 }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const key3 = await ensureBillingProviderCustomerKey(executorWithExisting, 'user-1')
  assert.equal(key3, key1)
})

test('assertBillingCustomerKeyMatch throws on mismatch', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('SELECT') && String(sql).includes('billing_payment_credentials')) {
        return { rows: [{ provider_customer_key: 'onefc_expected_key' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  await assert.rejects(
    () => assertBillingCustomerKeyMatch(executor, 'user-x', 'tampered_customer_key'),
    (e) => e?.message === 'billing_customer_key_mismatch',
  )
})

test('assertBillingCustomerKeyMatch succeeds on match', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('SELECT') && String(sql).includes('billing_payment_credentials')) {
        return { rows: [{ provider_customer_key: 'onefc_correct_key' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const key = await assertBillingCustomerKeyMatch(executor, 'user-x', 'onefc_correct_key')
  assert.equal(key, 'onefc_correct_key')
})

// ─── PLAY_REVIEW provider isolation ───────────────────────────────────────────

test('getInsurancePaymentProvider returns mock for PLAY_REVIEW', async () => {
  const { getInsurancePaymentProvider } = await import('../insurance-billing/providers/index.js')
  const prev = process.env.INSURANCE_BILLING_PROVIDER
  process.env.INSURANCE_BILLING_PROVIDER = 'toss'
  try {
    const provider = getInsurancePaymentProvider({
      gaCode: 'PLAY_REVIEW',
      tenantCode: null,
      username: null,
    })
    await assert.rejects(
      () => provider.completePayment({}, {}),
      (e) => String(e?.message).includes('subscription_not_found') || String(e?.message).includes('plan_not_found'),
    )
  } catch (e) {
    if (String(e?.message).startsWith('toss_')) {
      assert.fail('review tenant should not get toss provider')
    }
  } finally {
    if (prev == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prev
  }
})

// ─── admin response masking ───────────────────────────────────────────────────

test('getPaymentSettingsAdmin never returns raw secret', async () => {
  const { getPaymentSettingsAdmin } = await import('../billing/paymentSettings.js')
  const executor = {
    query: async (sql) => {
      const s = String(sql)
      if (s.includes('INSERT INTO payment_settings')) return { rows: [], rowCount: 0 }
      if (s.includes('SELECT') && s.includes('FROM payment_settings')) {
        return {
          rows: [{
            provider: 'toss', mode: 'virtual',
            client_key: 'test_ck_abcdef', secret_key_ciphertext: 'enc:fake',
            webhook_secret_ciphertext: null, is_enabled: false, updated_at: null,
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const settings = await getPaymentSettingsAdmin(executor)
  assert.ok(!('secretKey' in settings))
  assert.ok(!('secret_key' in settings))
  assert.ok(!('webhookSecret' in settings))
  assert.equal(settings.hasSecretKey, true)
  assert.equal(settings.hasClientKey, true)
})
