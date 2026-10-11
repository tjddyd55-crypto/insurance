import { parseGaId } from '../lib/parseGaId.js'

export const ADMIN_NOTICE_AUDIENCE_GLOBAL = 'GLOBAL'
export const ADMIN_NOTICE_AUDIENCE_GA = 'GA'

/**
 * @param {unknown} row
 */
export function mapNoticeAudienceFields(row) {
  const scopeRaw = String(row?.audience_scope ?? ADMIN_NOTICE_AUDIENCE_GLOBAL).trim().toUpperCase()
  const audienceScope =
    scopeRaw === ADMIN_NOTICE_AUDIENCE_GA ? ADMIN_NOTICE_AUDIENCE_GA : ADMIN_NOTICE_AUDIENCE_GLOBAL
  const gaId = row?.ga_id != null ? Number(row.ga_id) : null
  return {
    audienceScope,
    gaId: Number.isFinite(gaId) ? gaId : null,
  }
}

/**
 * SUPER_ADMIN 생성·수정 시 기본 GLOBAL. GA_ADMIN 은 세션 ga_id 로 GA 고정.
 * @param {string | undefined} role
 * @param {unknown} sessionGaId
 * @param {unknown} _body
 */
export function resolveNoticeAudienceForWrite(role, sessionGaId, _body) {
  const normalizedRole = String(role ?? '').trim().toUpperCase()
  if (normalizedRole === 'GA_ADMIN') {
    const gaId = parseGaId(sessionGaId)
    if (gaId == null) {
      throw new Error('ga_context_required')
    }
    return { audienceScope: ADMIN_NOTICE_AUDIENCE_GA, gaId }
  }
  return { audienceScope: ADMIN_NOTICE_AUDIENCE_GLOBAL, gaId: null }
}

/**
 * @param {{ audienceScope?: string, gaId?: number | null }} notice
 * @param {number | null} actorGaId
 */
export function assertGaAdminOwnsNotice(notice, actorGaId) {
  if (notice.audienceScope !== ADMIN_NOTICE_AUDIENCE_GA) {
    throw new Error('notice_forbidden')
  }
  if (actorGaId == null || Number(notice.gaId) !== Number(actorGaId)) {
    throw new Error('notice_forbidden')
  }
}
