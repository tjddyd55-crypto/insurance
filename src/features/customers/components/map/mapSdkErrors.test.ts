import { describe, expect, it } from 'vitest'
import {
  MapSdkError,
  mapSdkErrorMessage,
  toMapSdkError,
} from './mapSdkErrors'

describe('mapSdkErrors', () => {
  it('returns user-friendly copy per code', () => {
    expect(mapSdkErrorMessage('missing_client_id')).toMatch(/VITE_NAVER_MAP_CLIENT_ID/)
    expect(mapSdkErrorMessage('naver_auth_failure')).toMatch(/Web Service URL/)
    expect(mapSdkErrorMessage('script_load_failed')).toMatch(/Static Map/)
    expect(mapSdkErrorMessage('sdk_global_missing')).toMatch(/SDK 초기화/)
  })

  it('preserves MapSdkError code', () => {
    const error = new MapSdkError('naver_auth_failure')
    expect(toMapSdkError(error).code).toBe('naver_auth_failure')
  })

  it('maps unknown errors to script_load_failed', () => {
    expect(toMapSdkError(new Error('boom')).code).toBe('script_load_failed')
  })
})
