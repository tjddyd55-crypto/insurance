import { sqlFeedChannelExtraGuards } from '../lib/newsletterFeedChannelSql.js'

/**
 * t299 — 소식지 선택기(바인더 자료 추가 · 개인 폴더 소식지 추가 · 상세 → 바인더 담기)
 * 공통 "열람 가능한 소식지" SSOT.
 *
 * 실제 데이터 모델 (insurance_company_newsletters 단일 테이블)
 *  - 원수사(INSURER): payload.newsChannel = INSURER(기본), n.ga_id = 열람 GA, 동적 보드 표식 없음
 *  - 공용(PUBLIC):   payload.newsChannel = BOARD, payload.newsletterBoardId → newsletter_boards
 *                    board_scope = 'global', n.ga_id IS NULL
 *  - GA(GA):         payload.newsChannel = BOARD, payload.newsletterBoardId → newsletter_boards
 *                    board_scope = 'ga', owner_ga_id = n.ga_id = 로그인 사용자 소속 GA
 *  - system 보드(손해사정사 등)·고객용 소식은 대상 아님.
 *
 * GA 범위는 항상 서버 세션(req.user.gaId)만 쓴다. 승인 대기(PENDING) 사용자는
 * 공용 GENERAL GA 에 머물러 있으므로 신청한 GA 의 GA 소식지에 닿지 않는다.
 */

export const NEWSLETTER_SOURCE_KINDS = /** @type {const} */ (['INSURER', 'GA', 'PUBLIC'])

/** FROM 절 뒤에 붙이는 보드 조인 (alias n → nb). */
export const READABLE_NEWSLETTER_BOARD_JOIN = `
  LEFT JOIN newsletter_boards nb
    ON nb.id = NULLIF(TRIM(n.payload->>'newsletterBoardId'), '')
   AND nb.is_deleted = false
   AND COALESCE(nb.is_active, true) = true
   AND nb.board_scope IN ('global', 'ga')
`

/** 유형 컬럼 SQL (READABLE_NEWSLETTER_BOARD_JOIN 필요). */
export const READABLE_NEWSLETTER_KIND_SQL = `
  CASE
    WHEN nb.board_scope = 'global' THEN 'PUBLIC'
    WHEN nb.board_scope = 'ga' THEN 'GA'
    ELSE 'INSURER'
  END
`

/**
 * 열람 가능 조건 (alias n + nb). gaParam = 로그인 사용자 소속 GA id 자리.
 * @param {string} gaParam
 */
export function readableNewsletterWhere(gaParam) {
  return `
    n.status = 'PUBLISHED'
    AND n.deleted_at IS NULL
    AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    AND COALESCE(NULLIF(TRIM(n.payload->>'insurerSlug'), ''), '') <> 'customer-news'
    AND UPPER(COALESCE(NULLIF(TRIM(n.payload->>'insurerCode'), ''), '')) <> 'CUSTOMER_NEWS'
    AND (
      (
        n.ga_id = ${gaParam}
        AND COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'INSURER'
        ${sqlFeedChannelExtraGuards('INSURER', 'n')}
      )
      OR (
        nb.board_scope = 'global'
        AND n.ga_id IS NULL
        AND UPPER(COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), '')) IN ('BOARD', 'DYNAMIC_BOARD', 'NEWSLETTER_BOARD')
      )
      OR (
        nb.board_scope = 'ga'
        AND nb.owner_ga_id = ${gaParam}
        AND n.ga_id = ${gaParam}
        AND UPPER(COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), '')) IN ('BOARD', 'DYNAMIC_BOARD', 'NEWSLETTER_BOARD')
      )
    )
  `
}

/** @param {unknown} raw */
export function normalizeNewsletterSourceKind(raw) {
  const v = String(raw ?? '').trim().toUpperCase()
  return NEWSLETTER_SOURCE_KINDS.includes(/** @type {any} */ (v)) ? v : null
}
