import { systemQuery } from '../utils/dbSafeQuery.js'

export const ADVISOR_CONSULTATION_LEAD_STATUSES = ['new', 'checked', 'completed']

/** 읽기 표시용: 저장된 값이 목록 밖이면 'new' 로 보여 준다(쓰기에는 쓰지 않는다). */
function normalizeLeadStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  return ADVISOR_CONSULTATION_LEAD_STATUSES.includes(s) ? s : 'new'
}

/**
 * 쓰기용 엄격 검증. 허용값(ADVISOR_CONSULTATION_LEAD_STATUSES)과 정확히 같은 문자열만 통과.
 * 대소문자·공백 변형, 다른 값, 문자열이 아닌 값은 null(→ 400, DB 변경 없음). 'new' 로 바꾸지 않는다.
 * @param {unknown} raw
 * @returns {'new' | 'checked' | 'completed' | null}
 */
export function parseAdvisorConsultationLeadStatus(raw) {
  return typeof raw === 'string' && ADVISOR_CONSULTATION_LEAD_STATUSES.includes(raw) ? /** @type {any} */ (raw) : null
}

function mapLeadRow(row) {
  if (!row) return null
  return {
    id: String(row.id),
    advisorUserId: String(row.advisor_user_id),
    visitorName: String(row.visitor_name ?? ''),
    phoneNormalized: String(row.phone_normalized ?? ''),
    phoneDisplay: String(row.phone_display ?? ''),
    message: String(row.message ?? ''),
    contactChannel: String(row.contact_channel ?? ''),
    privacyConsent: Boolean(row.privacy_consent),
    privacyConsentAt: row.privacy_consent_at ? new Date(row.privacy_consent_at).toISOString() : null,
    privacyPolicyVersion: String(row.privacy_policy_version ?? ''),
    status: normalizeLeadStatus(row.status),
    checkedAt: row.checked_at ? new Date(row.checked_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} advisorUserId
 */
export async function listAdvisorConsultationLeadsForOwner(pool, advisorUserId) {
  const r = await systemQuery(
    pool,
    `
    SELECT *
    FROM advisor_consultation_leads
    WHERE advisor_user_id = $1
    ORDER BY created_at DESC
    LIMIT 200
    `,
    [advisorUserId],
  )
  return r.rows.map(mapLeadRow)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} advisorUserId
 */
export async function countNewAdvisorConsultationLeads(pool, advisorUserId) {
  const r = await systemQuery(
    pool,
    `
    SELECT COUNT(*)::int AS c
    FROM advisor_consultation_leads
    WHERE advisor_user_id = $1
      AND LOWER(status) = 'new'
    `,
    [advisorUserId],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} advisorUserId
 * @param {string} leadId
 */
export async function getAdvisorConsultationLeadForOwner(pool, advisorUserId, leadId) {
  const r = await systemQuery(
    pool,
    `
    SELECT *
    FROM advisor_consultation_leads
    WHERE id = $1 AND advisor_user_id = $2
    LIMIT 1
    `,
    [leadId, advisorUserId],
  )
  return mapLeadRow(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} advisorUserId
 * @param {string} leadId
 * @param {{ status?: string }} patch
 */
export async function patchAdvisorConsultationLeadForOwner(pool, advisorUserId, leadId, patch) {
  // status 가 없으면(undefined/null) 기존 계약대로 empty_patch. 있으면 엄격 검증, 실패 시 UPDATE 하지 않는다.
  const status = patch.status == null ? null : parseAdvisorConsultationLeadStatus(patch.status)
  if (patch.status != null && !status) {
    return { ok: false, code: 'invalid_status' }
  }

  const sets = []
  const values = []
  let n = 1

  if (status) {
    sets.push(`status = $${n++}`)
    values.push(status)
    if (status === 'checked') {
      sets.push(`checked_at = COALESCE(checked_at, NOW())`)
    }
    if (status === 'completed') {
      sets.push(`completed_at = COALESCE(completed_at, NOW())`)
    }
  }

  if (sets.length === 0) {
    return { ok: false, code: 'empty_patch' }
  }

  sets.push(`updated_at = NOW()`)
  values.push(leadId, advisorUserId)
  const idParam = n
  const userParam = n + 1

  const r = await systemQuery(
    pool,
    `
    UPDATE advisor_consultation_leads
    SET ${sets.join(', ')}
    WHERE id = $${idParam} AND advisor_user_id = $${userParam}
    RETURNING *
    `,
    values,
  )

  if (r.rowCount === 0) {
    return { ok: false, code: 'not_found' }
  }
  return { ok: true, lead: mapLeadRow(r.rows[0]) }
}
