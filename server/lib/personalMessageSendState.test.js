import assert from 'node:assert/strict'
import test from 'node:test'
import { isPersonalMessageSendDisabled } from '../../src/features/claim-requests/utils/personalMessageSendState.ts'

test('본문만 있으면 발송 가능 (pending 첨부와 무관)', () => {
  assert.equal(
    isPersonalMessageSendDisabled({
      targetCustomerId: 1,
      message: '안녕하세요',
      attachmentCount: 2,
      isEditing: false,
    }),
    false,
  )
})

test('본문·첨부 모두 없으면 발송 불가', () => {
  assert.equal(
    isPersonalMessageSendDisabled({
      targetCustomerId: 1,
      message: '   ',
      attachmentCount: 0,
      isEditing: false,
    }),
    true,
  )
})

test('첨부만 있어도 발송 가능', () => {
  assert.equal(
    isPersonalMessageSendDisabled({
      targetCustomerId: 1,
      message: '',
      attachmentCount: 1,
      isEditing: false,
    }),
    false,
  )
})

test('업로드/발송 처리 중에는 발송 불가', () => {
  assert.equal(
    isPersonalMessageSendDisabled({
      targetCustomerId: 1,
      message: '본문',
      attachmentCount: 0,
      isEditing: false,
      actionBusy: true,
    }),
    true,
  )
})

test('수정 모드는 본문 필수', () => {
  assert.equal(
    isPersonalMessageSendDisabled({
      targetCustomerId: 1,
      message: '',
      attachmentCount: 0,
      isEditing: true,
    }),
    true,
  )
})
