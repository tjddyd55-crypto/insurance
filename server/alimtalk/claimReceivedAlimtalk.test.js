import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isClaimReceivedRealSendAllowed,
  loadInsuranceAlimtalkConfig,
  getClaimReceivedAlimtalkDiagnostics,
} from './alimtalkConfig.js'
import {
  buildClaimAlimtalkDedupeKey,
  formatClaimSubmittedAtLabel,
  isClaimAlimtalkPermanentFailure,
} from './claimReceivedAlimtalk.js'
import {
  CLAIM_RECEIVED_APPROVED_TEMPLATE,
  CLAIM_RECEIVED_TPL_CODE,
  buildClaimReceivedButtonPayload,
  buildClaimReceivedMessage,
} from './alimtalkTemplates.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('claim received alimtalk template', () => {
  it('uses UJ_9750 and exact approved body with variables only', () => {
    assert.equal(CLAIM_RECEIVED_TPL_CODE, 'UJ_9750')
    assert.match(CLAIM_RECEIVED_APPROVED_TEMPLATE, /#\{고객명\}/)
    assert.match(CLAIM_RECEIVED_APPROVED_TEMPLATE, /#\{접수일시\}/)
    assert.doesNotMatch(CLAIM_RECEIVED_APPROVED_TEMPLATE, /진단|주민|병력|http|버튼|접수구분/)

    const message = buildClaimReceivedMessage({
      customerName: '홍길동',
      submittedAtLabel: '2026-07-31 17:15',
    })
    assert.match(message, /홍길동 고객님의 새로운 보험 청구가 접수되었습니다/)
    assert.match(message, /접수일시: 2026-07-31 17:15/)
    assert.doesNotMatch(message, /#\{/)
    assert.deepEqual(buildClaimReceivedButtonPayload(), { button: [] })
  })

  it('falls back customer name to 고객', () => {
    assert.match(buildClaimReceivedMessage({ customerName: '  ', submittedAtLabel: '2026-01-01 00:00' }), /^\[ONE FC/)
    assert.match(buildClaimReceivedMessage({ customerName: '', submittedAtLabel: 'x' }), /고객 고객님/)
  })
})

describe('claim received alimtalk formatting and guards', () => {
  it('formats submitted_at as Asia/Seoul YYYY-MM-DD HH:mm', () => {
    // 2026-07-31 08:15 UTC = 17:15 KST
    const label = formatClaimSubmittedAtLabel('2026-07-31T08:15:00.000Z')
    assert.equal(label, '2026-07-31 17:15')
  })

  it('builds stable dedupe key', () => {
    assert.equal(
      buildClaimAlimtalkDedupeKey({ claimRequestId: 99, recipientUserId: 'agent-1' }),
      'claim-alimtalk:99:agent-1',
    )
  })

  it('classifies unapproved template as permanent failure', () => {
    assert.equal(
      isClaimAlimtalkPermanentFailure({
        providerCode: -101,
        providerMessage: '템플릿이 미승인 상태입니다',
      }),
      true,
    )
    assert.equal(
      isClaimAlimtalkPermanentFailure({
        providerCode: null,
        providerMessage: 'provider timeout',
        httpStatus: null,
      }),
      false,
    )
  })

  it('allows production real send with credentials; requires allowlist in development', () => {
    const base = {
      claimReceivedEnabled: true,
      claimReceivedAllowRealSend: true,
      apiKey: 'k',
      userId: 'u',
      senderKey: 's',
      sender: '01000000000',
      claimDevRealSendEnabled: false,
      claimDevRecipientAllowlist: [],
    }
    const prevDb = process.env.INSURANCE_DB_ENVIRONMENT
    const prevRailway = process.env.RAILWAY_ENVIRONMENT_NAME
    try {
      process.env.INSURANCE_DB_ENVIRONMENT = 'production'
      delete process.env.RAILWAY_ENVIRONMENT_NAME
      assert.equal(
        isClaimReceivedRealSendAllowed(base, { nodeEnv: 'production', receiverDigits: '01011112222' }),
        true,
      )
      process.env.INSURANCE_DB_ENVIRONMENT = 'development'
      assert.equal(
        isClaimReceivedRealSendAllowed(base, { nodeEnv: 'production', receiverDigits: '01011112222' }),
        false,
      )

      const withAllow = {
        ...base,
        claimDevRealSendEnabled: true,
        claimDevRecipientAllowlist: ['01011112222'],
      }
      assert.equal(
        isClaimReceivedRealSendAllowed(withAllow, {
          nodeEnv: 'production',
          receiverDigits: '01011112222',
        }),
        true,
      )
      assert.equal(
        isClaimReceivedRealSendAllowed(withAllow, {
          nodeEnv: 'production',
          receiverDigits: '01099998888',
        }),
        false,
      )
    } finally {
      if (prevDb == null) delete process.env.INSURANCE_DB_ENVIRONMENT
      else process.env.INSURANCE_DB_ENVIRONMENT = prevDb
      if (prevRailway == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
      else process.env.RAILWAY_ENVIRONMENT_NAME = prevRailway
    }
  })

  it('diagnostics never expose secrets', () => {
    const cfg = loadInsuranceAlimtalkConfig({
      INSURANCE_ALIGO_KAKAO_API_KEY: 'secret-key',
      INSURANCE_ALIGO_KAKAO_USER_ID: 'secret-user',
      INSURANCE_ALIGO_KAKAO_SENDER_KEY: 'secret-sender-key',
      INSURANCE_ALIGO_KAKAO_SENDER: '01012345678',
      INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_ENABLED: 'true',
      INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_TEMPLATE_CODE: 'UJ_9750',
    })
    const diag = getClaimReceivedAlimtalkDiagnostics(cfg)
    assert.equal(diag.claimTemplateCode, 'UJ_9750')
    assert.equal(diag.kakaoCredentials, 'present')
    const json = JSON.stringify(diag)
    assert.doesNotMatch(json, /secret-key|secret-user|secret-sender/)
    assert.doesNotMatch(json, /01012345678/)
  })
})

describe('claim received alimtalk wiring', () => {
  it('hooks after COMMIT and creates outbox schema', () => {
    const api = readFileSync(join(root, 'server/apis/customerClaimAppApi.js'), 'utf8')
    assert.match(api, /await client\.query\('COMMIT'\)/)
    assert.match(api, /enqueueClaimReceivedAlimtalk/)
    assert.match(api, /void enqueueClaimReceivedAlimtalk/)

    const init = readFileSync(join(root, 'server/initDb.js'), 'utf8')
    assert.match(init, /CREATE TABLE IF NOT EXISTS claim_alimtalk_outbox/)
    assert.match(init, /uq_claim_alimtalk_outbox_dedupe_recipient/)

    const index = readFileSync(join(root, 'server/index.js'), 'utf8')
    assert.match(index, /processPendingClaimAlimtalkOutbox/)
    assert.match(index, /\[claim-alimtalk\] diagnostics/)
  })

  it('does not add SMS failover for claim template', () => {
    const src = readFileSync(join(root, 'server/alimtalk/claimReceivedAlimtalk.js'), 'utf8')
    assert.match(src, /dryRun: false/)
    assert.doesNotMatch(src, /failover:\s*'Y'/)
    assert.doesNotMatch(src, /sendSms|SMS_MODULE/)
  })
})
