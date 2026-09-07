/**
 * 기존 이용자 결제수단 등록(register-only) 관련 단위 테스트.
 * 핵심 정책: 기존 이용자가 카드를 등록해도 즉시 charge가 발생하지 않는다.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { requestTossInsurancePayment } from '../insurance-billing/providers/tossBillingService.js'

function asBillingPool(executor) {
  return {
    connect: async () => ({
      query: executor.query.bind(executor),
      release() {},
    }),
  }
}

// ─── checkout mode 분류 — legacy_entitled 정책 ────────────────────────────────
// frontend billingCheckoutViewState.ts 의 resolveBillingCheckoutMode 로직 미러

function resolveBillingCheckoutMode(status) {
  const s = String(status ?? '').trim().toLowerCase()
  if (['expired', 'blocked', 'past_due', 'canceled', 'cancelled', 'inactive'].includes(s)) return 'payment_required'
  if (['pending_payment', 'pending', 'none', ''].includes(s)) return 'pending_payment'
  if (s === 'trialing' || s === 'trial') return 'trialing'
  if (s === 'active_paid' || s === 'paid') return 'active_paid'
  if (['legacy_active', 'active', 'active_manual', 'free'].includes(s)) return 'legacy_entitled'
  return 'pending_payment'
}

test('legacy_active → legacy_entitled mode', () => {
  assert.equal(resolveBillingCheckoutMode('legacy_active'), 'legacy_entitled')
})

test('active → legacy_entitled mode', () => {
  assert.equal(resolveBillingCheckoutMode('active'), 'legacy_entitled')
})

test('active_manual → legacy_entitled mode', () => {
  assert.equal(resolveBillingCheckoutMode('active_manual'), 'legacy_entitled')
})

test('active_paid → active_paid mode (not legacy)', () => {
  assert.equal(resolveBillingCheckoutMode('active_paid'), 'active_paid')
})

test('trialing → trialing mode', () => {
  assert.equal(resolveBillingCheckoutMode('trialing'), 'trialing')
})

// ─── register-only 서버 정책 ─────────────────────────────────────────────────

function makeSettingsExecutor(hasBillingKey) {
  return {
    _insertCalled: false,
    async query(sql) {
      const s = String(sql)
      if (s.includes('PAYMENT_SETTINGS_SECRET_KEY')) return { rows: [], rowCount: 0 }
      if (s.includes('FROM payment_settings')) {
        // PAYMENT_SETTINGS_SECRET_KEY 필요 — 미리 env 세팅됨
        const { encryptPaymentSecret } = await import('../billing/paymentSettingsCrypto.js')
        return {
          rows: [{
            provider: 'toss', mode: 'virtual',
            client_key: 'test_ck_x',
            secret_key_ciphertext: encryptPaymentSecret('test_sk_y'),
            webhook_secret_ciphertext: null,
            is_enabled: true, updated_at: null,
          }],
          rowCount: 1,
        }
      }
      if (s.includes('FROM billing_payment_credentials')) {
        if (!hasBillingKey) return { rows: [], rowCount: 0 }
        const { encryptPaymentSecret } = await import('../billing/paymentSettingsCrypto.js')
        return {
          rows: [{
            provider_customer_key: 'onefc_cust_abc',
            billing_key_ciphertext: encryptPaymentSecret('toss_bk_fake'),
            card_company: '신한',
            card_number_masked: '1234-****-****-5678',
            card_type: null,
            status: 'active',
          }],
          rowCount: 1,
        }
      }
      // INSERT 감지
      if (s.includes('INSERT INTO billing_payments')) {
        this._insertCalled = true
        return { rows: [{ id: 999 }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

test('register-only + billingKey 있음 → registeredOnly=true, charge 없음', async () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  process.env.PAYMENT_SETTINGS_SECRET_KEY = '0'.repeat(64)
  try {
    const executor = makeSettingsExecutor(true)
    const result = await requestTossInsurancePayment(asBillingPool(executor), {
      userId: 'user-legacy',
      planCode: 'insurance_basic',
      billingCycle: 'monthly',
      registerOnly: true,
    })
    assert.equal(result.registeredOnly, true)
    assert.equal(result.hasBillingKey, true)
    assert.equal(result.needsBillingAuth, false)
    assert.equal(executor._insertCalled, false, 'billing_payments INSERT 발생 금지')
  } finally {
    if (prev == null) delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    else process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
  }
})

test('register-only + billingKey 없음 → needsBillingAuth=true (Toss auth 필요)', async () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  process.env.PAYMENT_SETTINGS_SECRET_KEY = '0'.repeat(64)
  try {
    const executor = makeSettingsExecutor(false)
    const result = await requestTossInsurancePayment(asBillingPool(executor), {
      userId: 'user-no-key',
      planCode: 'insurance_basic',
      billingCycle: 'monthly',
      registerOnly: true,
    })
    assert.equal(result.needsBillingAuth, true)
    assert.equal(result.hasBillingKey, false)
    assert.equal(executor._insertCalled, false, 'billing_payments INSERT 발생 금지')
  } finally {
    if (prev == null) delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    else process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
  }
})

// ─── canRunTestCharge 노출 조건 (frontend 로직 미러) ─────────────────────────

function canRunTestCharge(cfg, hasBillingKey) {
  return (
    Boolean(cfg?.allowDevTestCharge) &&
    cfg?.mode === 'virtual' &&
    cfg?.provider === 'toss' &&
    Boolean(cfg?.enabled) &&
    hasBillingKey
  )
}

const DEV_QA_CFG = { mode: 'virtual', provider: 'toss', enabled: true, allowDevTestCharge: true }

test('canRunTestCharge — toss + virtual + enabled + billingKey + allowDevTestCharge → true', () => {
  assert.equal(canRunTestCharge(DEV_QA_CFG, true), true)
})

test('canRunTestCharge — production allowDevTestCharge=false → false (virtual이어도 숨김)', () => {
  assert.equal(
    canRunTestCharge({ mode: 'virtual', provider: 'toss', enabled: true, allowDevTestCharge: false }, true),
    false,
  )
})

test('canRunTestCharge — mode=live → false (production 차단)', () => {
  assert.equal(canRunTestCharge({ ...DEV_QA_CFG, mode: 'live' }, true), false)
})

test('canRunTestCharge — provider=mock → false', () => {
  assert.equal(canRunTestCharge({ ...DEV_QA_CFG, provider: 'mock' }, true), false)
})

test('canRunTestCharge — enabled=false → false', () => {
  assert.equal(canRunTestCharge({ ...DEV_QA_CFG, enabled: false }, true), false)
})

test('canRunTestCharge — hasBillingKey=false → false (카드 없으면 charge 버튼 없음)', () => {
  assert.equal(canRunTestCharge(DEV_QA_CFG, false), false)
})

test('canRunTestCharge — cfg=null → false', () => {
  assert.equal(canRunTestCharge(null, true), false)
})

// ─── register-only=false + billingKey 있음 ───────────────────────────────────

test('register-only=false + billingKey 있음 → createPendingPayment 진행 (실제 charge 시도)', async () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  process.env.PAYMENT_SETTINGS_SECRET_KEY = '0'.repeat(64)
  try {
    const executor = makeSettingsExecutor(true)
    // charge 경로 진입 → subscription/plan 조회 등 추가 쿼리 발생
    // 실제 Toss 호출은 mock하지 않으므로 network error 예상 — 그것이 목적
    // 여기서는 subscription 없음으로 plan_not_found / subscription_not_found 에러가 예상됨
    await assert.rejects(
      () => requestTossInsurancePayment(asBillingPool(executor), {
        userId: 'user-legacy',
        planCode: 'insurance_basic',
        billingCycle: 'monthly',
        registerOnly: false,
      }),
      (e) => {
        // subscription이 없으므로 에러 발생 — charge 경로에 진입했음을 간접 확인
        return ['subscription_not_found', 'plan_not_found'].includes(e?.message)
      },
    )
  } finally {
    if (prev == null) delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    else process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
  }
})
