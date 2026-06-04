/**
 * 고객 목록 API — 상담 요약 JOIN·필터 (단일 진실 원천).
 */
import { parseInflowSourceFilterQuery } from './customerInflowSource.js'
import {
  parseFollowUpFilterQuery,
  parseNextContactDateRangeQuery,
  sqlFollowUpNotClosed,
} from './customerConsultationFollowUp.js'

/** @typedef {'none' | 'has' | 'no_since' | null} ConsultationFilterMode */

/** @type {Record<string, string>} */
const CONSULTATION_STATUS_ALIASES = {
  all: '',
  none: 'none',
  no_consultation: 'none',
  has: 'has',
  has_consultation: 'has',
  no_since: 'no_since',
  no_consultation_since: 'no_since',
}

/**
 * @param {unknown} raw
 */
function normalizeConsultationStatusRaw(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!s) {
    return ''
  }
  return CONSULTATION_STATUS_ALIASES[s] ?? s
}

/**
 * @param {Record<string, unknown>} query
 * @returns {string}
 */
function readConsultationReferenceDate(query) {
  const cutoffRaw =
    query?.consultationReferenceDate ??
    query?.consultation_reference_date ??
    query?.noConsultationSince ??
    query?.no_consultation_since ??
    query?.consultationCutoffDate ??
    query?.consultation_cutoff_date
  return cutoffRaw == null ? '' : String(cutoffRaw).trim()
}

/**
 * @param {unknown} raw
 */
export function escapeIlikePattern(raw) {
  return String(raw ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ mode: ConsultationFilterMode, cutoffDate: string | null, error: string | null }}
 */
export function parseConsultationFilterQuery(query) {
  const statusRaw = query?.consultationStatus ?? query?.consultation_status
  const legacyRaw = query?.consultationFilter ?? query?.consultation_filter
  const filterRaw =
    statusRaw != null && String(statusRaw).trim() !== ''
      ? normalizeConsultationStatusRaw(statusRaw)
      : legacyRaw == null
        ? ''
        : normalizeConsultationStatusRaw(legacyRaw)

  const cutoff = readConsultationReferenceDate(query)

  if (!filterRaw || filterRaw === 'all') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      return { mode: 'no_since', cutoffDate: cutoff, error: null }
    }
    return { mode: null, cutoffDate: null, error: null }
  }
  if (filterRaw === 'none') {
    return { mode: 'none', cutoffDate: null, error: null }
  }
  if (filterRaw === 'has') {
    return { mode: 'has', cutoffDate: null, error: null }
  }
  if (filterRaw === 'no_since') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
      return { mode: 'no_since', cutoffDate: null, error: '기준 날짜(YYYY-MM-DD)가 필요합니다.' }
    }
    return { mode: 'no_since', cutoffDate: cutoff, error: null }
  }
  return { mode: null, cutoffDate: null, error: '잘못된 상담 필터 값입니다.' }
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ value: string | null, error: string | null }}
 */
export function parseConsultationKeywordQuery(query) {
  const raw = query?.consultationKeyword ?? query?.consultation_keyword
  if (raw == null) {
    return { value: null, error: null }
  }
  const s = String(raw).trim()
  if (!s) {
    return { value: null, error: null }
  }
  if (s.length > 200) {
    return { value: null, error: '상담 검색어는 200자 이하여야 합니다.' }
  }
  return { value: s, error: null }
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ from: string | null, to: string | null, error: string | null }}
 */
