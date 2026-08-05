import { systemQuery } from '../utils/dbSafeQuery.js'
import { isLossAdjusterSystemBoard } from './lossAdjusterNewsletterBoard.js'
import { isGlobalBoardScope } from './newsletterBoardScope.js'
import { logSecurityEvent } from './securityAudit.js'

/**
 * @param {Record<string, unknown>} board
 */
function boardSlugKey(board) {
  return String(board.slug ?? '')
    .trim()
    .toLowerCase()
}

/**
 * 게시판 삭제 영향 건수. 게시글·첨부는 soft-delete 대상이 아니며 카운트만 한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Record<string, unknown>} board
 */
export async function loadNewsletterBoardDeleteImpact(executor, board) {
  const boardId = String(board.id ?? '').trim()
  const slug = boardSlugKey(board)
  const isLossAdjuster = isLossAdjusterSystemBoard(board)

  const writerRes = await systemQuery(
    executor,
    `SELECT COUNT(*)::int AS c FROM board_writer_permissions WHERE board_id = $1`,
    [boardId],
  )
  const writerCount = Number(writerRes.rows[0]?.c ?? 0) || 0

  if (!slug && !isLossAdjuster) {
    return { postCount: 0, writerCount, attachmentCount: 0 }
  }

  const boardMatchSql = isLossAdjuster
    ? `COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'LOSS_ADJUSTER'`
    : `LOWER(TRIM(n.payload->>'dynamicBoardSlug')) = $1`
  const postParams = isLossAdjuster ? [] : [slug]

  const postRes = await systemQuery(
    executor,
    `
    SELECT COUNT(*)::int AS c
    FROM insurance_company_newsletters n
    WHERE ${boardMatchSql}
      AND n.deleted_at IS NULL
      AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    `,
    postParams,
  )
  const postCount = Number(postRes.rows[0]?.c ?? 0) || 0

  const attachmentRes = await systemQuery(
    executor,
    `
    SELECT COUNT(*)::int AS c
    FROM insurance_company_newsletter_attachments a
    INNER JOIN insurance_company_newsletters n ON n.id = a.newsletter_id
    WHERE ${boardMatchSql}
      AND n.deleted_at IS NULL
      AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    `,
    postParams,
  )
  const attachmentCount = Number(attachmentRes.rows[0]?.c ?? 0) || 0

  return { postCount, writerCount, attachmentCount }
}

/**
 * 해당 게시판의 작성자 접근 권한만 제거한다. 계정 row 는 보존한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} boardId
 */
export async function revokeAllWriterPermissionsForBoard(executor, boardId) {
  const r = await systemQuery(
    executor,
    `DELETE FROM board_writer_permissions WHERE board_id = $1`,
    [String(boardId)],
  )
  return r.rowCount ?? 0
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   board: Record<string, unknown>
 *   softDeleteSql: string
 *   softDeleteParams: unknown[]
 *   actorUserId?: string | null
 *   actorRole?: string | null
 *   requestId?: string | null
 *   runQuery: (sql: string, params: unknown[]) => Promise<{ rowCount: number, rows: unknown[] }>
 * }} input
 */
export async function softDeleteNewsletterBoardRecord(executor, input) {
  const board = input.board
  const boardId = String(board.id ?? '').trim()
  if (!boardId) {
    return { ok: false, status: 400, code: 'BOARD_NOT_FOUND', message: '공용 소식지를 찾을 수 없습니다.' }
  }
  if (board.is_deleted === true) {
    return {
      ok: false,
      status: 409,
      code: 'BOARD_ALREADY_DELETED',
      message: '이미 삭제된 공용 소식지입니다.',
    }
  }
  if (isLossAdjusterSystemBoard(board)) {
    return {
      ok: false,
      status: 403,
      code: 'BOARD_DELETE_FORBIDDEN',
      message: '기본 손해사정사 소식지는 삭제할 수 없습니다. 사용 중지만 가능합니다.',
    }
  }

  const impact = await loadNewsletterBoardDeleteImpact(executor, board)

  const deleted = await input.runQuery(input.softDeleteSql, input.softDeleteParams)
  if (deleted.rowCount === 0) {
    return {
      ok: false,
      status: 409,
      code: 'BOARD_ALREADY_DELETED',
      message: '이미 삭제된 공용 소식지입니다.',
    }
  }

  const revokedWriterPermissions = await revokeAllWriterPermissionsForBoard(executor, boardId)

  const ownerGaId =
    board.owner_ga_id == null && board.ownerGaId == null
      ? null
      : Number(board.owner_ga_id ?? board.ownerGaId)
  const gaIdForAudit =
    Number.isInteger(ownerGaId) && ownerGaId > 0
      ? ownerGaId
      : isGlobalBoardScope(board)
        ? null
        : null

  await logSecurityEvent(executor, {
    actorUserId: String(input.actorUserId ?? ''),
    actorRole: String(input.actorRole ?? ''),
    action: 'PUBLIC_BOARD_DELETED',
    targetType: 'newsletter_board',
    targetId: boardId,
    gaId: gaIdForAudit,
    meta: {
      boardId,
      boardName: String(board.label ?? ''),
      boardSlug: String(board.slug ?? ''),
      boardScope: String(board.board_scope ?? board.boardScope ?? ''),
      postCount: impact.postCount,
      writerCount: impact.writerCount,
      attachmentCount: impact.attachmentCount,
      revokedWriterPermissions,
      requestId: input.requestId ?? null,
    },
  })

  return {
    ok: true,
    boardId,
    label: String(board.label ?? ''),
    ...impact,
    revokedWriterPermissions,
  }
}
