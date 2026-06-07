import { describe, expect, it } from 'vitest'
import { maskClientKey, sanitizeNaverUrl } from './naverMapAuthDiagnostics'

describe('maskClientKey', () => {
  it('masks client id without exposing full value', () => {
    expect(maskClientKey('n7b2j2h4yo')).toBe('n7b…(len 10)')
    expect(maskClientKey('')).toBe('(empty)')
  })
})

describe('sanitizeNaverUrl', () => {
  it('masks sensitive query params in naver urls', () => {
    const sanitized = sanitizeNaverUrl(
      'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=n7b2j2h4yo&callback=init',
    )
    expect(sanitized).toContain('ncpKeyId=n7b')
    expect(sanitized).not.toContain('n7b2j2h4yo')
    expect(sanitized).toContain('callback=init')
  })
})
