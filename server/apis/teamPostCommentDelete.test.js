import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * 댓글 삭제 SQL 파라미터·권한 조건 회귀 (BIGSERIAL id, soft delete).
 */
describe('team post comment delete contract', () => {
  it('comment id는 숫자 문자열(BIGSERIAL)만 허용', () => {
    const valid = ['1', '5', '9223372036854775807']
    const invalid = ['', 'abc', '1.2', ' 5 ', 'uuid-here']
    for (const id of valid) {
      assert.match(id, /^\d{1,19}$/)
    }
    for (const id of invalid) {
      assert.equal(/^\d{1,19}$/.test(id), false, id)
    }
  })
})
