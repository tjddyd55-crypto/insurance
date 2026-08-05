import { isLossAdjusterSystemBoard } from './lossAdjusterNewsletterBoard.js'

/**
 * 동적 공용/GA 소식지 게시글은 payload.newsletterBoardId(불변 board row id)로 연결한다.
 * slug 는 URL 표현용이며 soft-delete 후 동일 slug 재사용 시 relation FK 로 쓰면 안 된다.
 *
 * @param {string} [alias='n']
 * @param {number} [paramIndex=1]
 */
export function sqlMatchPostsByNewsletterBoardId(alias = 'n', paramIndex = 1) {
  const a = String(alias || 'n').trim() || 'n'
  const idx = Number.isInteger(paramIndex) && paramIndex > 0 ? paramIndex : 1
  return {
    sql: `NULLIF(TRIM(${a}.payload->>'newsletterBoardId'), '') = $${idx}`,
    paramIndex: idx,
  }
}

/**
 * 목록·삭제 영향 집계용 게시글 매칭 조건.
 * 손해사정사 시스템 보드는 기존 newsChannel 계약을 유지한다.
 *
 * @param {Record<string, unknown>} board
 * @param {{ alias?: string, boardIdParamIndex?: number, lossAdjusterChannelParamIndex?: number }} [opts]
 * @returns {{ sql: string, params: string[], usesBoardId: boolean }}
 */
export function buildNewsletterBoardPostMatch(board, opts = {}) {
  const alias = String(opts.alias ?? 'n').trim() || 'n'
  const boardId = String(board.id ?? '').trim()
  if (isLossAdjusterSystemBoard(board)) {
    const idx =
      Number.isInteger(opts.lossAdjusterChannelParamIndex) && Number(opts.lossAdjusterChannelParamIndex) > 0
        ? Number(opts.lossAdjusterChannelParamIndex)
        : 1
    return {
      sql: `COALESCE(NULLIF(TRIM(${alias}.payload->>'newsChannel'), ''), 'INSURER') = $${idx}`,
      params: ['LOSS_ADJUSTER'],
      usesBoardId: false,
    }
  }
  const idx =
    Number.isInteger(opts.boardIdParamIndex) && Number(opts.boardIdParamIndex) > 0
      ? Number(opts.boardIdParamIndex)
      : 1
  const match = sqlMatchPostsByNewsletterBoardId(alias, idx)
  return {
    sql: match.sql,
    params: [boardId],
    usesBoardId: true,
  }
}
