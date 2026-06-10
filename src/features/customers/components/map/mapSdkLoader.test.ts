import { describe, expect, it } from 'vitest'
import { buildNaverMapScriptUrl, isLegacyNaverScriptUrl } from './mapSdkLoader'

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

describe('isLegacyNaverScriptUrl', () => {
  it('flags legacy client id query keys', () => {
    expect(isLegacyNaverScriptUrl('https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=abc')).toBe(true)
    expect(isLegacyNaverScriptUrl('https://oapi.map.naver.com/openapi/v3/maps.js?govClientId=abc')).toBe(true)
    expect(isLegacyNaverScriptUrl('https://oapi.map.naver.com/openapi/v3/maps.js?finClientId=abc')).toBe(true)
  })

  it('requires ncpKeyId and callback', () => {
    expect(
      isLegacyNaverScriptUrl('https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=abc&callback=init'),
    ).toBe(false)
    expect(isLegacyNaverScriptUrl('https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=abc')).toBe(true)
  })
})
