import assert from 'node:assert/strict'
import test from 'node:test'

import { sendAligoAlimtalk } from '../alimtalk/alimtalkProvider.js'
import { processPendingClaimAlimtalkOutbox } from '../alimtalk/claimReceivedAlimtalk.js'
import { tossApiRequest } from '../insurance-billing/providers/toss/tossHttpClient.js'
import { processPendingPushOutbox } from './push/pushOutboxService.js'

async function withQaSafeMode(operation) {
  const previous = process.env.QA_SAFE_MODE
  process.env.QA_SAFE_MODE = 'true'
  try {
    return await operation()
  } finally {
    if (previous == null) delete process.env.QA_SAFE_MODE
    else process.env.QA_SAFE_MODE = previous
  }
}

test('QA safe mode는 Toss와 알림톡 HTTP 호출 전에 실패한다', async () => {
  let fetchCalls = 0
  const fetchImpl = async () => {
    fetchCalls += 1
    throw new Error('외부 호출이 실행되면 안 됩니다.')
  }
  await withQaSafeMode(async () => {
    await assert.rejects(
      tossApiRequest({ secretKey: 'test', method: 'POST', path: '/v1/test' }),
      /qa_side_effect_blocked:toss.post/,
    )
    await assert.rejects(
      sendAligoAlimtalk({
        config: { dryRun: false, provider: 'aligo' },
        tplCode: 'QA',
        receiver: '00000000000',
        subject: 'QA',
        message: 'QA',
        buttonPayload: { button: [] },
        fetchImpl,
      }),
      /qa_side_effect_blocked:alimtalk.send/,
    )
  })
  assert.equal(fetchCalls, 0)
})

test('QA safe mode worker는 DB와 provider를 호출하지 않는다', async () => {
  let queryCalls = 0
  const pool = { query: async () => { queryCalls += 1 } }
  await withQaSafeMode(async () => {
    assert.deepEqual(await processPendingPushOutbox(pool), {
      processed: 0,
      skipped: true,
      reason: 'qa_safe_mode',
    })
    assert.deepEqual(await processPendingClaimAlimtalkOutbox(pool), {
      processed: 0,
      skipped: true,
      reason: 'qa_safe_mode',
    })
  })
  assert.equal(queryCalls, 0)
})
