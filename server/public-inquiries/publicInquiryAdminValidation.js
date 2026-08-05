/**
 * SUPER_ADMIN 공개 문의 관리 — 목록 쿼리·PATCH 본문 검증 (순수 함수).
 */

import { PUBLIC_INQUIRY_TYPES } from './publicInquiryValidation.js'

export const PUBLIC_INQUIRY_ADMIN_STATUSES = Object.freeze([
  'NEW',
  'CHECKING',
  'CONTACTED',
  'COMPLETED',
  'SPAM',
])

const TERMINAL_STATUSES = new Set(['COMPLETED', 'SPAM'])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const ADMIN_MEMO_MAX = 4000

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

/**
 * @param {unknown} raw
 * @param {number} fallback
 * @param {number} max
 */
function parsePositiveInt(raw, fallback, max) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return fallback
  return Math.min(n, max)
}

/**
 * YYYY-MM-DD 또는 ISO → Date | null (invalid면 에러용 sentinel)
 * @param {unknown} raw
 * @param {'start' | 'end'} bound
 * @returns {{ ok: true, value: Date | null } | { ok: false, message: string }}
 */
function parseDateBound(raw, bound) {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: true, value: null }
  // date-only → KST 경계 대신 UTC day 경계 (필터는 inclusive day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T${bound === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`)
    if (Number.isNaN(d.getTime())) {
      return { ok: false, message: '날짜 형식이 올바르지 않습니다.' }
    }
    return { ok: true, value: d }
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    return { ok: false, message: '날짜 형식이 올바르지 않습니다.' }
  }
  return { ok: true, value: d }
}

/**
 * @typedef {{
 *   status: string | null,
 *   inquiryType: string | null,
 *   q: string | null,
 *   from: Date | null,
 *   to: Date | null,
 *   page: number,
 *   pageSize: number,
 * }} PublicInquiryAdminListQuery
 */

/**
 * @param {unknown} query
 * @returns {{ ok: true, value: PublicInquiryAdminListQuery } | { ok: false, message: string }}
 */
export function parsePublicInquiryAdminListQuery(query) {
  const q = query && typeof query === 'object' ? /** @type {Record<string, unknown>} */ (query) : {}

  const statusRaw = String(q.status ?? '').trim()
  if (statusRaw && !PUBLIC_INQUIRY_ADMIN_STATUSES.includes(statusRaw)) {
    return { ok: false, message: 'status 필터가 올바르지 않습니다.' }
  }

  const typeRaw = String(q.inquiryType ?? '').trim()
  if (typeRaw && !PUBLIC_INQUIRY_TYPES.includes(typeRaw)) {
    return { ok: false, message: 'inquiryType 필터가 올바르지 않습니다.' }
  }

  const search = String(q.q ?? '').trim().slice(0, 100) || null

  const fromParsed = parseDateBound(q.from, 'start')
  if (!fromParsed.ok) return fromParsed
  const toParsed = parseDateBound(q.to, 'end')
  if (!toParsed.ok) return toParsed

  if (fromParsed.value && toParsed.value && fromParsed.value > toParsed.value) {
    return { ok: false, message: '시작일이 종료일보다 늦을 수 없습니다.' }
  }

  return {
    ok: true,
    value: {
      status: statusRaw || null,
      inquiryType: typeRaw || null,
      q: search,
      from: fromParsed.value,
      to: toParsed.value,
      page: parsePositiveInt(q.page, 1, 10_000),
      pageSize: parsePositiveInt(q.pageSize ?? q.page_size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    },
  }
}

/**
 * COMPLETED/SPAM → resolved_at 설정, 재오픈 시 해제.
 * @param {string} prevStatus
 * @param {string} nextStatus
 * @param {Date | string | null} prevResolvedAt
 * @returns {{ resolvedAt: Date | null, clearResolvedAt: boolean, setResolvedAtNow: boolean }}
 */
export function resolveInquiryResolvedAt(prevStatus, nextStatus, prevResolvedAt) {
  const nextTerminal = TERMINAL_STATUSES.has(nextStatus)
  const prevTerminal = TERMINAL_STATUSES.has(prevStatus)

  if (nextTerminal) {
    if (prevResolvedAt) {
      return { resolvedAt: prevResolvedAt instanceof Date ? prevResolvedAt : new Date(prevResolvedAt), clearResolvedAt: false, setResolvedAtNow: false }
    }
    return { resolvedAt: new Date(), clearResolvedAt: false, setResolvedAtNow: true }
  }

  if (prevTerminal && !nextTerminal) {
    return { resolvedAt: null, clearResolvedAt: true, setResolvedAtNow: false }
  }

  return {
    resolvedAt: prevResolvedAt instanceof Date ? prevResolvedAt : prevResolvedAt ? new Date(prevResolvedAt) : null,
    clearResolvedAt: false,
    setResolvedAtNow: false,
  }
}

/**
 * @typedef {{
 *   status?: string,
 *   adminMemo?: string | null,
 *   assignedAdminId?: string | null,
 *   softDelete?: boolean,
 * }} PublicInquiryAdminPatch
 */

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: PublicInquiryAdminPatch } | { ok: false, message: string }}
 */
