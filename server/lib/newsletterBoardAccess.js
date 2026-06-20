import { NEWSLETTER_BOARDS_BY_SLUG_SQL } from './newsletterBoardAdminSql.js'
import {
  canUserAccessBoardMenu,
  isGaBoardScope,
  isGlobalBoardScope,
  normalizeNewsletterBoardSlug,
} from './newsletterBoardScope.js'

/**
 * slug 로 조회된 후보 중 사용자가 접근 가능한 보드를 고른다.
 * global·ga slug 충돌 시 global 을 우선한다.
 *
 * @param {Record<string, unknown>[]} rows
 * @param {number | null | undefined} tenantGaId
 * @returns {Record<string, unknown> | null}
 */
export function pickAccessibleNewsletterBoard(rows, tenantGaId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }
  const accessible = rows.filter((row) => canUserAccessBoardMenu(row, tenantGaId))
  if (accessible.length === 0) {
    return null
  }
  accessible.sort((a, b) => {
    const aRank = isGlobalBoardScope(a) ? 0 : 1
    const bRank = isGlobalBoardScope(b) ? 0 : 1
    if (aRank !== bRank) {
      return aRank - bRank
    }
    return String(a.label ?? '').localeCompare(String(b.label ?? ''), 'ko')
  })
  return accessible[0]
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {number | null | undefined} tenantGaId
 * @returns {'not_found' | 'access_denied' | null}
 */
export function classifyNewsletterBoardAccess(rows, tenantGaId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 'not_found'
  }
  if (pickAccessibleNewsletterBoard(rows, tenantGaId)) {
    return null
  }
  return 'access_denied'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {(executor: import('pg').Pool | import('pg').PoolClient, sql: string, params: unknown[]) => Promise<{ rows?: Record<string, unknown>[] }>} queryFn
 * @param {unknown} rawSlug
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function listNewsletterBoardsBySlug(executor, queryFn, rawSlug) {
  const slug = normalizeNewsletterBoardSlug(rawSlug)
  const r = await queryFn(executor, NEWSLETTER_BOARDS_BY_SLUG_SQL, [slug])
  return Array.isArray(r.rows) ? r.rows : []
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {number | null | undefined} tenantGaId
 * @returns {Record<string, unknown> | null}
 */
export function resolveAccessibleNewsletterBoardFromRows(rows, tenantGaId) {
  return pickAccessibleNewsletterBoard(rows, tenantGaId)
}

/**
 * 공용(GENERAL) 계정이 slug 로 접근했을 때 GA 전용 보드만 존재하는지 판별한다.
 *
 * @param {Record<string, unknown>[]} rows
 * @param {number | null | undefined} tenantGaId
 * @returns {boolean}
 */
export function isGaOnlyBoardSlugForTenant(rows, tenantGaId) {
  if (classifyNewsletterBoardAccess(rows, tenantGaId) !== 'access_denied') {
    return false
  }
  return rows.some(isGaBoardScope) && !rows.some(isGlobalBoardScope)
}
