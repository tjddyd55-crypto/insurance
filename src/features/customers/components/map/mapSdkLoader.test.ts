import { describe, expect, it } from 'vitest'
import { buildNaverMapScriptUrl } from './mapSdkLoader'

describe('buildNaverMapScriptUrl', () => {
  it('uses ncpKeyId and callback per NAVER Maps JS v3 docs', () => {
    const url = buildNaverMapScriptUrl('test-client-id', 'initCustomerMap')
    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe('https://oapi.map.naver.com/openapi/v3/maps.js')
    expect(parsed.searchParams.get('ncpKeyId')).toBe('test-client-id')
    expect(parsed.searchParams.get('callback')).toBe('initCustomerMap')
    expect(parsed.searchParams.has('ncpClientId')).toBe(false)
    expect(parsed.searchParams.has('govClientId')).toBe(false)
    expect(parsed.searchParams.has('finClientId')).toBe(false)
  })
})
