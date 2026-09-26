import { describe, expect, it } from 'vitest'

import { ApiError } from '../../../lib/apiClient'
import { mapCoverageShareCreateError, mapCoverageShareHistoryError } from './mapCoverageShareApiError'

describe('mapCoverageShareApiError', () => {
  it('maps 401 create error without exposing jwt text', () => {
    const message = mapCoverageShareCreateError(new ApiError('인증이 만료되었거나 유효하지 않습니다.', 401))
    expect(message).toContain('로그인이 만료')
    expect(message).not.toContain('유효하지 않습니다')
  })

  it('maps history errors for dialog inline', () => {
    expect(mapCoverageShareHistoryError(new ApiError('x', 403))).toContain('권한')
  })
})
