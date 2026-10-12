import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

/**
 * 42P08 회귀: `$5 IS NOT NULL` 처럼 타입 문맥 없는 파라미터는 PG가 타입을 추론하지 못해
 * 쿼리 전체가 실패한다. 게시글/댓글 삭제 권한 조건은 명시적 cast 를 유지해야 한다.
 */
describe('team post/comment delete SQL param types', () => {
  const src = readFileSync(new URL('./teamApi.js', import.meta.url), 'utf8')

  it('타입 없는 `$N IS NOT NULL` 파라미터가 없다', () => {
    assert.equal(/\$\d+\s+IS\s+(NOT\s+)?NULL/i.test(src), false)
  })

  it('게시글·댓글 삭제 권한 조건은 text/boolean cast 를 사용한다', () => {
    const cond = /author_user_id = \$4::text\s+OR \(\$5::text IS NOT NULL AND \$4::text = \$5::text\)\s+OR \$6::boolean = true/g
    assert.equal(src.match(cond)?.length, 2)
  })
})