export function parsePublicInquiryAdminPatchBody(body) {
  const raw = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {}
  /** @type {PublicInquiryAdminPatch} */
  const value = {}
  let hasField = false

  if (Object.prototype.hasOwnProperty.call(raw, 'status')) {
    const status = String(raw.status ?? '').trim()
    if (!PUBLIC_INQUIRY_ADMIN_STATUSES.includes(status)) {
      return { ok: false, message: 'status는 NEW, CHECKING, CONTACTED, COMPLETED, SPAM 중 하나여야 합니다.' }
    }
    value.status = status
    hasField = true
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'adminMemo')) {
    if (raw.adminMemo === null) {
      value.adminMemo = null
    } else {
      const memo = String(raw.adminMemo ?? '')
      if (memo.length > ADMIN_MEMO_MAX) {
        return { ok: false, message: `관리자 메모는 ${ADMIN_MEMO_MAX}자 이내로 입력해 주세요.` }
      }
      value.adminMemo = memo
    }
    hasField = true
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'assignedAdminId')) {
    if (raw.assignedAdminId === null || raw.assignedAdminId === '') {
      value.assignedAdminId = null
    } else {
      const id = String(raw.assignedAdminId).trim()
      if (!id || id.length > 200) {
        return { ok: false, message: 'assignedAdminId가 올바르지 않습니다.' }
      }
      value.assignedAdminId = id
    }
    hasField = true
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'softDelete')) {
    if (raw.softDelete !== true && raw.softDelete !== false) {
      return { ok: false, message: 'softDelete는 boolean이어야 합니다.' }
    }
    if (raw.softDelete === true) {
      value.softDelete = true
      hasField = true
    }
  }

  if (!hasField) {
    return { ok: false, message: '변경할 필드가 없습니다.' }
  }

  return { ok: true, value }
}

/**
 * DB row → API DTO (camelCase). PII는 관리자 화면용으로 포함.
 * @param {Record<string, unknown>} row
 */
export function mapPublicInquiryAdminRow(row) {
  const toIso = (v) => {
    if (v == null) return null
    if (v instanceof Date) return v.toISOString()
    const d = new Date(/** @type {string} */ (v))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return {
    id: String(row.id),
    inquiryType: String(row.inquiry_type ?? ''),
    name: String(row.name ?? ''),
    phoneDisplay: String(row.phone_display ?? ''),
    phoneNormalized: String(row.phone_normalized ?? ''),
    organizationName: row.organization_name != null ? String(row.organization_name) : null,
    email: row.email != null ? String(row.email) : null,
    preferredContactTime: row.preferred_contact_time != null ? String(row.preferred_contact_time) : null,
    message: String(row.message ?? ''),
    privacyConsent: Boolean(row.privacy_consent),
    privacyConsentAt: toIso(row.privacy_consent_at),
    status: String(row.status ?? ''),
    adminMemo: row.admin_memo != null ? String(row.admin_memo) : null,
    assignedAdminId: row.assigned_admin_id != null ? String(row.assigned_admin_id) : null,
    assignedAdminName: row.assigned_admin_name != null ? String(row.assigned_admin_name) : null,
    source: String(row.source ?? ''),
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at),
    resolvedAt: toIso(row.resolved_at),
    deletedAt: toIso(row.deleted_at),
  }
}
