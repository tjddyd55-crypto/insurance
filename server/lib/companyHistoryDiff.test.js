import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isHistoryContactFieldChanged,
  isHistoryPhoneChanged,
  isHistoryTextChanged,
  pairHistoryContacts,
} from './companyHistoryDiff.js'

describe('companyHistoryDiff', () => {
  it('phone hyphen difference is not changed', () => {
    assert.equal(isHistoryPhoneChanged('010-4757-7209', '01047577209'), false)
    assert.equal(isHistoryPhoneChanged('010 4757 7209', '01047577209'), false)
  })

  it('changed phone is marked changed', () => {
    assert.equal(isHistoryPhoneChanged('010-1111-2222', '010-3333-4444'), true)
  })

  it('changed name is marked changed', () => {
    assert.equal(isHistoryTextChanged('홍길동', '김철수'), true)
    assert.equal(isHistoryTextChanged(' 홍길동 ', '홍길동'), false)
  })

  it('unchanged value is not changed', () => {
    assert.equal(isHistoryTextChanged('고객센터', '고객센터'), false)
    assert.equal(isHistoryPhoneChanged('', ''), false)
  })

  it('newly added contact is marked changed', () => {
    const pairs = pairHistoryContacts(
      [],
      [{ position: '지점장', name: '김철수', phone: '010-1234-5678' }],
    )
    assert.equal(pairs.length, 1)
    assert.equal(pairs[0].isNew, true)
    assert.equal(
      isHistoryContactFieldChanged('name', pairs[0].before, pairs[0].after, { isNew: true }),
      true,
    )
    assert.equal(
      isHistoryContactFieldChanged('phone', pairs[0].before, pairs[0].after, { isNew: true }),
      true,
    )
  })

  it('pairs contacts by position role key', () => {
    const pairs = pairHistoryContacts(
      [{ position: '지점장', name: '이전', phone: '010-1111-1111' }],
      [{ position: '지점장', name: '이후', phone: '010-2222-2222' }],
    )
    assert.equal(pairs.length, 1)
    assert.equal(pairs[0].isNew, false)
    assert.equal(isHistoryTextChanged(pairs[0].before.name, pairs[0].after.name), true)
  })
})
