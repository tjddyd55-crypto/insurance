import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../lib/apiClient'
import { teamContentUserMessage } from './teamContentMessages'

describe('teamContentUserMessage', () => {
  it('maps DB_ERROR to friendly fallback', () => {
    expect(
      teamContentUserMessage(new ApiError('DB_ERROR', 500), '댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
    ).toBe('댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('keeps server business messages', () => {
    expect(teamContentUserMessage(new ApiError('댓글을 찾을 수 없습니다.', 404), 'fallback')).toBe(
      '댓글을 찾을 수 없습니다.',
    )
  })
})
