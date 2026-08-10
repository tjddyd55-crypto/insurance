import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getCustomerRegistrationCompletedAlimtalkDiagnostics,
  isCustomerRegistrationCompletedRealSendAllowed,
  loadInsuranceAlimtalkConfig,
} from './alimtalkConfig.js'
import {
  buildCustomerRegistrationCompletedDedupeKey,
  formatRegistrationCompletedAtLabel,
} from './customerRegistrationCompletedAlimtalk.js'
import { buildCustomerCrmCheckUrl } from './customerCrmCheckUrl.js'
import {
  CUSTOMER_REGISTRATION_COMPLETED_APPROVED_TEMPLATE,
  buildCustomerRegistrationCompletedButtonPayload,
  buildCustomerRegistrationCompletedMessage,
  resolveCustomerRegistrationCompletedTplCode,
} from './alimtalkTemplates.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('customer registration completed alimtalk template', () => {
  it('uses approved body variables and WL button', () => {
    assert.match(CUSTOMER_REGISTRATION_COMPLETED_APPROVED_TEMPLATE, /#\{고객명\}/)
    assert.match(CUSTOMER_REGISTRATION_COMPLETED_APPROVED_TEMPLATE, /#\{등록일시\}/)
    assert.doesNotMatch(
      CUSTOMER_REGISTRATION_COMPLETED_APPROVED_TEMPLATE,
      /주민|병력|전화번호|주소|http/,
    )

    const message = buildCustomerRegistrationCompletedMessage({
      customerName: '홍길동',
      registeredAtLabel: '2026-08-10 22:45',
    })
    assert.match(message, /홍길동 고객님의 정보 등록이 완료되었습니다/)
    assert.match(message, /등록일시: 2026-08-10 22:45/)
    assert.doesNotMatch(message, /#\{/)

    const buttons = buildCustomerRegistrationCompletedButtonPayload({
      customerCheckUrl: 'http://example.com/customers/42/consultations?customerId=42',
    })
    assert.equal(buttons.button[0].name, '고객 확인하기')
    assert.equal(buttons.button[0].linkType, 'WL')
    assert.equal(
      buttons.button[0].linkMo,
      'https://example.com/customers/42/consultations?customerId=42',
    )
    assert.equal(buttons.button[0].linkPc, buttons.button[0].linkMo)
  })

  it('falls back customer name to 신규 고객', () => {
    assert.match(
      buildCustomerRegistrationCompletedMessage({
        customerName: '  ',
        registeredAtLabel: '2026-01-01 00:00',
      }),
      /신규 고객 고객님/,
    )
  })

  it('requires explicit template code env', () => {
    assert.equal(resolveCustomerRegistrationCompletedTplCode({}), '')
    assert.equal(
      resolveCustomerRegistrationCompletedTplCode({
        INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_COMPLETED_TEMPLATE_CODE: 'UJ_XXXX',
      }),
      'UJ_XXXX',
    )
  })
})

describe('customer registration completed helpers', () => {
  it('formats registered_at as Asia/Seoul YYYY-MM-DD HH:mm', () => {
    assert.equal(
      formatRegistrationCompletedAtLabel('2026-08-10T13:45:00.000Z'),
      '2026-08-10 22:45',
    )
  })

  it('builds stable dedupe key per customer', () => {
    assert.equal(
      buildCustomerRegistrationCompletedDedupeKey({
        customerId: 77,
        recipientUserId: 'agent-1',
      }),
      'reg-complete-alimtalk:77:agent-1',
    )
  })

  it('builds CRM check URL without public registration token', () => {
    const url = buildCustomerCrmCheckUrl({
      customerId: 91,
      origin: 'https://insurance-dev.up.railway.app',
    })
    assert.equal(
      url,
      'https://insurance-dev.up.railway.app/customers/91/consultations?customerId=91',
    )
    assert.doesNotMatch(url, /customer\/register|ref=|secret|token/)
  })

  it('real send requires enabled + template + credentials; development needs allowlist', () => {
    const base = {
      customerRegistrationCompletedEnabled: true,
      customerRegistrationCompletedAllowRealSend: true,
      customerRegistrationCompletedTplCode: 'UJ_TEST',
      apiKey: 'k',
      userId: 'u',
      senderKey: 's',
      sender: '01000000000',
      customerRegistrationCompletedDevRealSendEnabled: false,
      customerRegistrationCompletedDevRecipientAllowlist: [],
    }
    const prevDb = process.env.INSURANCE_DB_ENVIRONMENT
    try {
      process.env.INSURANCE_DB_ENVIRONMENT = 'production'
      assert.equal(
        isCustomerRegistrationCompletedRealSendAllowed(base, {
          receiverDigits: '01011112222',
        }),
        true,
      )
      process.env.INSURANCE_DB_ENVIRONMENT = 'development'
      assert.equal(
        isCustomerRegistrationCompletedRealSendAllowed(base, {
          receiverDigits: '01011112222',
        }),
        false,
      )
      assert.equal(
        isCustomerRegistrationCompletedRealSendAllowed(
          {
            ...base,
            customerRegistrationCompletedDevRealSendEnabled: true,
            customerRegistrationCompletedDevRecipientAllowlist: ['01011112222'],
          },
          { receiverDigits: '01011112222' },
        ),
        true,
      )
    } finally {
      if (prevDb == null) delete process.env.INSURANCE_DB_ENVIRONMENT
      else process.env.INSURANCE_DB_ENVIRONMENT = prevDb
    }
  })

  it('diagnostics never expose secrets', () => {
    const cfg = loadInsuranceAlimtalkConfig({
      INSURANCE_ALIGO_KAKAO_API_KEY: 'secret-key',
      INSURANCE_ALIGO_KAKAO_USER_ID: 'secret-user',
      INSURANCE_ALIGO_KAKAO_SENDER_KEY: 'secret-sender-key',
      INSURANCE_ALIGO_KAKAO_SENDER: '01012345678',
      INSURANCE_CUSTOMER_REGISTRATION_ALIMTALK_ENABLED: 'true',
      INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_COMPLETED_TEMPLATE_CODE: 'UJ_TEST',
    })
    const diag = getCustomerRegistrationCompletedAlimtalkDiagnostics(cfg)
    assert.equal(diag.templateCode, 'UJ_TEST')
    assert.equal(diag.enabled, true)
    const json = JSON.stringify(diag)
    assert.doesNotMatch(json, /secret-key|secret-user|secret-sender/)
    assert.doesNotMatch(json, /01012345678/)
  })
})

describe('customer registration completed wiring', () => {
  it('enqueues only on public invite registration paths after commit', () => {
    const indexSource = readFileSync(join(root, 'server/index.js'), 'utf8')
    assert.match(indexSource, /enqueueCustomerRegistrationCompletedAlimtalk/)
    assert.match(indexSource, /external-invite-registration\/batch/)

    const batchIdx = indexSource.indexOf("apiRouter.post('/customer/external-invite-registration/batch'")
    assert.ok(batchIdx > 0)
    const batchSlice = indexSource.slice(batchIdx, batchIdx + 4500)
    assert.match(batchSlice, /enqueueCustomerRegistrationCompletedAlimtalk/)

    const customersIdx = indexSource.indexOf("apiRouter.post('/customers', requireAuth")
    assert.ok(customersIdx > 0)
    const customersSlice = indexSource.slice(customersIdx, customersIdx + 3500)
    assert.doesNotMatch(customersSlice, /enqueueCustomerRegistrationCompletedAlimtalk/)
  })
})
