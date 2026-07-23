import { describe, expect, it } from 'vitest'
import {
  buildPolicyHref,
  isPublicLegalPath,
  resolveLegalBackAction,
  resolveLegalClosePath,
  resolveLegalFallbackPath,
  resolveReturnToForPolicyLink,
  sanitizeLegalReturnTo,
} from './legalPageNavigation'

describe('sanitizeLegalReturnTo', () => {
  it('allows internal CRM paths', () => {
    expect(sanitizeLegalReturnTo('/login')).toBe('/login')
    expect(sanitizeLegalReturnTo('/profile')).toBe('/profile')
    expect(sanitizeLegalReturnTo('/customers/12/files')).toBe('/customers/12/files')
    expect(sanitizeLegalReturnTo('/introduction/install')).toBe('/introduction/install')
  })

  it('rejects external and open-redirect shapes', () => {
    expect(sanitizeLegalReturnTo('https://evil.example/x')).toBeNull()
    expect(sanitizeLegalReturnTo('//evil.example')).toBeNull()
    expect(sanitizeLegalReturnTo('javascript:alert(1)')).toBeNull()
    expect(sanitizeLegalReturnTo('/\\evil')).toBeNull()
  })

  it('rejects legal pages to avoid loops', () => {
    expect(sanitizeLegalReturnTo('/terms')).toBeNull()
    expect(sanitizeLegalReturnTo('/privacy?x=1')).toBeNull()
    expect(sanitizeLegalReturnTo('/account-deletion')).toBeNull()
  })
})

describe('resolveLegalBackAction / close', () => {
  it('prefers history when index > 0', () => {
    expect(
      resolveLegalBackAction({
        historyIndex: 2,
        returnTo: '/profile',
        fallbackPath: '/login',
      }),
    ).toEqual({ type: 'history' })
  })

  it('uses returnTo when history is empty', () => {
    expect(
      resolveLegalBackAction({
        historyIndex: 0,
        returnTo: '/profile',
        fallbackPath: '/login',
      }),
    ).toEqual({ type: 'path', path: '/profile' })
  })

  it('falls back when no history and no returnTo', () => {
    expect(
      resolveLegalBackAction({
        historyIndex: null,
        returnTo: null,
        fallbackPath: '/login',
      }),
    ).toEqual({ type: 'path', path: '/login' })
  })

  it('close always uses returnTo or fallback', () => {
    expect(resolveLegalClosePath('/profile', '/login')).toBe('/profile')
    expect(resolveLegalClosePath(null, '/customers')).toBe('/customers')
  })
})

describe('policy link helpers', () => {
  it('builds href with encoded returnTo', () => {
    expect(buildPolicyHref('/terms', '/profile')).toBe('/terms?returnTo=%2Fprofile')
  })

  it('preserves original returnTo across legal cross-links', () => {
    expect(
      resolveReturnToForPolicyLink({
        pathname: '/terms',
        search: '?returnTo=%2Flogin',
        currentReturnTo: '/login',
      }),
    ).toBe('/login')
  })

  it('captures current path when leaving CRM', () => {
    expect(
      resolveReturnToForPolicyLink({
        pathname: '/profile',
        search: '',
      }),
    ).toBe('/profile')
  })

  it('exposes public legal path detection', () => {
    expect(isPublicLegalPath('/terms')).toBe(true)
    expect(isPublicLegalPath('/privacy-policy')).toBe(true)
    expect(isPublicLegalPath('/login')).toBe(false)
    expect(resolveLegalFallbackPath(false)).toBe('/login')
    expect(resolveLegalFallbackPath(true)).toBe('/customers')
  })
})
