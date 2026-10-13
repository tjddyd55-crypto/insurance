import { describe, expect, it } from 'vitest'
import {
  buildCustomerWorkspaceAuthKey,
  customerWorkspacePathHasCustomerSelection,
  shouldResetCustomerWorkspaceAuth,
} from './customerWorkspaceAuthReset'

describe('customerWorkspaceAuthReset', () => {
  it('동일 사용자 세션 키는 유지한다', () => {
    const key = buildCustomerWorkspaceAuthKey('u1', 'token-abc')
    expect(shouldResetCustomerWorkspaceAuth(key, key)).toBe(false)
  })

  it('사용자 또는 토큰이 바뀌면 리셋한다', () => {
    const prev = buildCustomerWorkspaceAuthKey('user-a', 'token-abc')
    const next = buildCustomerWorkspaceAuthKey('user-b', 'token-abc')
    expect(shouldResetCustomerWorkspaceAuth(prev, next)).toBe(true)
  })

  it('최초 마운트는 리셋하지 않는다', () => {
    expect(shouldResetCustomerWorkspaceAuth(null, buildCustomerWorkspaceAuthKey('u1', 't'))).toBe(false)
  })

  it('고객 id path를 감지한다', () => {
    expect(customerWorkspacePathHasCustomerSelection('/customers/218/files')).toBe(true)
    expect(customerWorkspacePathHasCustomerSelection('/customers')).toBe(false)
  })
})
