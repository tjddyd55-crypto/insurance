import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canDeleteNewsletter,
  isGaAdminNewsletterRole,
  GA_ADMIN_NEWSLETTER_ROLES,
} from './newsletterDeletePermission.js'

test('GA 관리자 role 은 작성자가 아니어도 삭제 가능', () => {
  for (const role of GA_ADMIN_NEWSLETTER_ROLES) {
    assert.equal(
      canDeleteNewsletter({ userId: 'admin-1', role }, { publisherId: 'someone-else' }),
      true,
      `${role} 는 GA 범위 소식지를 삭제할 수 있어야 한다`,
    )
  }
})

test('작성자 본인은 일반 role 이어도 삭제 가능', () => {
  assert.equal(
    canDeleteNewsletter({ userId: 'writer-9', role: 'INSURER_MANAGER' }, { publisherId: 'writer-9' }),
    true,
  )
  assert.equal(
    canDeleteNewsletter({ userId: 'writer-9', role: 'USER' }, { publisherId: 'writer-9' }),
    true,
  )
})

test('작성자가 아닌 일반 사용자는 삭제 불가', () => {
  assert.equal(
    canDeleteNewsletter({ userId: 'user-2', role: 'USER' }, { publisherId: 'writer-9' }),
    false,
  )
  assert.equal(
    canDeleteNewsletter({ userId: 'mgr-2', role: 'INSURER_MANAGER' }, { publisherId: 'writer-9' }),
    false,
  )
})

test('userId 가 없으면 삭제 불가', () => {
  assert.equal(canDeleteNewsletter({ userId: '', role: 'GA_ADMIN' }, { publisherId: 'x' }), false)
  assert.equal(canDeleteNewsletter({ userId: null, role: 'GA_ADMIN' }, { publisherId: 'x' }), false)
})

test('publisherId 가 비어 있으면 관리자만 삭제 가능', () => {
  assert.equal(canDeleteNewsletter({ userId: 'u1', role: 'USER' }, { publisherId: '' }), false)
  assert.equal(canDeleteNewsletter({ userId: 'u1', role: 'GA_ADMIN' }, { publisherId: '' }), true)
})

test('publisherId 는 문자열 비교로 일치해야 하며 공백은 무시된다', () => {
  assert.equal(
    canDeleteNewsletter({ userId: 'writer-9', role: 'USER' }, { publisherId: '  writer-9  ' }),
    true,
  )
})

test('isGaAdminNewsletterRole 는 알려진 관리자 role 만 true', () => {
  assert.equal(isGaAdminNewsletterRole('GA_ADMIN'), true)
  assert.equal(isGaAdminNewsletterRole('GA_STAFF'), true)
  assert.equal(isGaAdminNewsletterRole('SUPER_ADMIN'), true)
  assert.equal(isGaAdminNewsletterRole('USER'), false)
  assert.equal(isGaAdminNewsletterRole('INSURER_MANAGER'), false)
  assert.equal(isGaAdminNewsletterRole(''), false)
  assert.equal(isGaAdminNewsletterRole(undefined), false)
})