export function parseConsultationDateRangeQuery(query) {
  const fromRaw = query?.consultationFrom ?? query?.consultation_from
  const toRaw = query?.consultationTo ?? query?.consultation_to
  const from = fromRaw == null || String(fromRaw).trim() === '' ? null : String(fromRaw).trim()
  const to = toRaw == null || String(toRaw).trim() === '' ? null : String(toRaw).trim()
  if (from != null && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return { from: null, to: null, error: '상담 시작일은 YYYY-MM-DD 형식이어야 합니다.' }
  }
  if (to != null && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from: null, to: null, error: '상담 종료일은 YYYY-MM-DD 형식이어야 합니다.' }
  }
  if (from != null && to != null && from > to) {
    return { from: null, to: null, error: '상담 시작일은 종료일보다 늦을 수 없습니다.' }
  }
  if (!from && !to) {
    return { from: null, to: null, error: null }
  }
  return { from, to, error: null }
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ mode: string, error: string | null }}
 */
export function parseCustomerListSortQuery(query) {
  const raw = String(query?.sort ?? '').trim()
  if (!raw) {
    return { mode: 'default', error: null }
  }
  const map = {
    default: 'default',
    createddesc: 'created_desc',
    created_desc: 'created_desc',
    nameasc: 'name_asc',
    name_asc: 'name_asc',
    lastconsultdesc: 'last_consult_desc',
    last_consult_desc: 'last_consult_desc',
    lastconsultasc: 'last_consult_asc',
    last_consult_asc: 'last_consult_asc',
    lastConsultDesc: 'last_consult_desc',
    lastConsultAsc: 'last_consult_asc',
    nameAsc: 'name_asc',
    createdDesc: 'created_desc',
    noconsultfirst: 'no_consult_first',
    no_consult_first: 'no_consult_first',
    noConsultFirst: 'no_consult_first',
    nextcontactasc: 'next_contact_asc',
    next_contact_asc: 'next_contact_asc',
    nextContactAsc: 'next_contact_asc',
    nextcontactdesc: 'next_contact_desc',
    next_contact_desc: 'next_contact_desc',
    nextContactDesc: 'next_contact_desc',
    overduefollowupfirst: 'overdue_follow_up_first',
    overdue_follow_up_first: 'overdue_follow_up_first',
    overdueFollowUpFirst: 'overdue_follow_up_first',
  }
  const key = raw in map ? raw : raw.toLowerCase()
  const mode = map[key]
  if (!mode) {
    return { mode: 'default', error: '잘못된 정렬 값입니다.' }
  }
  return { mode, error: null }
}

/**
 * @param {string} sortMode
 */
