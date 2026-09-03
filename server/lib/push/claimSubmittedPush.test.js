import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildClaimSubmittedInternalMessage,
  buildClaimSubmittedPushCopy,
  CLAIM_SUBMITTED_EVENT,
  resolveClaimPushPayloadType,
} from './claimSubmittedPush.js'
import { resolveClaimPushEventKind, shouldDeliverAppPush } from './pushPreferenceGate.js'

describe('claimSubmittedPush copy', () => {
  it('builds push title/body without sensitive fields', () => {
    const withName = buildClaimSubmittedPushCopy({ customerName: '홍길동', hasFiles: false })
    assert.equal(withName.title, '보험금 청구 요청')
    assert.equal(withName.body, '홍길동 고객의 청구 요청이 도착했습니다.')
    assert.doesNotMatch(withName.body, /주민|진단|증권|전화/)

    const withFiles = buildClaimSubmittedPushCopy({
      customerName: '홍길동',
      hasFiles: true,
      submissionKind: 'CLAIM_FILE_UPLOADED',
    })
    assert.equal(withFiles.title, '고객 파일 등록')
    assert.equal(withFiles.body, '홍길동 고객이 새 파일을 등록했습니다.')

    const inquiry = buildClaimSubmittedPushCopy({
      customerName: '홍길동',
      hasFiles: false,
      submissionKind: 'CLAIM_INQUIRY_CREATED',
    })
    assert.equal(inquiry.title, '고객 문의 등록')
    assert.equal(inquiry.body, '홍길동 고객의 새 문의가 도착했습니다.')
  })

  it('builds internal notification message', () => {
    assert.equal(
      buildClaimSubmittedInternalMessage({ customerName: '김고객', hasFiles: false }),
      '김고객 고객이 청구 내용을 등록했습니다.',
    )
  })

  it('uses CUSTOMER_CLAIM_SUBMITTED event type', () => {
    assert.equal(CLAIM_SUBMITTED_EVENT, 'CUSTOMER_CLAIM_SUBMITTED')
  })

  it('maps payload types for deep links', () => {
    assert.equal(resolveClaimPushPayloadType({ hasFiles: true }), 'CUSTOMER_FILE_CREATED')
    assert.equal(
      resolveClaimPushPayloadType({ hasFiles: false, submissionKind: 'CLAIM_INQUIRY_CREATED' }),
      'CUSTOMER_INQUIRY_CREATED',
    )
    assert.equal(resolveClaimPushPayloadType({ hasFiles: false }), 'CLAIM_CREATED')
  })
})

describe('pushPreferenceGate', () => {
  const allOn = {
    appPush: { enabled: true },
    newCustomer: { enabled: true },
    claimRequest: { enabled: true },
    customerAppFile: { enabled: true },
    workAlert: { enabled: true },
  }

  it('blocks when master app push is off', () => {
    assert.equal(shouldDeliverAppPush({ ...allOn, appPush: { enabled: false } }, 'claim'), false)
  })

  it('respects per-event toggles', () => {
    assert.equal(shouldDeliverAppPush({ ...allOn, claimRequest: { enabled: false } }, 'claim'), false)
    assert.equal(
      shouldDeliverAppPush({ ...allOn, customerAppFile: { enabled: false } }, 'customer_app_file'),
      false,
    )
    assert.equal(shouldDeliverAppPush(allOn, 'claim'), true)
  })

  it('resolves claim event kind from files/inquiry', () => {
    assert.equal(resolveClaimPushEventKind({ hasFiles: true }), 'customer_app_file')
    assert.equal(
      resolveClaimPushEventKind({ hasFiles: false, submissionKind: 'CLAIM_INQUIRY_CREATED' }),
      'customer_app_file',
    )
    assert.equal(resolveClaimPushEventKind({ hasFiles: false }), 'claim')
  })
})
