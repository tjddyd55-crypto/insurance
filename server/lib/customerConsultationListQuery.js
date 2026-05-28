/**
 * 고객 목록 API — 상담 요약 JOIN·필터 (단일 진실 원천).
 */

/** @typedef {'none' | 'no_since' | null} ConsultationFilterMode */

/**
 * @param {Record<string, unknown>} query
 * @returns {{ mode: ConsultationFilterMode, cutoffDate: string | null, error: string | null }}
 */
export function parseConsultationFilterQuery(query) {
  const raw = query?.consultationFilter
  const filterRaw = raw == null ? '' : String(raw).trim().toLowerCase()
  if (!filterRaw || filterRaw === 'all') {
    return { mode: null, cutoffDate: null, error: null }
  }
  if (filterRaw === 'none') {
    return { mode: 'none', cutoffDate: null, error: null }
  }
  if (filterRaw === 'no_since') {
    const cutoffRaw = query?.consultationCutoffDate ?? query?.consultation_cutoff_date
    const cutoff = cutoffRaw == null ? '' : String(cutoffRaw).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      return { mode: 'no_since', cutoffDate: null, error: '기준 날짜(YYYY-MM-DD)가 필요합니다.' }
    }
    return { mode: 'no_since', cutoffDate: cutoff, error: null }
  }
  return { mode: null, cutoffDate: null, error: '잘못된 consultationFilter 값입니다.' }
}

/**
 * 상담 요약 서브쿼리 JOIN (user·ga 스코프).
 * @param {string} userPlaceholder e.g. `$5`
 * @param {string} gaPlaceholder e.g. `$6`
 */
export function buildCustomerConsultationSummaryJoin(userPlaceholder, gaPlaceholder) {
  return `
        LEFT JOIN (
          SELECT
            cc.customer_id,
            MAX(cc.consultation_date) AS last_consult_date,
            COUNT(*)::integer AS consultation_count
          FROM customer_consultations cc
          WHERE cc.user_id = ${userPlaceholder}::text AND cc.ga_id = ${gaPlaceholder}::integer
          GROUP BY cc.customer_id
        ) lc ON lc.customer_id = c.id
        LEFT JOIN LATERAL (
          SELECT cc2.body AS last_consultation_body
          FROM customer_consultations cc2
          WHERE cc2.customer_id = c.id
            AND cc2.user_id = ${userPlaceholder}::text
            AND cc2.ga_id = ${gaPlaceholder}::integer
          ORDER BY cc2.consultation_date DESC NULLS LAST, cc2.created_at DESC, cc2.id DESC
          LIMIT 1
        ) lcm ON true`
}

/**
 * @param {ConsultationFilterMode} mode
 * @param {string | null} cutoffDate YYYY-MM-DD
 * @returns {{ clause: string, params: string[] }}
 */
export function buildConsultationFilterSql(mode, cutoffDate) {
  if (mode === 'none') {
    return {
      clause: '(lc.consultation_count IS NULL OR lc.consultation_count = 0)',
      params: [],
    }
  }
  if (mode === 'no_since' && cutoffDate) {
    return {
      clause: '(lc.last_consult_date IS NULL OR lc.last_consult_date < $CUTOFF::date)',
      params: [cutoffDate],
    }
  }
  return { clause: '', params: [] }
}

/**
 * @param {string | null | undefined} body
 * @param {number} [maxLen]
 */
export function summarizeConsultationBody(body, maxLen = 80) {
  const t = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) {
    return null
  }
  if (t.length <= maxLen) {
    return t
  }
  return `${t.slice(0, maxLen)}…`
}
