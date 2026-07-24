/**
 * 원수사(INSURER) 피드에서 동적/공용/GA 게시판 글을 제외하는 SQL 조건.
 * insurerName / company_name_snapshot 은 분류에 쓰지 않는다.
 *
 * @param {'n' | ''} [alias] 테이블 alias (`n` 또는 bare)
 */
export function sqlExcludeDynamicBoardFromInsurerFeed(alias = 'n') {
  const p = alias ? `${alias}.payload` : 'payload'
  return `
    AND NULLIF(TRIM(${p}->>'dynamicBoardSlug'), '') IS NULL
    AND NULLIF(TRIM(${p}->>'newsletterBoardId'), '') IS NULL
    AND UPPER(COALESCE(NULLIF(TRIM(${p}->>'insurerCode'), ''), '')) <> 'BOARD'
    AND UPPER(COALESCE(NULLIF(TRIM(${p}->>'newsChannel'), ''), 'INSURER')) <> 'BOARD'
  `
}

export const NEWS_CHANNEL_BOARD = 'BOARD'

/**
 * 게시글 채널 분류 SSOT (저장·조회 공통).
 * @param {unknown} raw
 * @returns {'INSURER' | 'LOSS_ADJUSTER' | 'BOARD'}
 */
export function classifyNewsletterNewsChannel(raw) {
  const n = String(raw ?? '').trim().toUpperCase()
  if (n === 'LOSS_ADJUSTER') {
    return 'LOSS_ADJUSTER'
  }
  if (n === 'BOARD' || n === 'DYNAMIC_BOARD' || n === 'NEWSLETTER_BOARD') {
    return 'BOARD'
  }
  return 'INSURER'
}

/**
 * payload 기준으로 원수사 피드 포함 여부.
 * @param {Record<string, unknown> | null | undefined} payload
 */
export function isInsurerFeedEligiblePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return true
  }
  if (String(payload.dynamicBoardSlug ?? '').trim()) {
    return false
  }
  if (String(payload.newsletterBoardId ?? '').trim()) {
    return false
  }
  const code = String(payload.insurerCode ?? '').trim().toUpperCase()
  if (code === 'BOARD' || code === 'CUSTOMER_NEWS') {
    return false
  }
  const channel = classifyNewsletterNewsChannel(payload.newsChannel)
  if (channel === 'BOARD' || channel === 'LOSS_ADJUSTER') {
    return false
  }
  return true
}
