import { describe, expect, it } from 'vitest'
import {
  MapSdkError,
  mapSdkErrorMessage,
  toMapSdkError,
} from './mapSdkErrors'

describe('mapSdkErrors', () => {
  it('returns user-friendly copy per code', () => {
    expect(mapSdkErrorMessage('missing_client_id')).toMatch(/Client ID/)
    expect(mapSdkErrorMessage('script_load_failed')).toMatch(/Static Map/)
    expect(mapSdkErrorMessage('sdk_global_missing')).toMatch(/SDK 초기화/)
  })

  it('preserves MapSdkError code', () => {
    const error = new MapSdkError('sdk_global_missing')
    expect(toMapSdkError(error).code).toBe('sdk_global_missing')
  })

  it('maps unknown errors to script_load_failed', () => {
    expect(toMapSdkError(new Error('boom')).code).toBe('script_load_failed')
  })
})
