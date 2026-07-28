import assert from 'node:assert/strict'
import test from 'node:test'
import {
  maskCrmUserPhone,
  renderCrmUserNoticeTemplate,
  resolveCrmUserBulkSmsRecipients,
} from './crmUserBulkSmsService.js'

test('maskCrmUserPhone masks 11-digit mobile', () => {
  assert.equal(maskCrmUserPhone('01012345678'), '010-****-5678')
  assert.equal(maskCrmUserPhone('010-1234-5678'), '010-****-5678')
})

test('renderCrmUserNoticeTemplate replaces user variables', () => {
  const r = renderCrmUserNoticeTemplate('{사용자명}님({아이디}) / {소속명} — {서비스명}', {
    displayName: '홍길동',
    username: 'hong',
    gaName: '테스트GA',
  })
  assert.equal(r.missingVariables.length, 0)
  assert.equal(r.messageBody, '홍길동님(hong) / 테스트GA — ONE FC')
})

test('resolveCrmUserBulkSmsRecipients excludes no-phone and duplicates', () => {
  const { recipients, summary } = resolveCrmUserBulkSmsRecipients(
    [
      {
        id: 'u1',
        display_name: 'A',
        username: 'a',
        role: 'USER',
        status: 'active',
        is_deleted: false,
        phone_number: '01011112222',
        ga_id: 1,
        ga_company_name: 'GA1',
      },
      {
        id: 'u2',
        display_name: 'B',
        username: 'b',
        role: 'USER',
        status: 'active',
        is_deleted: false,
        phone_number: null,
        ga_id: 1,
        ga_company_name: 'GA1',
      },
      {
        id: 'u3',
        display_name: 'C',
        username: 'c',
        role: 'USER',
        status: 'active',
        is_deleted: false,
        phone_number: '01011112222',
        ga_id: 1,
        ga_company_name: 'GA1',
      },
      {
        id: 'u4',
        display_name: 'D',
        username: 'd',
        role: 'USER',
        status: 'inactive',
        is_deleted: true,
        phone_number: '01033334444',
        ga_id: 1,
        ga_company_name: 'GA1',
      },
    ],
    '점검 안내입니다.',
  )

  assert.equal(summary.eligibleCount, 1)
  assert.equal(summary.exclusionBreakdown.NO_PHONE, 1)
  assert.equal(summary.exclusionBreakdown.DUPLICATE_PHONE, 1)
  assert.equal(summary.exclusionBreakdown.DELETED_USER, 1)
  assert.equal(recipients.filter((r) => r.status === 'PENDING').length, 1)
  assert.equal(recipients.find((r) => r.userId === 'u1')?.status, 'PENDING')
})
