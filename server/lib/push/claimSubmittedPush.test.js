import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildClaimSubmittedInternalMessage,
  buildClaimSubmittedPushCopy,
  CLAIM_SUBMITTED_EVENT,
} from './claimSubmittedPush.js'

describe('claimSubmittedPush copy', () => {
  it('builds push title/body without sensitive fields', () => {
    const withName = buildClaimSubmittedPushCopy({ customerName: '홍길동', hasFiles: false })
    assert.equal(withName.title, '새로운 보험 청구가 접수되었습니다.')
    assert.equal(withName.body, '홍길동 고객이 청구 내용을 등록했습니다.')
    assert.doesNotMatch(withName.body, /주민|진단|증권|전화/)

    const withFiles = buildClaimSubmittedPushCopy({ customerName: '홍길동', hasFiles: true })
    assert.equal(withFiles.body, '홍길동 고객이 청구 파일을 등록했습니다.')

    const anon = buildClaimSubmittedPushCopy({ customerName: '', hasFiles: false })
    assert.equal(anon.body, '고객앱에서 새로운 청구가 접수되었습니다.')
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
})
