import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  clearAligoTemplateStatusCache,
  normalizeAligoTemplateInspectionStatus,
  resolveCustomerRegistrationTemplateSendGate,
  summarizeAligoTemplate,
} from './alimtalkTemplateStatus.js'

describe('alimtalkTemplateStatus', () => {
  beforeEach(() => {
    clearAligoTemplateStatusCache()
  })

  it('normalizes inspection statuses', () => {
    assert.equal(normalizeAligoTemplateInspectionStatus('apr'), 'APR')
    assert.equal(normalizeAligoTemplateInspectionStatus('REQ'), 'REQ')
    assert.equal(normalizeAligoTemplateInspectionStatus('REG'), 'REQ')
    assert.equal(normalizeAligoTemplateInspectionStatus('REJ'), 'REJ')
  })

  it('summarizes template without secrets', () => {
    const summary = summarizeAligoTemplate({
      templtCode: 'UK_2268',
      name: 'ONE FC 고객등록 완료 알림',
      inspStatus: 'REQ',
      templtContent: '#{고객명}\n#{등록일시}',
      buttons: [{ name: '고객 확인하기', linkType: 'WL' }],
    })
    assert.equal(summary?.templtCode, 'UK_2268')
    assert.equal(summary?.inspStatus, 'REQ')
    assert.match(String(summary?.templtContent), /#\{고객명\}/)
  })

  it('blocks send while REQ and marks terminal skip (no later batch)', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          code: 0,
          list: [{ templtCode: 'UK_2268', inspStatus: 'REQ', name: 'ONE FC 고객등록 완료 알림' }],
        })
      },
    })
    const gate = await resolveCustomerRegistrationTemplateSendGate(
      {
        apiKey: 'k',
        userId: 'u',
        senderKey: 's',
        sender: '01000000000',
        useGateway: false,
        sendTimeoutMs: 3000,
        gatewayUrl: '',
        gatewayToken: '',
      },
      'UK_2268',
      { fetchImpl, bypassCache: true },
    )
    assert.equal(gate.allowSend, false)
    assert.equal(gate.terminalSkip, true)
    assert.equal(gate.reason, 'SKIPPED_TEMPLATE_NOT_APPROVED')
    assert.equal(gate.templateStatus, 'REQ')
  })

  it('allows send only when APR', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          code: 0,
          list: [{ templtCode: 'UK_2268', inspStatus: 'APR', name: 'ONE FC 고객등록 완료 알림' }],
        })
      },
    })
    const gate = await resolveCustomerRegistrationTemplateSendGate(
      {
        apiKey: 'k',
        userId: 'u',
        senderKey: 's',
        sender: '01000000000',
        useGateway: false,
        sendTimeoutMs: 3000,
        gatewayUrl: '',
        gatewayToken: '',
      },
      'UK_2268',
      { fetchImpl, bypassCache: true },
    )
    assert.equal(gate.allowSend, true)
    assert.equal(gate.reason, null)
    assert.equal(gate.templateStatus, 'APR')
  })

  it('rejects REJ permanently', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          code: 0,
          list: [{ templtCode: 'UK_2268', inspStatus: 'REJ' }],
        })
      },
    })
    const gate = await resolveCustomerRegistrationTemplateSendGate(
      {
        apiKey: 'k',
        userId: 'u',
        senderKey: 's',
        sender: '01000000000',
        useGateway: false,
        sendTimeoutMs: 3000,
        gatewayUrl: '',
        gatewayToken: '',
      },
      'UK_2268',
      { fetchImpl, bypassCache: true },
    )
    assert.equal(gate.allowSend, false)
    assert.equal(gate.terminalSkip, true)
    assert.equal(gate.reason, 'TEMPLATE_REJECTED')
  })

  it('fails closed when status API unavailable (non-terminal retry)', async () => {
    const fetchImpl = async () => {
      throw new Error('network down')
    }
    const gate = await resolveCustomerRegistrationTemplateSendGate(
      {
        apiKey: 'k',
        userId: 'u',
        senderKey: 's',
        sender: '01000000000',
        useGateway: false,
        sendTimeoutMs: 3000,
        gatewayUrl: '',
        gatewayToken: '',
      },
      'UK_2268',
      { fetchImpl, bypassCache: true },
    )
    assert.equal(gate.allowSend, false)
    assert.equal(gate.terminalSkip, false)
    assert.equal(gate.reason, 'TEMPLATE_STATUS_UNAVAILABLE')
  })

  it('caches status for subsequent calls within TTL', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            code: 0,
            list: [{ templtCode: 'UK_2268', inspStatus: 'REQ' }],
          })
        },
      }
    }
    const config = {
      apiKey: 'k',
      userId: 'u',
      senderKey: 's',
      sender: '01000000000',
      useGateway: false,
      sendTimeoutMs: 3000,
      gatewayUrl: '',
      gatewayToken: '',
    }
    await resolveCustomerRegistrationTemplateSendGate(config, 'UK_2268', {
      fetchImpl,
      bypassCache: true,
      nowMs: 1_000,
    })
    await resolveCustomerRegistrationTemplateSendGate(config, 'UK_2268', {
      fetchImpl,
      nowMs: 1_000 + 60_000,
    })
    assert.equal(calls, 1)
  })
})
