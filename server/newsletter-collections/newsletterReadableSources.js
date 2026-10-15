import { sqlFeedChannelExtraGuards } from '../lib/newsletterFeedChannelSql.js'

/**
 * t299/t306 — 소식지 선택기(바인더 자료 추가 · 개인 폴더 소식지 추가 · 상세 → 바인더 담기)
 * 공통 "열람 가능한 소식지" SSOT.
 *
 * t306: 소식지 메인(SSOT)과 동일한 규칙을 그대로 따른다. 보드 이름·하드코딩 문자열로 분류하지 않는다.
 *  - 원수사(INSURER): 소식지 메인 원수사 피드와 동일
 *      n.ga_id = 열람 GA, newsChannel = INSURER(기본) + sqlFeedChannelExtraGuards('INSURER')
 *  - 보드 글: 소식지 메뉴 보드 목록(NEWSLETTER_BOARDS_VISIBLE_LIST_SQL)과 같은 보드 가시성 +
 *      보드 피드(buildNewsletterBoardPostMatch / buildDynamicBoardPostGaFilter)와 같은 글 매칭
 *      · system_key = LOSS_ADJUSTER 보드 → newsChannel = LOSS_ADJUSTER 글 (손해사정사 채널)
 *      · 그 밖의 보드 → payload.newsletterBoardId = 보드 id (newsChannel 무관)
 *      · 공용(global/system) 보드 → n.ga_id IS NULL / GA 보드 → n.ga_id = owner_ga_id
 *      · 비활성 보드는 일반 사용자 피드가 비어 있으므로 제외 (손해사정사 비활성 GA 포함)
 *      · GA 보드는 owner_ga_id = 로그인 사용자 소속 GA 일 때만 (타 GA·승인대기 차단)
 *  - 유형: global/system → PUBLIC, ga → GA, 보드 없음 → INSURER
 *
 * GA 범위는 항상 서버 세션(req.user.gaId)만 쓴다. 승인 대기(PENDING) 사용자는
 * 공용 GENERAL GA 에 머물러 있으므로 신청한 GA 의 GA 소식지에 닿지 않는다.
 */

export const NEWSLETTER_SOURCE_KINDS = /** @type {const} */ (['INSURER', 'GA', 'PUBLIC'])

/**
 * FROM 절 뒤에 붙이는 보드 조인 (alias n → nb). 글이 속한 보드(피드 매칭 규칙 기준)를 하나 고른다.
 * 열람 GA 조건은 readableNewsletterWhere 에서 건다.
 */
export const READABLE_NEWSLETTER_BOARD_JOIN = `
  LEFT JOIN LATERAL (
    SELECT b.id, b.slug, b.label, b.board_scope, b.owner_ga_id, b.system_key
    FROM newsletter_boards b
    WHERE b.is_deleted = false
      AND COALESCE(b.is_active, true) = true
      AND b.board_scope IN ('system', 'global', 'ga')
      AND (
        (
          UPPER(TRIM(COALESCE(b.system_key, ''))) = 'LOSS_ADJUSTER'
          AND COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'LOSS_ADJUSTER'
        )
        OR (
          UPPER(TRIM(COALESCE(b.system_key, ''))) <> 'LOSS_ADJUSTER'
          AND b.id = NULLIF(TRIM(n.payload->>'newsletterBoardId'), '')
        )
      )
      AND (
        (b.board_scope IN ('global', 'system') AND n.ga_id IS NULL)
        OR (b.board_scope = 'ga' AND b.owner_ga_id IS NOT NULL AND n.ga_id = b.owner_ga_id)
      )
    ORDER BY CASE WHEN b.id = NULLIF(TRIM(n.payload->>'newsletterBoardId'), '') THEN 0 ELSE 1 END, b.id
    LIMIT 1
  ) nb ON true
`

/** 유형 컬럼 SQL (READABLE_NEWSLETTER_BOARD_JOIN 필요). */
export const READABLE_NEWSLETTER_KIND_SQL = `
  CASE
    WHEN nb.board_scope IN ('global', 'system') THEN 'PUBLIC'
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
        nb.id IS NULL
        AND n.ga_id = ${gaParam}
        AND COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'INSURER'
        ${sqlFeedChannelExtraGuards('INSURER', 'n')}
      )
      OR (nb.id IS NOT NULL AND nb.board_scope IN ('global', 'system'))
      OR (nb.id IS NOT NULL AND nb.board_scope = 'ga' AND nb.owner_ga_id = ${gaParam})
    )
  `
}

/** @param {unknown} raw */
export function normalizeNewsletterSourceKind(raw) {
  const v = String(raw ?? '').trim().toUpperCase()
  return NEWSLETTER_SOURCE_KINDS.includes(/** @type {any} */ (v)) ? v : null
}
