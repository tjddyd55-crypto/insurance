import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * SUPER_ADMIN newsletter_boards 관리 전용 쿼리.
 *
 * global 소식지(board_scope='global')는 owner_ga_id가 없어 GA 테넌트 필터를 붙일 수 없다.
 * safeQuery는 ga_id / owner_ga_id 스코프가 없으면 차단하므로, 권한 검증을 통과한
 * 관리자 라우트에서만 이 helper로 조회·생성한다.
 *
 * @param {{ query: (text: string, params?: unknown[]) => Promise<unknown> }} executor
 * @param {string} text
 * @param {unknown[]|undefined} params
 */
export async function adminNewsletterBoardQuery(executor, text, params) {
  const sql = String(text).trim()
  if (!/\bnewsletter_boards\b/i.test(sql)) {
    throw new Error('adminNewsletterBoardQuery: newsletter_boards 테이블만 허용합니다.')
  }
  return systemQuery(executor, sql, params)
}
