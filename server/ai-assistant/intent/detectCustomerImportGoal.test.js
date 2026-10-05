import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectCustomerImportGoal } from './detectBusinessToolHint.js'

describe('detectCustomerImportGoal', () => {
  it('does not treat filtered customer list as import', () => {
    assert.equal(detectCustomerImportGoal('남자 고객리스트 줘봐'), false)
    assert.equal(detectCustomerImportGoal('여자 고객 리스트 줘봐'), false)
  })

  it('still detects real import intent', () => {
    assert.equal(detectCustomerImportGoal('이 엑셀로 고객 등록해줘'), true)
  })
})