export function buildCustomerListOrderBy(sortMode) {
  switch (sortMode) {
    case 'name_asc':
      return 'c.name ASC, c.id ASC'
    case 'created_desc':
      return 'c.created_at DESC, c.id DESC'
    case 'last_consult_desc':
      return 'lc.last_consult_date DESC NULLS LAST, c.created_at DESC, c.id DESC'
    case 'last_consult_asc':
      return 'lc.last_consult_date ASC NULLS FIRST, c.created_at DESC, c.id DESC'
    case 'no_consult_first':
      return `(CASE WHEN lc.consultation_count IS NULL OR lc.consultation_count = 0 THEN 0 ELSE 1 END) ASC, lc.last_consult_date ASC NULLS FIRST, c.created_at DESC, c.id DESC`
    case 'next_contact_asc':
      return 'fu.follow_up_next_contact_date ASC NULLS LAST, c.created_at DESC, c.id DESC'
    case 'next_contact_desc':
      return 'fu.follow_up_next_contact_date DESC NULLS LAST, c.created_at DESC, c.id DESC'
    case 'overdue_follow_up_first':
      return `(CASE
        WHEN fu.follow_up_next_contact_date IS NOT NULL
          AND fu.follow_up_next_contact_date < CURRENT_DATE
          AND ${sqlFollowUpNotClosed('fu')}
        THEN 0 ELSE 1 END) ASC,
        fu.follow_up_next_contact_date ASC NULLS LAST,
        c.created_at DESC, c.id DESC`
    default:
      return 'lc.last_consult_date DESC NULLS LAST, c.renewal_date ASC NULLS LAST, c.created_at DESC, c.id DESC'
  }
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
 * 고객별 활성 후속관리(가장 빠른 next_contact_date) 요약.
 * @param {string} userPlaceholder
 * @param {string} gaPlaceholder
 */
export function buildCustomerFollowUpSummaryJoin(userPlaceholder, gaPlaceholder) {
  const notClosed = sqlFollowUpNotClosed('ff')
  return `
        LEFT JOIN LATERAL (
          SELECT
            ff.next_contact_date AS follow_up_next_contact_date,
            ff.follow_up_status AS follow_up_status,
            ff.contact_result AS follow_up_contact_result,
            ff.follow_up_note AS follow_up_note
          FROM customer_consultations ff
          WHERE ff.customer_id = c.id
            AND ff.user_id = ${userPlaceholder}::text
            AND ff.ga_id = ${gaPlaceholder}::integer
            AND ff.next_contact_date IS NOT NULL
            AND ${notClosed}
          ORDER BY ff.next_contact_date ASC, ff.id ASC
          LIMIT 1
        ) fu ON true`
}

/**
 * @param {string} userPlaceholder
 * @param {string} gaPlaceholder
 * @param {string} alias
 */
function buildFollowUpExistsPrefix(userPlaceholder, gaPlaceholder, alias) {
  return `EXISTS (
      SELECT 1 FROM customer_consultations ${alias}
      WHERE ${alias}.customer_id = c.id
        AND ${alias}.user_id = ${userPlaceholder}::text
        AND ${alias}.ga_id = ${gaPlaceholder}::integer`
}

/**
 * @param {'today' | 'overdue' | 'scheduled' | 'needed' | 'open' | 'none'} mode
 * @param {string} userPlaceholder
 * @param {string} gaPlaceholder
 * @returns {string}
 */
export function buildFollowUpFilterSql(mode, userPlaceholder, gaPlaceholder) {
  const alias = 'cfu'
  const notClosed = sqlFollowUpNotClosed(alias)
  const prefix = buildFollowUpExistsPrefix(userPlaceholder, gaPlaceholder, alias)

  if (mode === 'today') {
    return `${prefix}
        AND ${alias}.next_contact_date = CURRENT_DATE
        AND ${notClosed}
    )`
  }
  if (mode === 'overdue') {
    return `${prefix}
        AND ${alias}.next_contact_date IS NOT NULL
        AND ${alias}.next_contact_date < CURRENT_DATE
        AND ${notClosed}
    )`
  }
  if (mode === 'scheduled') {
    return `${prefix}
        AND ${alias}.next_contact_date IS NOT NULL
        AND ${notClosed}
    )`
  }
  if (mode === 'needed') {
    return `${prefix}
        AND ${alias}.follow_up_status = '후속필요'
        AND ${notClosed}
    )`
  }
  if (mode === 'open') {
    return `${prefix}
        AND ${notClosed}
        AND (
          ${alias}.next_contact_date IS NOT NULL
          OR ${alias}.follow_up_status = '후속필요'
        )
    )`
  }
  if (mode === 'none') {
    return `NOT ${prefix}
        AND ${notClosed}
        AND (
          ${alias}.next_contact_date IS NOT NULL
          OR ${alias}.follow_up_status = '후속필요'
        )
    )`
  }
  return ''
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
  if (mode === 'has') {
    return {
      clause: '(lc.consultation_count IS NOT NULL AND lc.consultation_count > 0)',
      params: [],
    }
  }
  if (mode === 'no_since' && cutoffDate) {
    // lc.last_consult_date = MAX(consultation_date) 이므로
    // NOT EXISTS (... consultation_date >= cutoff) 와 동치 (기준일 당일 상담도 제외).
    return {
      clause: '(lc.last_consult_date IS NULL OR lc.last_consult_date < $CUTOFF::date)',
      params: [cutoffDate],
    }
  }
  return { clause: '', params: [] }
}

/**
 * @param {Record<string, unknown>} query
 * @param {{ userPlaceholder: string, gaPlaceholder: string, paramStart: number }} ctx
 */
export function buildCustomerListWhereExtras(query, ctx) {
  const errors = []
  const whereFragments = []
  const params = []
  let nextIdx = ctx.paramStart

  const consult = parseConsultationFilterQuery(query)
  if (consult.error) {
    errors.push(consult.error)
  }
  const consultSql = buildConsultationFilterSql(consult.mode, consult.cutoffDate)
  if (consultSql.clause) {
    if (consult.mode === 'no_since' && consult.cutoffDate) {
      const ph = `$${nextIdx++}`
      whereFragments.push(consultSql.clause.replace('$CUTOFF', ph))
      params.push(consult.cutoffDate)
    } else {
      whereFragments.push(consultSql.clause)
    }
  }

  const inflow = parseInflowSourceFilterQuery(query)
  if (inflow.error) {
    errors.push(inflow.error)
  }
  if (inflow.value === '__unset__') {
    whereFragments.push(`(c.inflow_source IS NULL OR TRIM(c.inflow_source) = '')`)
  } else if (inflow.value) {
    whereFragments.push(`c.inflow_source = $${nextIdx++}`)
    params.push(inflow.value)
  }

  const keyword = parseConsultationKeywordQuery(query)
  if (keyword.error) {
    errors.push(keyword.error)
  }
  if (keyword.value) {
    whereFragments.push(`EXISTS (
      SELECT 1 FROM customer_consultations ckw
      WHERE ckw.customer_id = c.id
        AND ckw.user_id = ${ctx.userPlaceholder}::text
        AND ckw.ga_id = ${ctx.gaPlaceholder}::integer
        AND ckw.body ILIKE $${nextIdx++} ESCAPE '\\'
    )`)
    params.push(`%${escapeIlikePattern(keyword.value)}%`)
  }

  const dateRange = parseConsultationDateRangeQuery(query)
  if (dateRange.error) {
    errors.push(dateRange.error)
  }
  if (dateRange.from || dateRange.to) {
    const parts = [
      'EXISTS (',
      '  SELECT 1 FROM customer_consultations cdr',
      '  WHERE cdr.customer_id = c.id',
      `    AND cdr.user_id = ${ctx.userPlaceholder}::text`,
      `    AND cdr.ga_id = ${ctx.gaPlaceholder}::integer`,
    ]
    if (dateRange.from) {
      parts.push(`    AND cdr.consultation_date >= $${nextIdx++}::date`)
      params.push(dateRange.from)
    }
    if (dateRange.to) {
      parts.push(`    AND cdr.consultation_date <= $${nextIdx++}::date`)
      params.push(dateRange.to)
    }
    parts.push(')')
    whereFragments.push(parts.join('\n'))
  }

  const followUp = parseFollowUpFilterQuery(query)
  if (followUp.error) {
    errors.push(followUp.error)
  }
  if (followUp.mode) {
    whereFragments.push(buildFollowUpFilterSql(followUp.mode, ctx.userPlaceholder, ctx.gaPlaceholder))
  }

  const nextContactRange = parseNextContactDateRangeQuery(query)
  if (nextContactRange.error) {
    errors.push(nextContactRange.error)
  }
  if (nextContactRange.from) {
    whereFragments.push(`fu.follow_up_next_contact_date >= $${nextIdx++}::date`)
    params.push(nextContactRange.from)
  }
  if (nextContactRange.to) {
    whereFragments.push(`fu.follow_up_next_contact_date <= $${nextIdx++}::date`)
    params.push(nextContactRange.to)
  }

  const sort = parseCustomerListSortQuery(query)
  if (sort.error) {
    errors.push(sort.error)
  }

  return {
    whereFragments,
    params,
    orderBy: buildCustomerListOrderBy(sort.mode),
    errors,
  }
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
