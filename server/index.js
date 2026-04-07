import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pool from './db.js'
import { safeQuery, systemQuery } from './utils/dbSafeQuery.js'
import { initDb } from './initDb.js'
import { registerAuthAccountSmsApi } from './registerAuthAccountSmsApi.js'
import { registerUserProfileApi } from './registerUserProfileApi.js'
import { registerCustomerExtraApi } from './apis/customerExtraApi.js'
import { registerTeamApi } from './apis/teamApi.js'
import { registerNotificationsApi } from './apis/notificationsApi.js'
import { registerSuperAdminAnalyticsApi } from './registerSuperAdminAnalyticsApi.js'
import { recordAnalyticsEvent } from './lib/analyticsEvents.js'
import { ensureYesterdayAnalyticsAggregated } from './lib/analyticsAggregation.js'
import { tickAnalyticsAggregationScheduler } from './lib/analyticsScheduler.js'
import { verifySignupPhoneProof } from './lib/signupPhoneProof.js'
import { signInviteSignup, verifyInviteSignupSignature } from './lib/inviteSignupSignature.js'
import { purgeExpiredSmsVerificationCodes } from './services/purgeExpiredSmsCodes.js'
import { normalizeKrMobile, validateKrMobileDigits } from './lib/phoneNormalize.js'
import { isSignupPhoneRelaxedMode } from './lib/signupPhoneRelaxed.js'
import { resolveInsuranceCategoryForApi } from './lib/insuranceCompanyCategoryResolve.js'
import { coerceMeritzFireToNonLifeCategory } from './lib/insuranceCompanyCategoryRules.js'
import { parseGaId } from './lib/parseGaId.js'
import {
  isGaInsurerManagerMutatorRole,
  isGaTenantAdminRole,
  isInsurerManagerRole,
  parseCompanyScopeId,
  resolveTenantGaIdForRequest,
} from './lib/rbacScope.js'
import { logSecurityEvent, writeSecurityAudit } from './lib/securityAudit.js'
import { registerConsentApi } from './registerConsentApi.js'
import { registerInsurerNewsApi } from './registerInsurerNewsApi.js'
import { seedInsuranceCompanyDirectory } from './seedInsuranceData.js'

const PORT = Number(process.env.PORT ?? 3001)
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production'
/** 초대 가입 링크 HMAC — 운영에서는 INVITE_SIGNUP_SECRET 별도 권장 */
const INVITE_SIGNUP_SECRET = String(process.env.INVITE_SIGNUP_SECRET ?? JWT_SECRET)
const DEFAULT_JWT_SECRET = 'change-this-in-production'
const VALID_USER_ROLES = ['SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF', 'USER', 'INSURER_MANAGER']
const GA_DELEGATE_ROLES = ['GA_ADMIN', 'GA_STAFF']
const FEATURE_REQUEST_STATUSES = ['pending', 'reviewed', 'done']
const ENTITY_STATUSES = ['active', 'blocked', 'inactive']
const LEGACY_USER_ROLE_MAP = {
  super_admin: 'SUPER_ADMIN',
  staff: 'GA_ADMIN',
  user: 'USER',
}
const RUNNING_IN_PRODUCTION =
  process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT)
const DIST_PATH = path.join(process.cwd(), 'dist')

function normalizeExpiryDate(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 10)
}

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value ?? '')
  }

  return parsed.toISOString()
}

function validateCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return '아이디와 비밀번호를 입력해 주세요.'
  }

  const trimmed = username.trim()
  if (!trimmed || trimmed.length < 3 || trimmed.length > 30) {
    return '아이디는 3~30자여야 합니다.'
  }

  if (password.length < 4 || password.length > 100) {
    return '비밀번호는 4~100자여야 합니다.'
  }

  return null
}

/** users + insurer_managers 비삭제 행 기준 전역 아이디 중복 여부 */
async function isUsernameTakenGlobally(executor, username, options = {}) {
  const normalized = String(username ?? '').trim()
  const excludeUserId = String(options.excludeUserId ?? '').trim()
  const excludeInsurerManagerId = String(options.excludeInsurerManagerId ?? '').trim()
  const uParams = [normalized]
  let uSql = `SELECT 1 FROM users WHERE username = $1 AND is_deleted = false`
  if (excludeUserId) {
    uSql += ` AND id <> $2`
    uParams.push(excludeUserId)
  }
  uSql += ' LIMIT 1'
  const u = await systemQuery(executor, uSql, uParams)
  if (u.rowCount > 0) {
    return true
  }
  const imParams = [normalized]
  let imSql = `SELECT 1 FROM insurer_managers WHERE username = $1 AND is_deleted = false`
  if (excludeInsurerManagerId) {
    imSql += ` AND id <> $2`
    imParams.push(excludeInsurerManagerId)
  }
  imSql += ' LIMIT 1'
  const im = await systemQuery(executor, imSql, imParams)
  return im.rowCount > 0
}

function parseInsurerManagerType(raw) {
  const u = String(raw ?? '').trim().toUpperCase()
  return u === 'LIFE' || u === 'NON_LIFE' ? u : null
}

function parseInsurerManagerStatusDb(raw) {
  const u = String(raw ?? '').trim().toUpperCase()
  return u === 'ACTIVE' || u === 'BLOCKED' ? u : null
}

function mapInsurerManagerRow(row) {
  const code = row.ga_code ?? ''
  const st = String(row.status ?? 'ACTIVE').toUpperCase()
  return {
    id: String(row.id),
    companyId: row.company_id != null ? Number(row.company_id) : 0,
    gaCode: typeof code === 'string' ? code.trim().toUpperCase() : '',
    insurerType: row.insurer_type,
    insurerName: String(row.insurer_name ?? '').trim(),
    username: String(row.username ?? '').trim(),
    password: String(row.password_plaintext ?? ''),
    status: st === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    createdAt: toIsoString(row.created_at),
  }
}

/** 원수사 담당자 ↔ insurance_company_master: GA·분류(LIFE|NON_LIFE) 일치 검증 (resolve 단일 기준) */
async function validateInsurerManagerCompanyLink(executor, gaId, companyId, insurerTypeNorm) {
  const mid = Number(companyId)
  if (!Number.isInteger(mid) || mid <= 0) {
    return { ok: false, message: '보험사(마스터)를 선택해 주세요.' }
  }
  const g = parseGaId(gaId)
  if (g == null) {
    return { ok: false, message: 'GA 컨텍스트가 없습니다.' }
  }
  const r = await safeQuery(
    executor,
    `SELECT id, name, category, ga_id FROM insurance_company_master WHERE id = $1`,
    [mid],
  )
  if (r.rowCount === 0) {
    return { ok: false, message: '보험사 마스터를 찾을 수 없습니다.' }
  }
  const m = r.rows[0]
  if (Number(m.ga_id) !== Number(g)) {
    return { ok: false, message: '선택한 보험사가 소속 GA와 일치하지 않습니다.' }
  }
  const cat = resolveInsuranceCategoryForApi(m.category, m.name)
  if (!cat || (cat !== 'LIFE' && cat !== 'NON_LIFE' && cat !== 'GENERAL')) {
    return {
      ok: false,
      message: '보험사 마스터 분류를 확인할 수 없습니다. 마스터 데이터를 점검해 주세요.',
    }
  }
  if (cat === 'GENERAL') {
    return { ok: false, message: '일반보험 마스터는 원수사 담당자와 연결할 수 없습니다.' }
  }
  if (cat !== insurerTypeNorm) {
    return { ok: false, message: '보험사 유형(생명/손해)과 마스터 분류가 일치하지 않습니다.' }
  }
  return { ok: true, master: { id: Number(m.id), name: String(m.name ?? '').trim() } }
}

/** 보험사 지정은 company_id(마스터 id)만 허용 — 이름 필드로의 생성/변경 차단 */
function assertNoInsurerNameInPayload(body, res) {
  if (
    Object.prototype.hasOwnProperty.call(body ?? {}, 'insurer_name') ||
    Object.prototype.hasOwnProperty.call(body ?? {}, 'insurerName')
  ) {
    res.status(400).json({
      message:
        '보험사는 companyId(마스터 id)로만 지정할 수 있습니다. insurerName·insurer_name 필드는 사용할 수 없습니다.',
    })
    return false
  }
  return true
}

async function loadInsurerManagerHealthSummary(executor, gaIdFilter) {
  const params = gaIdFilter != null ? [gaIdFilter] : []
  const gaClause = gaIdFilter != null ? 'AND im.ga_id = $1' : ''
  const r = await safeQuery(
    executor,
    `
    SELECT im.id, im.ga_id, im.company_id, im.insurer_type,
           m.id AS m_id, m.category AS m_category, m.name AS m_name, m.ga_id AS m_ga_id
    FROM insurer_managers im
    LEFT JOIN insurance_company_master m ON m.id = im.company_id
    WHERE im.is_deleted = false
    ${gaClause}
    `,
    params,
  )
  let total = 0
  let nullCompany = 0
  let fkBroken = 0
  let gaMismatch = 0
  let invalidCategory = 0
  const seenBroken = new Set()
  for (const row of r.rows) {
    total += 1
    const cid = row.company_id != null ? Number(row.company_id) : NaN
    const badNull = !Number.isInteger(cid) || cid <= 0
    if (badNull) {
      nullCompany += 1
      seenBroken.add(row.id)
      continue
    }
    if (row.m_id == null) {
      fkBroken += 1
      seenBroken.add(row.id)
      continue
    }
    if (Number(row.m_ga_id) !== Number(row.ga_id)) {
      gaMismatch += 1
      seenBroken.add(row.id)
      continue
    }
    const resolved = resolveInsuranceCategoryForApi(row.m_category, row.m_name)
    const typeBroken =
      !resolved ||
      resolved === 'GENERAL' ||
      (resolved !== 'LIFE' && resolved !== 'NON_LIFE') ||
      resolved !== row.insurer_type
    if (typeBroken) {
      invalidCategory += 1
      seenBroken.add(row.id)
    }
  }
  return {
    total,
    broken: seenBroken.size,
    invalidCategory,
    nullCompany,
    fkBroken,
    gaMismatch,
  }
}

function mapGaDelegateAdminRow(row) {
  const st = String(row.status ?? 'active').toLowerCase()
  let statusLabel = 'ACTIVE'
  if (st === 'blocked') {
    statusLabel = 'BLOCKED'
  } else if (st === 'inactive') {
    statusLabel = 'INACTIVE'
  }
  const code = row.ga_code ?? ''
  return {
    id: String(row.id),
    ga_id: row.ga_id,
    gaCode: typeof code === 'string' ? code.trim().toUpperCase() : '',
    gaName: String(row.ga_name ?? '').trim(),
    username: String(row.username ?? '').trim(),
    password: String(row.delegate_password_plaintext ?? ''),
    role: normalizeUserRole(row.role),
    status: st,
    statusLabel,
    created_at: toIsoString(row.created_at),
  }
}

function buildFormTitle(customerName, carNumber, updatedAt) {
  const normalizedCustomer = customerName?.trim() || '미입력'
  const normalizedCarNumber = carNumber?.trim() || '미입력'
  const normalizedDate = updatedAt?.slice(0, 10) || '날짜없음'
  return `${normalizedCustomer} / ${normalizedCarNumber} / ${normalizedDate}`
}

function mapFormRow(row) {
  const formData = row.form_data ?? {}
  const customerName = row.customer_name || formData.ownerName || ''
  const carNumber = row.car_number || formData.vehicleNumber || ''
  const expiryDate = normalizeExpiryDate(row.expiry_date ?? formData.expiryDate ?? '')
  const dbCid = row.customer_id != null ? Number(row.customer_id) : NaN
  const customerId =
    Number.isInteger(dbCid) && dbCid > 0 ? dbCid : Math.max(0, Number(formData.customerId) || 0)

  return {
    ...formData,
    customerId,
    expiryDate,
    id: String(row.id),
    userId: String(row.user_id),
    customerName,
    carNumber,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    title: buildFormTitle(customerName, carNumber, toIsoString(row.updated_at)),
  }
}

function calculateInsuranceInfoFromRrn(rrnRaw) {
  const clean = String(rrnRaw ?? '').replace(/[^0-9]/g, '')
  if (clean.length < 7) {
    return { age: null, nextAgeDate: null }
  }
  const birth = clean.substring(0, 6)
  const genderCode = clean[6]
  let yearPrefix = null
  if (genderCode === '1' || genderCode === '2') {
    yearPrefix = '19'
  }
  if (genderCode === '3' || genderCode === '4') {
    yearPrefix = '20'
  }
  if (!yearPrefix) {
    return { age: null, nextAgeDate: null }
  }
  const year = parseInt(yearPrefix + birth.substring(0, 2), 10)
  const month = parseInt(birth.substring(2, 4), 10)
  const day = parseInt(birth.substring(4, 6), 10)
  const birthDate = new Date(year, month - 1, day)
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return { age: null, nextAgeDate: null }
  }
  const today = new Date()
  let insuranceAge = today.getFullYear() - year
  const thisYearBirthday = new Date(today.getFullYear(), month - 1, day)
  const thisYearUpperDate = new Date(thisYearBirthday)
  thisYearUpperDate.setMonth(thisYearUpperDate.getMonth() + 6)
  if (today >= thisYearUpperDate) {
    insuranceAge += 1
  }
  return { age: insuranceAge, nextAgeDate: thisYearUpperDate }
}

function nextAgeDateToSqlDate(d) {
  if (!d || Number.isNaN(d.getTime())) {
    return null
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function normalizeCustomerNoteItemsArray(itemsRaw) {
  const out = []
  if (!Array.isArray(itemsRaw)) {
    return out
  }
  for (const item of itemsRaw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const id = String(item.id ?? '').trim()
    const content = String(item.content ?? '').trim()
    const createdAt = String(item.createdAt ?? new Date().toISOString()).trim()
    if (!id || !content) {
      continue
    }
    out.push({ id, content, createdAt })
  }
  return out
}

/** DB jsonb 저장 형식: { items: Note[], insuranceHistory?: string } */
function normalizeCustomerNotesInput(raw) {
  const insuranceHistoryMax = 60000
  let insuranceHistory = ''
  let itemsRaw = raw
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    insuranceHistory = String(raw.insuranceHistory ?? '').trim().slice(0, insuranceHistoryMax)
    itemsRaw = raw.items
  }
  const items = normalizeCustomerNoteItemsArray(itemsRaw)
  return { items, insuranceHistory }
}

function mapCustomerNotesJson(raw) {
  if (raw == null) {
    return { items: [], insuranceHistory: '' }
  }
  if (Array.isArray(raw)) {
    return { items: normalizeCustomerNoteItemsArray(raw), insuranceHistory: '' }
  }
  if (typeof raw === 'object') {
    const insuranceHistory = String(raw.insuranceHistory ?? '').trim()
    const items = normalizeCustomerNoteItemsArray(raw.items)
    return { items, insuranceHistory }
  }
  return { items: [], insuranceHistory: '' }
}

function mapCustomerRow(row) {
  const renewalRaw = row.renewal_date ?? ''
  const renewalDate =
    renewalRaw instanceof Date
      ? normalizeExpiryDate(renewalRaw.toISOString().slice(0, 10))
      : normalizeExpiryDate(String(renewalRaw))

  const g = String(row.gender ?? '').trim()
  const gender = g === 'male' || g === 'female' ? g : null

  let isDriver = null
  if (row.is_driver === true) {
    isDriver = true
  } else if (row.is_driver === false) {
    isDriver = false
  }

  const nextRaw = row.next_age_date ?? null
  let nextAgeDate = null
  if (nextRaw instanceof Date) {
    nextAgeDate = normalizeExpiryDate(nextRaw.toISOString().slice(0, 10))
  } else if (nextRaw) {
    nextAgeDate = normalizeExpiryDate(String(nextRaw).slice(0, 10))
  }

  const insRaw = row.insurance_age
  const insuranceAge =
    insRaw != null && insRaw !== '' && Number.isFinite(Number(insRaw)) ? Number(insRaw) : null

  return {
    id: Number(row.id),
    userId: String(row.user_id),
    name: row.name ?? '',
    ssn: row.ssn ?? '',
    gender,
    insuranceAge,
    nextAgeDate: nextAgeDate || null,
    isDriver,
    carType: row.car_type ?? '',
    notes: mapCustomerNotesJson(row.notes),
    phone: row.phone ?? row.phone_number ?? '',
    carrier: row.carrier ?? '',
    address: row.address ?? '',
    height: row.height ?? '',
    weight: row.weight ?? '',
    job: row.job ?? '',
    driving: row.driving ?? '',
    medical: row.medical ?? '',
    carNumber: row.car_number ?? '',
    carModel: row.car_model ?? '',
    carYear: row.car_year ?? '',
    renewalDate,
    isFavorite: row.is_favorite === true,
    createdAt: toIsoString(row.created_at),
  }
}

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function normalizeCategory(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().toUpperCase()
}

function normalizeUserRole(value) {
  const r = typeof value === 'string' ? value.trim() : ''
  if (VALID_USER_ROLES.includes(r)) {
    return r
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_USER_ROLE_MAP, r)) {
    return LEGACY_USER_ROLE_MAP[r]
  }
  return 'USER'
}

/** PATCH /admin/users 등: user / admin / super_admin 별칭 허용 */
function parseAdminPatchRole(raw) {
  if (raw == null) {
    return null
  }
  const s = String(raw).trim()
  if (!s) {
    return null
  }
  const lower = s.toLowerCase().replace(/-/g, '_')
  const alias = {
    user: 'USER',
    admin: 'GA_ADMIN',
    ga_admin: 'GA_ADMIN',
    staff: 'GA_STAFF',
    ga_staff: 'GA_STAFF',
    super_admin: 'SUPER_ADMIN',
    superadmin: 'SUPER_ADMIN',
  }
  if (Object.prototype.hasOwnProperty.call(alias, lower)) {
    return alias[lower]
  }
  const up = s.toUpperCase()
  return VALID_USER_ROLES.includes(up) ? up : null
}

function isSuperAdminRole(role) {
  return normalizeUserRole(role) === 'SUPER_ADMIN'
}

function isGaAdminOrSuper(role) {
  const n = normalizeUserRole(role)
  return n === 'SUPER_ADMIN' || n === 'GA_ADMIN' || n === 'GA_STAFF'
}

function parseEntityStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  return ENTITY_STATUSES.includes(s) ? s : null
}

/** @returns {number | null} */
function effectiveTenantGaId(req) {
  if (!req.user) {
    return null
  }
  return parseGaId(req.user.gaId)
}

function escapeIlikePattern(raw) {
  return String(raw ?? '').replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function resolveLinkedCustomerIdFromRequest(body, formData) {
  const raw = body?.customer_id ?? body?.customerId ?? formData?.customerId
  if (raw === undefined || raw === null || raw === '') {
    return null
  }
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    return null
  }
  return n
}

async function assertCustomerOwnedByUser(customerId, userId, gaId) {
  if (customerId == null) {
    return true
  }
  const g = parseGaId(gaId)
  if (g == null) {
    return false
  }
  const r = await safeQuery(pool,
    `SELECT 1 FROM customers WHERE id = $1 AND user_id = $2 AND ga_id = $3`,
    [customerId, userId, g],
  )
  return r.rows.length > 0
}

async function assertCustomerActiveAndOwnedByUser(customerId, userId, gaId) {
  if (customerId == null) {
    return false
  }
  const g = parseGaId(gaId)
  if (g == null) {
    return false
  }
  const r = await safeQuery(pool,
    `SELECT 1 FROM customers WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL`,
    [customerId, userId, g],
  )
  return r.rows.length > 0
}

function mapContactRow(row) {
  return {
    id: String(row.id),
    category: row.category,
    companyName: row.company_name,
    managerName: row.manager_name,
    position: row.position ?? '',
    phoneNumber: normalizePhoneNumber(row.phone_number),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

function mapContactUpdateRow(row) {
  return {
    id: String(row.id),
    contactId: row.contact_id ? String(row.contact_id) : null,
    actionType: row.action_type,
    category: row.category,
    companyName: row.company_name,
    managerName: row.manager_name,
    position: row.position ?? '',
    oldPhoneNumber: row.old_phone_number ?? '',
    newPhoneNumber: row.new_phone_number ?? '',
    description: row.description ?? '',
    createdAt: toIsoString(row.created_at),
  }
}

function formatInsCompanyCode(id) {
  return `INS${String(Number(id)).padStart(6, '0')}`
}

async function ensureMasterCompanyCode(client, masterId) {
  const code = formatInsCompanyCode(masterId)
  await safeQuery(client,
    `UPDATE insurance_company_master SET company_code = $1 WHERE id = $2`,
    [code, masterId],
  )
}

function mapInsuranceCompanyMaster(row) {
  const category = resolveInsuranceCategoryForApi(row.category, row.name) || ''
  const updatedRaw = row.updated_at ?? row.created_at
  const id = Number(row.id)
  return {
    id,
    companyCode: row.company_code != null && String(row.company_code).trim() !== ''
      ? String(row.company_code).trim()
      : formatInsCompanyCode(id),
    // API: DB 정규화 후 이름 추론·메리츠 보정까지 반영한 LIFE | NON_LIFE | GENERAL | ''
    category,
    name: row.name ?? '',
    customerCenter: row.customer_center ?? '',
    systemPhone: row.system_phone ?? '',
    incallNumber: row.incall_number ?? '',
    visitInfo: row.visit_info ?? '',
    createdAt: toIsoString(row.created_at),
    updatedAt: updatedRaw ? toIsoString(updatedRaw) : undefined,
    updatedBy: row.updated_by_username ?? '',
  }
}

function mapInsuranceCompanyContact(row) {
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    name: row.name ?? '',
    position: row.position ?? '',
    phone: row.phone ?? '',
  }
}

function mapInsuranceGeneralRequest(row) {
  if (!row) {
    return null
  }
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    description: row.description ?? '',
    phone: row.phone ?? '',
    fax: row.fax ?? '',
    email: row.email ?? '',
  }
}

async function loadCompanyDirectoryNestedList(gaId, options = {}) {
  const g = parseGaId(gaId)
  if (g == null) {
    throw new Error('loadCompanyDirectoryNestedList: gaId 필요')
  }
  const masters = await safeQuery(pool,
    `
    SELECT *
    FROM insurance_company_master
    WHERE ga_id = $1
    ORDER BY name ASC NULLS LAST, id ASC
    `,
    [g],
  )
  const contacts = await safeQuery(pool,
    `
    SELECT ic.*
    FROM insurance_company_contacts ic
    INNER JOIN insurance_company_master m ON m.id = ic.company_id AND m.ga_id = $1
    ORDER BY ic.company_id ASC, ic.id ASC
    `,
    [g],
  )
  const generals = await safeQuery(pool,
    `
    SELECT gr.*
    FROM insurance_general_request gr
    INNER JOIN insurance_company_master m ON m.id = gr.company_id AND m.ga_id = $1
    `,
    [g],
  )

  const contactByCompany = new Map()
  for (const c of contacts.rows) {
    const cid = Number(c.company_id)
    if (!contactByCompany.has(cid)) {
      contactByCompany.set(cid, [])
    }
    contactByCompany.get(cid).push(mapInsuranceCompanyContact(c))
  }

  const generalByCompany = new Map()
  for (const g of generals.rows) {
    generalByCompany.set(Number(g.company_id), mapInsuranceGeneralRequest(g))
  }

  const items = masters.rows.map((m) => {
    const id = Number(m.id)
    return {
      ...mapInsuranceCompanyMaster(m),
      contacts: contactByCompany.get(id) ?? [],
      general: generalByCompany.get(id) ?? null,
    }
  })

  items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'))
  const onlyId =
    options && options.onlyCompanyId != null ? Number(options.onlyCompanyId) : null
  if (onlyId != null && Number.isInteger(onlyId) && onlyId > 0) {
    return items.filter((x) => Number(x.id) === onlyId)
  }
  return items
}

function createVCardContent(contact) {
  const tel = normalizePhoneNumber(contact.phone_number)
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.manager_name}`,
    `ORG:${contact.company_name}`,
    contact.position ? `TITLE:${contact.position}` : '',
    tel ? `TEL:${tel}` : '',
    'END:VCARD',
  ].filter(Boolean)

  return `${lines.join('\r\n')}\r\n`
}

function extractFormData(body) {
  const formData = body?.formData ?? body?.form_data
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
    return null
  }

  return formData
}

const LENIENT_DB_RESPONSES = process.env.LENIENT_DB_RESPONSES === '1'

function handleDbError(error, req, res) {
  if (!res || typeof res.status !== 'function') {
    console.error('[FATAL] invalid res object', res)
    return
  }
  if (error?.code === '23505') {
    if (error?.constraint === 'users_username_key') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    res.status(409).json({ message: '이미 존재하는 데이터입니다.' })
    return
  }

  console.error('[DB ERROR]', error)
  if (LENIENT_DB_RESPONSES) {
    console.error('[LENIENT MODE DB ERROR]', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      constraint: error?.constraint,
      path: req?.originalUrl ?? req?.url,
    })
    res.status(200).json({
      success: false,
      message: '서버 오류 (자동 복구됨)',
      data: [],
    })
    return
  }
  res.status(500).json({ success: false, message: 'DB_ERROR' })
}

async function logInsuranceFormsDbDiagnostics(contextLabel) {
  try {
    await systemQuery(pool,
      `
      SELECT id FROM insurance_forms
      ORDER BY created_at DESC NULLS LAST, id DESC
      LIMIT 1
      `,
    )
    await systemQuery(pool, `SELECT COUNT(*) AS count FROM insurance_forms WHERE user_id IS NULL`)
  } catch (error) {
    console.error(`[insurance_forms:${contextLabel}] 진단 쿼리 실패:`, error)
  }
}

function getAuthenticatedUserId(req) {
  const raw = req.user?.id
  if (raw === undefined || raw === null) {
    return ''
  }
  return String(raw).trim()
}

/** @returns {string | null} userId 또는 실패 시 응답 전송 후 null */
function requireInsuranceFormUserId(req, res) {
  const userId = getAuthenticatedUserId(req)
  if (!userId) {
    console.error('userId 없음 - 저장 중단')
    res.status(401).json({ message: 'userId 없음: 로그인 정보가 올바르지 않습니다.' })
    return null
  }
  return userId
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const userId = decoded.userId || decoded.sub
    if (!userId || String(userId).trim() === '') {
      console.error('[requireAuth] JWT userId 없음', { keys: Object.keys(decoded) })
      res
        .status(401)
        .json({ error: 'Unauthorized', message: '토큰에 사용자 ID가 없습니다.' })
      return
    }

    const role = normalizeUserRole(decoded.role)
    const gaFromJwt = parseGaId(decoded.gaId ?? decoded.ga_id)
    if (role !== 'SUPER_ADMIN') {
      if (gaFromJwt == null) {
        console.error('[requireAuth] invalid gaId in token', {
          role,
          rawGa: decoded.gaId ?? decoded.ga_id,
          userId: String(userId),
        })
        res.status(401).json({
          error: 'invalid gaId',
          message: '세션에 GA 정보가 없거나 올바르지 않습니다. 다시 로그인해 주세요.',
        })
        return
      }
    }
    const gaCodeRaw = decoded.gaCode ?? decoded.ga_code
    const gaCode =
      typeof gaCodeRaw === 'string' && gaCodeRaw.trim() ? gaCodeRaw.trim().toUpperCase() : ''
    const gaNameRaw = decoded.gaName ?? decoded.ga_name
    const gaName = typeof gaNameRaw === 'string' ? gaNameRaw.trim() : ''
    const companyIdJwt = parseCompanyScopeId(decoded.companyId ?? decoded.company_id)
    const displayNameRaw = decoded.displayName ?? decoded.display_name ?? ''
    const displayName = typeof displayNameRaw === 'string' ? displayNameRaw.trim() : ''
    const teamIdRaw = decoded.teamId ?? decoded.team_id
    const teamId =
      typeof teamIdRaw === 'string' && teamIdRaw.trim() ? teamIdRaw.trim() : null
    req.user = {
      id: String(userId),
      username: typeof decoded.username === 'string' ? decoded.username : '',
      role,
      gaId: gaFromJwt,
      gaCode,
      gaName,
      companyId: companyIdJwt,
      displayName,
      teamId,
    }

    if (role === 'INSURER_MANAGER') {
      const stIm = await safeQuery(
        pool,
        `
        SELECT im.status AS im_status, im.is_deleted AS im_deleted, im.company_id,
               g.status AS ga_status, g.is_deleted AS ga_deleted
        FROM insurer_managers im
        INNER JOIN ga_companies g ON g.id = im.ga_id
        WHERE im.id = $1
          AND im.is_deleted = false
          AND ($2::int IS NULL OR im.ga_id = $2::int)
        `,
        [req.user.id, gaFromJwt],
      )
      if (stIm.rowCount === 0) {
        res.status(401).json({ error: 'Unauthorized', message: '로그인 정보가 올바르지 않습니다.' })
        return
      }
      const ir = stIm.rows[0]
      const coId = ir.company_id != null ? Number(ir.company_id) : null
      if (Number.isInteger(coId) && coId > 0) {
        req.user.companyId = coId
      }
      if (ir.im_deleted || String(ir.im_status ?? '').toUpperCase() !== 'ACTIVE') {
        forbiddenResponse(req, res, '접근이 제한된 계정입니다', { guard: 'requireAuth', reason: 'insurer_inactive' })
        return
      }
      if (ir.ga_deleted || String(ir.ga_status ?? '').toLowerCase() !== 'active') {
        forbiddenResponse(req, res, '해당 GA는 현재 사용이 제한되었습니다', {
          guard: 'requireAuth',
          reason: 'ga_inactive_insurer',
        })
        return
      }
      if (!req.user.companyId || req.user.companyId < 1) {
        forbiddenResponse(req, res, '담당자 계정에 보험사(마스터)가 연결되지 않았습니다.', {
          guard: 'requireAuth',
          reason: 'insurer_no_company',
        })
        return
      }
      req.gaId = parseGaId(req.user?.gaId)
      next()
      return
    }

    const st = await safeQuery(
      pool,
      `
      SELECT
        u.status AS user_status,
        u.is_deleted AS user_deleted,
        g.status AS ga_status,
        g.is_deleted AS ga_deleted
      FROM users u
      INNER JOIN ga_companies g ON g.id = u.ga_id
      WHERE u.id = $1
        AND u.is_deleted = false
        AND ($2::int IS NULL OR u.ga_id = $2::int)
      `,
      [req.user.id, gaFromJwt],
    )
    if (st.rowCount === 0) {
      res.status(401).json({ error: 'Unauthorized', message: '로그인 정보가 올바르지 않습니다.' })
      return
    }
    const row = st.rows[0]
    if (row.user_deleted) {
      forbiddenResponse(req, res, '접근이 제한된 계정입니다', { guard: 'requireAuth', reason: 'user_deleted' })
      return
    }
    if (row.user_status !== 'active') {
      forbiddenResponse(req, res, '접근이 제한된 계정입니다', { guard: 'requireAuth', reason: 'user_inactive' })
      return
    }
    if (row.ga_deleted || row.ga_status !== 'active') {
      forbiddenResponse(req, res, '해당 GA는 현재 사용이 제한되었습니다', {
        guard: 'requireAuth',
        reason: 'ga_inactive_user',
      })
      return
    }

    req.gaId = parseGaId(req.user?.gaId)
    next()
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : ''
    if (name === 'JsonWebTokenError' || name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Unauthorized',
        message: '인증이 만료되었거나 유효하지 않습니다.',
      })
      return
    }
    next(e)
  }
}

/** SUPER_ADMIN 전용 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || !isSuperAdminRole(req.user.role)) {
    forbiddenResponse(req, res, '전체 관리자 권한이 필요합니다.', { guard: 'requireSuperAdmin' })
    return
  }
  next()
}

/** GA_ADMIN · GA_STAFF · SUPER_ADMIN (템플릿·원수사 디렉터리 등) */
function requireGaAdminOrSuper(req, res, next) {
  if (!req.user || !isGaAdminOrSuper(req.user.role)) {
    forbiddenResponse(req, res, '원수사 연락처 관리 권한이 없습니다.', { guard: 'requireGaAdminOrSuper' })
    return
  }
  next()
}

/** 보험사 마스터 쓰기 등: SUPER_ADMIN · GA_ADMIN 만 */
function requireGaTenantAdmin(req, res, next) {
  if (!req.user || !isGaTenantAdminRole(req.user.role)) {
    forbiddenResponse(req, res, 'GA 관리자 권한이 필요합니다.', { guard: 'requireGaTenantAdmin' })
    return
  }
  next()
}

/** 원수사 담당자 API 쓰기: SUPER_ADMIN · GA_ADMIN · GA_STAFF */
function requireGaInsurerManagerMutator(req, res, next) {
  if (!req.user || !isGaInsurerManagerMutatorRole(req.user.role)) {
    forbiddenResponse(req, res, '원수사 담당자 관리 권한이 필요합니다.', { guard: 'requireGaInsurerManagerMutator' })
    return
  }
  next()
}

/** 담당자 정합성 헬스: SUPER_ADMIN · GA_ADMIN 만 */
function requireInsurerHealthReader(req, res, next) {
  if (!req.user) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return
  }
  const r = normalizeUserRole(req.user.role)
  if (r === 'INSURER_MANAGER' || r === 'GA_STAFF' || r === 'USER') {
    forbiddenResponse(req, res, '이 API에 접근할 권한이 없습니다.', { guard: 'requireInsurerHealthReader' })
    return
  }
  if (r !== 'SUPER_ADMIN' && r !== 'GA_ADMIN') {
    forbiddenResponse(req, res, '이 API에 접근할 권한이 없습니다.', { guard: 'requireInsurerHealthReader' })
    return
  }
  next()
}

function forbidInsurerManagerApi(req, res, next) {
  if (!req.user) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return
  }
  if (isInsurerManagerRole(req.user.role)) {
    forbiddenResponse(req, res, '원수사 담당자 계정은 이 API를 사용할 수 없습니다.', {
      guard: 'forbidInsurerManagerApi',
    })
    return
  }
  next()
}

/**
 * 권한 거부 응답 + 감사 로그 (비동기, 응답은 즉시).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} message
 * @param {Record<string, unknown>} [extraMeta]
 */
function forbiddenResponse(req, res, message, extraMeta = {}) {
  const u = req.user
  const g = u?.gaId != null ? parseGaId(u.gaId) : null
  const co =
    u?.companyId != null && Number.isInteger(Number(u.companyId)) && Number(u.companyId) > 0
      ? Number(u.companyId)
      : null
  void logSecurityEvent(pool, {
    actorUserId: String(u?.id ?? 'anonymous').slice(0, 200),
    actorRole: String(u?.role ?? 'anonymous').slice(0, 64),
    action: 'FORBIDDEN_ACCESS',
    targetType: 'http',
    meta: {
      path: String(req.originalUrl ?? req.path ?? '').slice(0, 500),
      method: req.method,
      ...extraMeta,
    },
    gaId: Number.isInteger(g) ? g : null,
    companyId: co,
  })
  res.status(403).json({
    error: 'FORBIDDEN',
    message: message || '권한이 없습니다.',
  })
}

function requireAuditLogReader(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: '로그인이 필요합니다.' })
    return
  }
  const r = normalizeUserRole(req.user.role)
  if (r !== 'SUPER_ADMIN' && r !== 'GA_ADMIN') {
    forbiddenResponse(req, res, '감사 로그를 조회할 권한이 없습니다.', { guard: 'requireAuditLogReader' })
    return
  }
  next()
}

async function withTransaction(task) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await task(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function emptyCompanySnapshot() {
  return {
    customerCenter: '',
    system: '',
    incall: '',
    visitInfo: '',
    contacts: [],
  }
}

async function loadCompanySnapshot(client, companyId, gaId) {
  const g = parseGaId(gaId)
  const m = await safeQuery(client,
    `
    SELECT customer_center, system_phone, incall_number, visit_info
    FROM insurance_company_master
    WHERE id = $1
      AND ga_id = $2
    `,
    [companyId, g],
  )
  if (m.rowCount === 0) {
    return emptyCompanySnapshot()
  }
  const row = m.rows[0]
  const c = await safeQuery(client,
    `
    SELECT ic.name, ic.position, ic.phone
    FROM insurance_company_contacts ic
    INNER JOIN insurance_company_master m ON m.id = ic.company_id AND m.ga_id = $2
    WHERE ic.company_id = $1
    ORDER BY ic.id ASC
    `,
    [companyId, g],
  )
  return {
    customerCenter: String(row.customer_center ?? '').trim(),
    system: String(row.system_phone ?? '').trim(),
    incall: String(row.incall_number ?? '').trim(),
    visitInfo: String(row.visit_info ?? '').trim(),
    contacts: c.rows.map((r) => ({
      name: String(r.name ?? '').trim(),
      position: String(r.position ?? '').trim(),
      phone: String(r.phone ?? '').trim(),
    })),
  }
}

function buildCompanySnapshotFromPayload(customerCenter, systemPhone, incallNumber, visitInfo, contactsIn) {
  const contacts = []
  const contactsList = Array.isArray(contactsIn) ? contactsIn : []
  for (const c of contactsList) {
    const cn = String(c?.name ?? '').trim()
    const cp = String(c?.position ?? '').trim()
    const cph = String(c?.phone ?? '').trim()
    if (!cn && !cp && !cph) {
      continue
    }
    contacts.push({ name: cn, position: cp, phone: cph })
  }
  return {
    customerCenter: String(customerCenter ?? '').trim(),
    system: String(systemPhone ?? '').trim(),
    incall: String(incallNumber ?? '').trim(),
    visitInfo: String(visitInfo ?? '').trim(),
    contacts,
  }
}

function normalizeHistoryPayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  return {
    customerCenter: String(p.customerCenter ?? '').trim(),
    system: String(p.system ?? '').trim(),
    incall: String(p.incall ?? '').trim(),
    visitInfo: String(p.visitInfo ?? '').trim(),
    contacts: Array.isArray(p.contacts)
      ? p.contacts.map((c) => ({
          name: String(c?.name ?? '').trim(),
          position: String(c?.position ?? '').trim(),
          phone: String(c?.phone ?? '').trim(),
        }))
      : [],
  }
}

async function touchContactLastUpdatedAt(client, gaId = null) {
  const key =
    gaId != null && Number.isInteger(Number(gaId)) && Number(gaId) > 0
      ? `contact_last_updated_at:${Number(gaId)}`
      : 'contact_last_updated_at'
  await safeQuery(
    client,
    `
    INSERT INTO insurance_contact_meta (meta_key, meta_value, updated_at)
    VALUES ($1, CAST(NOW() AS text), NOW())
    ON CONFLICT (meta_key)
    DO UPDATE SET meta_value = CAST(NOW() AS text), updated_at = NOW()
    `,
    [key],
    { allowUnscoped: true },
  )
}

const app = express()
app.use(express.json({ limit: '12mb' }))

const apiRouter = express.Router()

registerConsentApi(apiRouter, {
  pool,
  requireAuth,
  requireGaAdminOrSuper,
  requireGaTenantAdmin,
  resolveTenantGaIdForRequest,
  isSuperAdminRole,
  isInsurerManagerRole,
  parseCompanyScopeId,
  effectiveTenantGaId,
  parseGaId,
  handleDbError,
  JWT_SECRET,
})

registerInsurerNewsApi(apiRouter, {
  pool,
  requireAuth,
  handleDbError,
  withTransaction,
  effectiveTenantGaId,
  parseGaId,
  resolveTenantGaIdForRequest,
})

function normalizeInviteCode(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

registerAuthAccountSmsApi(apiRouter, {
  pool,
  bcrypt,
  validateCredentials,
  handleDbError,
  RUNNING_IN_PRODUCTION,
  requireAuth,
})

registerUserProfileApi(apiRouter, {
  pool,
  JWT_SECRET,
  handleDbError,
  requireAuth,
  RUNNING_IN_PRODUCTION,
  normalizeInviteCode,
})

registerTeamApi(apiRouter, { pool, requireAuth, handleDbError })

registerNotificationsApi(apiRouter, { pool, requireAuth, handleDbError })

registerSuperAdminAnalyticsApi(apiRouter, {
  pool,
  requireAuth,
  requireSuperAdmin,
  handleDbError,
  systemQuery,
})

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

async function handleRegister(req, res) {
  try {
    const {
      username,
      password,
      invite_code: inviteRaw,
      inviteCode: inviteAlt,
      ref_user_id: refUserSnake,
      refUserId: refUserCamel,
      name: nameRaw,
      display_name: displayNameRaw,
      phone_number: phoneSnake,
      phoneNumber: phoneCamel,
      signup_phone_proof: signupProofSnake,
      signupPhoneProof: signupProofCamel,
      invite_sig: inviteSigSnake,
      inviteSig: inviteSigCamel,
      invite_ts: inviteTsSnake,
      inviteTs: inviteTsCamel,
      sig: sigLoose,
      ts: tsLoose,
    } = req.body ?? {}
    const displayName = String(nameRaw ?? displayNameRaw ?? '').trim()
    if (!displayName) {
      res.status(400).json({ message: '이름을 입력해 주세요.' })
      return
    }

    const code = normalizeInviteCode(inviteRaw ?? inviteAlt ?? '')
    if (!code) {
      res.status(400).json({ message: 'GA 코드 없음' })
      return
    }

    const phoneRaw = phoneSnake ?? phoneCamel
    const phoneTrim = String(phoneRaw ?? '').trim()
    let phoneNorm = ''
    if (phoneTrim) {
      phoneNorm = normalizeKrMobile(phoneRaw)
      const phoneValidationError = validateKrMobileDigits(phoneNorm)
      if (phoneValidationError) {
        res.status(400).json({ message: phoneValidationError })
        return
      }
    } else if (!isSignupPhoneRelaxedMode()) {
      res.status(400).json({ message: '휴대폰 번호는 필수입니다.' })
      return
    }

    const gaCheck = await systemQuery(
      pool,
      `SELECT id, status FROM ga_companies WHERE code = $1 AND is_deleted = false`,
      [code],
    )
    if (gaCheck.rows.length === 0) {
      res.status(400).json({ message: '유효하지 않은 코드입니다' })
      return
    }
    const gaRow = gaCheck.rows[0]
    if (String(gaRow.status ?? '').toLowerCase() !== 'active') {
      res.status(400).json({ message: '가입할 수 없는 GA입니다' })
      return
    }
    const gaId = parseGaId(gaRow.id)
    if (gaId == null) {
      res.status(400).json({ message: '유효하지 않은 코드입니다' })
      return
    }

    const refUserId = String(refUserSnake ?? refUserCamel ?? '').trim()
    if (!refUserId) {
      res.status(400).json({
        message: '담당자 초대 정보가 없습니다. 배포된 가입 링크를 통해 다시 시도해 주세요.',
      })
      return
    }

    const refUserRes = await systemQuery(
      pool,
      `
      SELECT id, role, ga_id, status, is_deleted
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [refUserId],
    )
    const refRow = refUserRes.rows[0]
    if (!refRow || refRow.is_deleted) {
      res.status(400).json({ message: '유효하지 않은 초대 링크입니다.' })
      return
    }
    if (String(refRow.status ?? '').toLowerCase() !== 'active') {
      res.status(400).json({ message: '초대를 받을 수 없는 계정 상태입니다.' })
      return
    }
    if (normalizeUserRole(refRow.role) !== 'USER') {
      res.status(400).json({ message: '일반 설계사(USER) 계정으로만 회원 초대가 가능합니다.' })
      return
    }
    const refGaId = parseGaId(refRow.ga_id)
    if (refGaId == null || refGaId !== gaId) {
      res.status(400).json({ message: '소속 GA가 초대 담당자와 일치하지 않습니다.' })
      return
    }

    const inviteSigRaw = String(
      inviteSigSnake ?? inviteSigCamel ?? sigLoose ?? '',
    ).trim()
    const inviteTsRaw = inviteTsSnake ?? inviteTsCamel ?? tsLoose
    const inviteTsMs = Number(inviteTsRaw)
    const sigCheck = verifyInviteSignupSignature(INVITE_SIGNUP_SECRET, {
      gaCodeNormalized: code,
      refUserId,
      tsMs: inviteTsMs,
      sig: inviteSigRaw,
    })
    if (!sigCheck.ok) {
      const msg =
        sigCheck.reason === 'expired'
          ? '초대 링크가 만료되었습니다. 담당자에게 새 링크를 요청해 주세요.'
          : '유효하지 않거나 변조된 초대 링크입니다. 담당자가 공유한 링크로 다시 시도해 주세요.'
      res.status(400).json({ message: msg })
      return
    }

    const proofRaw = String(signupProofSnake ?? signupProofCamel ?? '').trim()

    function respondProofMismatch(signupProof) {
      if (signupProof.phoneDigits !== phoneNorm) {
        res.status(400).json({ message: '인증된 휴대폰 번호와 가입 폼의 번호가 일치하지 않습니다.' })
        return true
      }
      if (signupProof.inviteCodeNormalized !== code) {
        res
          .status(400)
          .json({ message: '인증 시점의 GA 코드와 현재 입력이 일치하지 않습니다. 인증을 다시 진행해 주세요.' })
        return true
      }
      if (signupProof.gaId !== gaId) {
        res.status(400).json({ message: 'GA 정보가 일치하지 않습니다. 인증을 다시 진행해 주세요.' })
        return true
      }
      return false
    }

    if (!isSignupPhoneRelaxedMode()) {
      if (!phoneNorm) {
        res.status(400).json({ message: '휴대폰 번호는 필수입니다.' })
        return
      }
      if (!proofRaw) {
        res.status(400).json({ message: '휴대폰 인증이 필요합니다.' })
        return
      }
      let signupProof
      try {
        signupProof = verifySignupPhoneProof(proofRaw, JWT_SECRET)
      } catch {
        res.status(400).json({
          message: '휴대폰 인증이 만료되었거나 유효하지 않습니다. 인증부터 다시 진행해 주세요.',
        })
        return
      }
      if (respondProofMismatch(signupProof)) {
        return
      }
    } else if (phoneNorm) {
      if (!proofRaw) {
        res.status(400).json({ message: '휴대폰 인증이 필요합니다.' })
        return
      }
      let signupProof
      try {
        signupProof = verifySignupPhoneProof(proofRaw, JWT_SECRET)
      } catch {
        res.status(400).json({
          message: '휴대폰 인증이 만료되었거나 유효하지 않습니다. 인증부터 다시 진행해 주세요.',
        })
        return
      }
      if (respondProofMismatch(signupProof)) {
        return
      }
    }

    if (!isSignupPhoneRelaxedMode() && phoneNorm) {
      const phoneDup = await systemQuery(
        pool,
        `SELECT id FROM users WHERE phone_number = $1 AND is_deleted = false LIMIT 1`,
        [phoneNorm],
      )
      if (phoneDup.rowCount > 0) {
        res.status(400).json({ message: '이미 사용중인 휴대폰 번호입니다.' })
        return
      }
    }

    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const normalizedUsername = username.trim()
    if (await isUsernameTakenGlobally(pool, normalizedUsername)) {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const id = randomUUID()

    const inserted = await safeQuery(pool,
      `
      INSERT INTO users (id, username, password_hash, role, ga_id, display_name, phone_number, invited_by_user_id)
      VALUES ($1, $2, $3, 'USER', $4, $5, $6, $7)
      RETURNING created_at
      `,
      [id, normalizedUsername, passwordHash, gaId, displayName, phoneNorm || null, refUserId],
    )

    if (phoneNorm) {
      await pool.query(`DELETE FROM sms_verification_codes WHERE purpose = 'SIGNUP' AND phone_number = $1`, [
        phoneNorm,
      ])
    }

    res.status(201).json({
      id,
      username: normalizedUsername,
      ga_id: gaId,
      createdAt: toIsoString(inserted.rows[0].created_at),
    })
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, req, res)
  }
}

async function auditLoginFailure(pool, username, reason) {
  try {
    await writeSecurityAudit(pool, {
      actorUserId: String(username ?? '').slice(0, 120),
      actorRole: 'anonymous',
      action: 'LOGIN_FAILED',
      targetType: 'auth',
      meta: { reason, code: reason },
    })
  } catch (e) {
    console.error('[security_audit LOGIN_FAILED]', e)
  }
}

async function handleLogin(req, res) {
  try {
    const { username, password } = req.body ?? {}
    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const normalizedUsername = username.trim()
    const loginDebug = process.env.INSURANCE_LOGIN_DEBUG === 'true'

    const result = await systemQuery(pool,
      `
      SELECT *
      FROM users
      WHERE username = $1 AND is_deleted = false
      `,
      [normalizedUsername],
    )

    let user = result.rows[0]

    if (!user) {
      const imRes = await systemQuery(
        pool,
        `
        SELECT im.*, g.code AS ga_code, g.name AS ga_name, g.status AS ga_status, g.is_deleted AS ga_deleted
        FROM insurer_managers im
        INNER JOIN ga_companies g ON g.id = im.ga_id
        WHERE im.username = $1 AND im.is_deleted = false
        `,
        [normalizedUsername],
      )
      const im = imRes.rows[0]
      if (!im) {
        await auditLoginFailure(pool, normalizedUsername, 'unknown_user')
        res.status(401).json({
          error: 'Invalid credentials',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        })
        return
      }
      if (loginDebug) {
        console.log('입력 비번:', password)
        console.log('DB hash (insurer_manager):', im.password_hash)
      }
      const imMatch = await bcrypt.compare(password, im.password_hash)
      if (!imMatch) {
        await auditLoginFailure(pool, normalizedUsername, 'invalid_password_insurer_manager')
        res.status(401).json({
          error: 'Invalid credentials',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        })
        return
      }
      if (String(im.status ?? '').toUpperCase() !== 'ACTIVE') {
        await auditLoginFailure(pool, normalizedUsername, 'insurer_manager_inactive')
        res.status(401).json({ message: '접근이 제한된 계정입니다' })
        return
      }
      if (im.ga_deleted === true || String(im.ga_status ?? '').toLowerCase() !== 'active') {
        await auditLoginFailure(pool, normalizedUsername, 'ga_restricted_insurer')
        res.status(401).json({ message: '해당 GA는 현재 사용이 제한되었습니다' })
        return
      }
      const cidCheck = Number(im.company_id)
      if (!Number.isInteger(cidCheck) || cidCheck < 1) {
        await auditLoginFailure(pool, normalizedUsername, 'insurer_missing_company_id')
        res.status(403).json({
          error: 'FORBIDDEN',
          message: '담당자 계정에 보험사(마스터)가 연결되지 않았습니다. 관리자에게 문의하세요.',
        })
        return
      }
      const imGaCode =
        typeof im.ga_code === 'string' && im.ga_code.trim() ? im.ga_code.trim().toUpperCase() : ''
      const imGaName = typeof im.ga_name === 'string' ? im.ga_name.trim() : ''
      const imGaId = parseGaId(im.ga_id)
      const imCompanyId = Number(im.company_id)
      const displayName = String(im.insurer_name ?? '').trim()
      const imToken = jwt.sign(
        {
          userId: im.id,
          sub: im.id,
          username: im.username,
          role: 'INSURER_MANAGER',
          gaId: imGaId,
          gaCode: imGaCode,
          gaName: imGaName,
          companyId:
            Number.isInteger(imCompanyId) && imCompanyId > 0 ? imCompanyId : undefined,
          displayName,
          teamId: null,
        },
        JWT_SECRET,
        { expiresIn: '7d' },
      )
      void logSecurityEvent(pool, {
        actorUserId: String(im.id),
        actorRole: 'INSURER_MANAGER',
        action: 'login_success',
        targetType: 'auth',
        targetId: String(im.id),
        gaId: Number.isInteger(imGaId) ? imGaId : null,
        companyId: Number.isInteger(imCompanyId) && imCompanyId > 0 ? imCompanyId : null,
        meta: { username: im.username },
      })
      void recordAnalyticsEvent(pool, {
        userId: String(im.id),
        gaId: Number.isInteger(imGaId) ? imGaId : null,
        eventType: 'login',
      })
      res.json({
        token: imToken,
        user: {
          id: String(im.id),
          username: im.username,
          role: 'INSURER_MANAGER',
          ga_id: imGaId,
          ga_code: imGaCode,
          ga_name: imGaName,
          company_id:
            Number.isInteger(imCompanyId) && imCompanyId > 0 ? imCompanyId : undefined,
          display_name: displayName,
          team_id: null,
        },
      })
      return
    }

    if (loginDebug) {
      console.log('입력 비번:', password)
      console.log('DB hash:', user.password_hash)
    }

    const match = await bcrypt.compare(password, user.password_hash)

    if (!match) {
      await auditLoginFailure(pool, normalizedUsername, 'invalid_password_user')
      res.status(401).json({
        error: 'Invalid credentials',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    if (user.is_deleted === true) {
      res.status(401).json({ message: '접근이 제한된 계정입니다' })
      return
    }
    const userStatus = String(user.status ?? 'active').toLowerCase()
    if (userStatus !== 'active') {
      res.status(401).json({ message: '접근이 제한된 계정입니다' })
      return
    }

    const uid = String(user.id)
    const role = normalizeUserRole(user.role)
    const gaId = parseGaId(user.ga_id)
    if (role !== 'SUPER_ADMIN' && gaId == null) {
      res.status(500).json({ message: '계정에 GA가 연결되지 않았습니다. 관리자에게 문의하세요.' })
      return
    }

    let gaCode = ''
    let gaName = ''
    if (gaId != null) {
      const gRow = await systemQuery(
        pool,
        `SELECT code, name, status, is_deleted FROM ga_companies WHERE id = $1`,
        [gaId],
      )
      const g0 = gRow.rows[0]
      if (!g0 || g0.is_deleted === true) {
        res.status(401).json({ message: '해당 GA는 현재 사용이 제한되었습니다' })
        return
      }
      if (String(g0.status ?? '').toLowerCase() !== 'active') {
        res.status(401).json({ message: '해당 GA는 현재 사용이 제한되었습니다' })
        return
      }
      const rawCode = g0?.code
      gaCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
      gaName = typeof g0?.name === 'string' ? g0.name.trim() : ''
    }

    const userDisplayName = String(user.display_name ?? user.username ?? '').trim()
    const userTeamId = user.team_id != null ? String(user.team_id) : null
    const token = jwt.sign(
      {
        userId: user.id,
        sub: user.id,
        username: user.username,
        role,
        gaId,
        gaCode,
        gaName,
        displayName: userDisplayName,
        teamId: userTeamId,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    )

    const gaIdInt = gaId != null && Number.isInteger(gaId) ? gaId : null
    void logSecurityEvent(pool, {
      actorUserId: uid,
      actorRole: role,
      action: 'login_success',
      targetType: 'auth',
      targetId: uid,
      gaId: gaIdInt,
      companyId: null,
      meta: { username: user.username },
    })
    void recordAnalyticsEvent(pool, { userId: uid, gaId: gaIdInt, eventType: 'login' })

    res.json({
      token,
      user: {
        id: uid,
        username: user.username,
        role,
        ga_id: gaId,
        ga_code: gaCode,
        ga_name: gaName,
        display_name: userDisplayName,
        team_id: userTeamId,
      },
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
}

apiRouter.post('/register', handleRegister)
apiRouter.post('/auth/register', handleRegister)
apiRouter.post('/auth/signup', handleRegister)

apiRouter.get('/auth/invite-signup-url', requireAuth, async (req, res) => {
  try {
    if (normalizeUserRole(req.user.role) !== 'USER') {
      res
        .status(403)
        .json({ message: '초대 링크는 일반 설계사(USER) 계정에서만 발급할 수 있습니다.' })
      return
    }
    let gaCode = normalizeInviteCode(req.user.gaCode ?? '')
    if (!gaCode) {
      const r = await systemQuery(
        pool,
        `
        SELECT g.code
        FROM users u
        INNER JOIN ga_companies g ON g.id = u.ga_id
        WHERE u.id = $1
        LIMIT 1
        `,
        [req.user.id],
      )
      gaCode = normalizeInviteCode(r.rows[0]?.code ?? '')
    }
    if (!gaCode) {
      res.status(400).json({ message: 'GA 코드를 확인할 수 없습니다.' })
      return
    }
    const refUserId = String(req.user.id).trim()
    const ts = Date.now()
    let sig
    try {
      sig = signInviteSignup(INVITE_SIGNUP_SECRET, gaCode, refUserId, ts)
    } catch (e) {
      if (e?.message === 'invite_signup_missing_secret') {
        res.status(500).json({ message: '서버 설정 오류입니다.' })
        return
      }
      throw e
    }
    const q = new URLSearchParams({
      ga: gaCode,
      ref: refUserId,
      ts: String(ts),
      sig,
    })
    res.json({ path: `/register?${q.toString()}` })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/login', handleLogin)
apiRouter.post('/auth/login', handleLogin)

apiRouter.get('/auth/username-availability', async (req, res) => {
  try {
    const raw = String(req.query.username ?? '').trim()
    if (!raw || raw.length < 3 || raw.length > 30 || /\s/.test(raw)) {
      res.json({ available: false })
      return
    }
    const taken = await isUsernameTakenGlobally(pool, raw)
    res.json({ available: !taken })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/admin/health/insurer-managers', requireAuth, requireInsurerHealthReader, async (req, res) => {
  try {
    const gaIdFilter = isSuperAdminRole(req.user?.role) ? null : parseGaId(req.user?.gaId)
    if (!isSuperAdminRole(req.user?.role) && gaIdFilter == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const summary = await loadInsurerManagerHealthSummary(pool, gaIdFilter)
    res.json({
      total: summary.total,
      broken: summary.broken,
      invalidCategory: summary.invalidCategory,
      nullCompany: summary.nullCompany,
      fkBroken: summary.fkBroken,
      gaMismatch: summary.gaMismatch,
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/admin/audit-logs', requireAuth, requireAuditLogReader, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50))
    const actionQ = String(req.query.action ?? '').trim()
    const actorUserIdQ = String(req.query.actor_user_id ?? '').trim()
    const sinceQ = String(req.query.since ?? '').trim()

    const superUser = isSuperAdminRole(req.user.role)
    const userGa = parseGaId(req.user.gaId)
    if (!superUser && userGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    let sql = `
      SELECT id, actor_user_id, actor_role, action, target_type, target_id, ga_id, company_id, meta, created_at
      FROM security_audit_logs
      WHERE 1=1
    `
    const params = []
    let i = 1
    if (!superUser) {
      sql += ` AND ga_id = $${i}`
      i += 1
      params.push(userGa)
    }
    if (actionQ) {
      sql += ` AND action = $${i}`
      i += 1
      params.push(actionQ)
    }
    if (actorUserIdQ) {
      sql += ` AND actor_user_id = $${i}`
      i += 1
      params.push(actorUserIdQ)
    }
    if (sinceQ) {
      const d = new Date(sinceQ)
      if (!Number.isNaN(d.getTime())) {
        sql += ` AND created_at >= $${i}`
        i += 1
        params.push(d.toISOString())
      }
    }
    sql += ` ORDER BY created_at DESC NULLS LAST, id DESC LIMIT $${i}`
    params.push(limit)

    const r = await systemQuery(pool, sql, params)
    res.json(r.rows)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/insurer-managers', requireAuth, requireGaAdminOrSuper, async (req, res) => {
  try {
    const gaId = await resolveTenantGaIdForRequest(pool, req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const r = await safeQuery(
      pool,
      `
      SELECT im.id, im.company_id, im.insurer_type, im.insurer_name, im.username, im.password_plaintext, im.status, im.created_at, g.code AS ga_code
      FROM insurer_managers im
      INNER JOIN ga_companies g ON g.id = im.ga_id
      WHERE im.ga_id = $1 AND im.is_deleted = false
      ORDER BY im.created_at DESC
      `,
      [gaId],
    )
    res.json(r.rows.map(mapInsurerManagerRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/insurer-managers', requireAuth, requireGaInsurerManagerMutator, async (req, res) => {
  try {
    const gaId = await resolveTenantGaIdForRequest(pool, req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const body = req.body ?? {}
    if (!assertNoInsurerNameInPayload(body, res)) {
      return
    }
    const typeNorm = parseInsurerManagerType(body.insurer_type ?? body.insurerType)
    const companyIdRaw = body.company_id ?? body.companyId
    const companyMasterId = Number(companyIdRaw)
    const { username, password } = body
    if (!typeNorm) {
      res.status(400).json({ message: '보험사 유형을 선택해 주세요.' })
      return
    }
    const link = await validateInsurerManagerCompanyLink(pool, gaId, companyMasterId, typeNorm)
    if (!link.ok) {
      res.status(400).json({ message: link.message })
      return
    }
    const nameNorm = link.master.name
    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }
    const normalizedUsername = String(username).trim()
    if (await isUsernameTakenGlobally(pool, normalizedUsername)) {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    const dupGaInsurer = await safeQuery(
      pool,
      `
      SELECT 1 FROM insurer_managers
      WHERE ga_id = $1 AND company_id = $2 AND is_deleted = false
      LIMIT 1
      `,
      [gaId, link.master.id],
    )
    if (dupGaInsurer.rowCount > 0) {
      res.status(409).json({ message: '해당 보험사에 이미 등록된 담당자 계정이 있습니다.' })
      return
    }
    const id = randomUUID()
    const plainPw = String(password)
    const passwordHash = await bcrypt.hash(plainPw, 10)
    const ins = await safeQuery(
      pool,
      `
      INSERT INTO insurer_managers (id, ga_id, company_id, insurer_type, insurer_name, username, password_hash, password_plaintext, status, is_deleted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', false)
      RETURNING id, company_id, insurer_type, insurer_name, username, password_plaintext, status, created_at
      `,
      [id, gaId, link.master.id, typeNorm, nameNorm, normalizedUsername, passwordHash, plainPw],
    )
    const g0 = await systemQuery(pool, `SELECT code FROM ga_companies WHERE id = $1`, [gaId])
    try {
      await writeSecurityAudit(pool, {
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'insurer_manager_create',
        targetType: 'insurer_manager',
        targetId: id,
        gaId,
        companyId: link.master.id,
        meta: { username: normalizedUsername },
      })
    } catch (auditErr) {
      console.error('[audit insurer_manager_create]', auditErr)
    }
    res.status(201).json(
      mapInsurerManagerRow({
        ...ins.rows[0],
        ga_code: g0.rows[0]?.code ?? '',
      }),
    )
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디이거나 동일 보험사에 계정이 있습니다.' })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.patch('/insurer-managers/:id', requireAuth, requireGaInsurerManagerMutator, async (req, res) => {
  try {
    const gaId = await resolveTenantGaIdForRequest(pool, req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const targetId = String(req.params.id ?? '').trim()
    if (!targetId) {
      res.status(400).json({ message: '잘못된 ID입니다.' })
      return
    }
    const exist = await safeQuery(
      pool,
      `
      SELECT id, username, insurer_type, insurer_name, status, company_id
      FROM insurer_managers
      WHERE id = $1 AND ga_id = $2 AND is_deleted = false
      `,
      [targetId, gaId],
    )
    if (exist.rowCount === 0) {
      res.status(404).json({ message: '담당자를 찾을 수 없습니다.' })
      return
    }
    const cur = exist.rows[0]
    const body = req.body ?? {}
    if (!assertNoInsurerNameInPayload(body, res)) {
      return
    }

    let newUsername = null
    if (Object.prototype.hasOwnProperty.call(body, 'username')) {
      newUsername = String(body.username ?? '').trim()
      if (!newUsername || newUsername.length < 3 || newUsername.length > 30) {
        res.status(400).json({ message: '아이디는 3~30자여야 합니다.' })
        return
      }
    }
    let newType = null
    if (
      Object.prototype.hasOwnProperty.call(body, 'insurer_type') ||
      Object.prototype.hasOwnProperty.call(body, 'insurerType')
    ) {
      newType = parseInsurerManagerType(body.insurer_type ?? body.insurerType)
      if (!newType) {
        res.status(400).json({ message: '보험사 유형이 올바르지 않습니다.' })
        return
      }
    }
    let newStatus = null
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      newStatus = parseInsurerManagerStatusDb(body.status)
      if (!newStatus) {
        res.status(400).json({ message: 'status는 ACTIVE 또는 BLOCKED 여야 합니다.' })
        return
      }
    }
    let passwordUpdate = null
    if (Object.prototype.hasOwnProperty.call(body, 'password')) {
      const p = body.password
      if (typeof p === 'string' && p.trim() !== '') {
        if (p.length < 4 || p.length > 100) {
          res.status(400).json({ message: '비밀번호는 4~100자여야 합니다.' })
          return
        }
        passwordUpdate = p
      }
    }

    if (newUsername != null && newUsername !== cur.username) {
      if (await isUsernameTakenGlobally(pool, newUsername, { excludeInsurerManagerId: targetId })) {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
    }

    const effectiveType = newType ?? cur.insurer_type
    let nextCompanyId = Number(cur.company_id)
    let nextInsurerName = String(cur.insurer_name ?? '').trim()

    const companyIdTouched =
      Object.prototype.hasOwnProperty.call(body, 'company_id') ||
      Object.prototype.hasOwnProperty.call(body, 'companyId')
    if (companyIdTouched) {
      const cid = Number(body.company_id ?? body.companyId)
      const link = await validateInsurerManagerCompanyLink(pool, gaId, cid, effectiveType)
      if (!link.ok) {
        res.status(400).json({ message: link.message })
        return
      }
      nextCompanyId = link.master.id
      nextInsurerName = link.master.name
    } else if (newType != null && newType !== cur.insurer_type) {
      const link = await validateInsurerManagerCompanyLink(pool, gaId, cur.company_id, newType)
      if (!link.ok) {
        res.status(400).json({ message: link.message })
        return
      }
    }

    if (nextCompanyId !== Number(cur.company_id)) {
      const dup = await safeQuery(
        pool,
        `
        SELECT 1 FROM insurer_managers
        WHERE ga_id = $1 AND company_id = $2 AND is_deleted = false AND id <> $3
        LIMIT 1
        `,
        [gaId, nextCompanyId, targetId],
      )
      if (dup.rowCount > 0) {
        res.status(409).json({ message: '해당 보험사에 이미 등록된 담당자 계정이 있습니다.' })
        return
      }
    }

    const setParts = []
    const vals = []
    let n = 1
    if (newType != null) {
      setParts.push(`insurer_type = $${n++}`)
      vals.push(newType)
    }
    if (nextCompanyId !== Number(cur.company_id)) {
      setParts.push(`company_id = $${n++}`)
      vals.push(nextCompanyId)
      setParts.push(`insurer_name = $${n++}`)
      vals.push(nextInsurerName)
    }
    if (newUsername != null) {
      setParts.push(`username = $${n++}`)
      vals.push(newUsername)
    }
    if (newStatus != null) {
      setParts.push(`status = $${n++}`)
      vals.push(newStatus)
    }
    if (passwordUpdate != null) {
      setParts.push(`password_hash = $${n++}`)
      vals.push(await bcrypt.hash(passwordUpdate, 10))
      setParts.push(`password_plaintext = $${n++}`)
      vals.push(passwordUpdate)
    }

    if (setParts.length === 0) {
      res.status(400).json({ message: '수정할 필드가 없습니다.' })
      return
    }
    setParts.push('updated_at = NOW()')
    const idPos = n
    const gaPos = n + 1
    vals.push(targetId, gaId)
    const upd = await safeQuery(
      pool,
      `
      UPDATE insurer_managers
      SET ${setParts.join(', ')}
      WHERE id = $${idPos} AND ga_id = $${gaPos} AND is_deleted = false
      RETURNING id, company_id, insurer_type, insurer_name, username, password_plaintext, status, created_at
      `,
      vals,
    )
    const g0 = await systemQuery(pool, `SELECT code FROM ga_companies WHERE id = $1`, [gaId])
    const prevCompanyId = Number(cur.company_id)
    try {
      await writeSecurityAudit(pool, {
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'insurer_manager_update',
        targetType: 'insurer_manager',
        targetId,
        gaId,
        companyId: nextCompanyId,
        meta: {
          companyIdChanged: nextCompanyId !== prevCompanyId,
          prevCompanyId,
          statusTouched: newStatus != null,
          usernameTouched: newUsername != null,
        },
      })
    } catch (auditErr) {
      console.error('[audit insurer_manager_update]', auditErr)
    }
    if (newStatus === 'BLOCKED' && String(cur.status ?? '').toUpperCase() !== 'BLOCKED') {
      void logSecurityEvent(pool, {
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'insurer_manager_deactivate',
        targetType: 'insurer_manager',
        targetId,
        gaId,
        companyId: nextCompanyId,
      })
    }
    res.json(
      mapInsurerManagerRow({
        ...upd.rows[0],
        ga_code: g0.rows[0]?.code ?? '',
      }),
    )
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디이거나 동일 보험사에 계정이 있습니다.' })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.get('/admin/ga', requireAuth, async (req, res) => {
  try {
    if (isSuperAdminRole(req.user.role)) {
      const r = await systemQuery(
        pool,
        `
        SELECT id, name, code, status, created_at
        FROM ga_companies
        WHERE is_deleted = false
        ORDER BY id ASC
        `,
      )
      res.json(r.rows)
      return
    }
    const gid = parseGaId(req.user?.gaId)
    if (gid == null) {
      res.json([])
      return
    }
    const r = await systemQuery(
      pool,
      `
      SELECT id, name, code, status, created_at
      FROM ga_companies
      WHERE id = $1 AND is_deleted = false
      `,
      [gid],
    )
    res.json(r.rows)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/admin/ga', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim()
    const code = String(req.body?.code ?? '').trim().toUpperCase()
    if (!name || !code) {
      res.status(400).json({ message: 'name과 code가 필요합니다.' })
      return
    }
    if (!/^[A-Z0-9_]{2,32}$/.test(code)) {
      res.status(400).json({ message: 'code는 2~32자의 영문 대문자·숫자·밑줄만 사용할 수 있습니다.' })
      return
    }
    const ins = await systemQuery(
      pool,
      `
      INSERT INTO ga_companies (name, code, status, is_deleted)
      VALUES ($1, $2, 'active', false)
      RETURNING id, name, code, status, created_at
      `,
      [name, code],
    )
    res.status(201).json(ins.rows[0])
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 존재하는 코드입니다' })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.patch('/admin/ga/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: '잘못된 GA ID입니다.' })
      return
    }
    const exists = await systemQuery(
      pool,
      `SELECT id FROM ga_companies WHERE id = $1 AND is_deleted = false`,
      [id],
    )
    if (exists.rowCount === 0) {
      res.status(404).json({ message: 'GA를 찾을 수 없습니다.' })
      return
    }

    const parts = []
    const vals = []
    let n = 1
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'name')) {
      const name = String(req.body?.name ?? '').trim()
      if (!name) {
        res.status(400).json({ message: 'name이 비어 있을 수 없습니다.' })
        return
      }
      parts.push(`name = $${n++}`)
      vals.push(name)
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'code')) {
      const code = String(req.body?.code ?? '').trim().toUpperCase()
      if (!/^[A-Z0-9_]{2,32}$/.test(code)) {
        res.status(400).json({ message: 'code는 2~32자의 영문 대문자·숫자·밑줄만 사용할 수 있습니다.' })
        return
      }
      const dupCode = await systemQuery(
        pool,
        `
        SELECT 1 FROM ga_companies
        WHERE code = $1 AND id <> $2 AND is_deleted = false
        LIMIT 1
        `,
        [code, id],
      )
      if (dupCode.rowCount > 0) {
        res.status(409).json({ message: '이미 존재하는 코드입니다' })
        return
      }
      parts.push(`code = $${n++}`)
      vals.push(code)
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'status')) {
      const st = parseEntityStatus(req.body?.status)
      if (!st) {
        res.status(400).json({ message: 'status는 active, blocked, inactive 중 하나여야 합니다.' })
        return
      }
      parts.push(`status = $${n++}`)
      vals.push(st)
    }

    if (parts.length === 0) {
      res.status(400).json({ message: '수정할 필드가 없습니다.' })
      return
    }

    vals.push(id)
    const upd = await systemQuery(
      pool,
      `
      UPDATE ga_companies
      SET ${parts.join(', ')}
      WHERE id = $${n} AND is_deleted = false
      RETURNING id, name, code, status, created_at
      `,
      vals,
    )
    res.json(upd.rows[0])
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 존재하는 코드입니다' })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.delete('/admin/ga/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: '잘못된 GA ID입니다.' })
      return
    }
    const upd = await systemQuery(
      pool,
      `
      UPDATE ga_companies
      SET is_deleted = true
      WHERE id = $1 AND is_deleted = false
      RETURNING id
      `,
      [id],
    )
    if (upd.rowCount === 0) {
      res.status(404).json({ message: 'GA를 찾을 수 없습니다.' })
      return
    }
    res.status(204).send()
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/admin/users', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const filterGa = parseGaId(req.query.ga_id ?? req.query.gaId)
    const r = await safeQuery(pool,
      `
      SELECT
        u.id,
        u.ga_id,
        u.display_name,
        g.name AS ga_company_name,
        u.username,
        u.role,
        u.status,
        u.created_at
      FROM users u
      INNER JOIN ga_companies g ON g.id = u.ga_id
      WHERE u.is_deleted = false AND g.is_deleted = false
        AND ($1::int IS NULL OR u.ga_id = $1::int)
      ORDER BY g.name ASC, u.username ASC
      `,
      [filterGa],
    )
    const rows = r.rows.map((row) => ({
      id: String(row.id),
      ga_id: row.ga_id,
      display_name: String(row.display_name ?? '').trim(),
      ga_company_name: row.ga_company_name,
      username: row.username,
      role: normalizeUserRole(row.role),
      status: String(row.status ?? 'active').toLowerCase(),
      created_at: toIsoString(row.created_at),
    }))
    res.json(rows)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.patch('/admin/users/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const targetId = String(req.params.id ?? '').trim()
    if (!targetId) {
      res.status(400).json({ message: '잘못된 사용자 ID입니다.' })
      return
    }

    const body = req.body ?? {}
    const hasGa = Object.prototype.hasOwnProperty.call(body, 'ga_id') || Object.prototype.hasOwnProperty.call(body, 'gaId')
    const hasRole = Object.prototype.hasOwnProperty.call(body, 'role')
    const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')

    const gaId = hasGa ? parseGaId(body.ga_id ?? body.gaId) : null
    const roleNorm = hasRole ? parseAdminPatchRole(body.role) : null
    const statusNorm = hasStatus ? parseEntityStatus(body.status) : null

    if (!hasGa && !hasRole && !hasStatus) {
      res.status(400).json({ message: 'ga_id, role, status 중 하나 이상이 필요합니다.' })
      return
    }
    if (hasGa && gaId == null) {
      res.status(400).json({ message: 'ga_id가 올바르지 않습니다.' })
      return
    }
    if (hasRole && !roleNorm) {
      res.status(400).json({
        message: 'role이 올바르지 않습니다. (USER, GA_ADMIN, GA_STAFF, SUPER_ADMIN 또는 user, admin, super_admin)',
      })
      return
    }
    if (hasStatus && !statusNorm) {
      res.status(400).json({ message: 'status는 active, blocked, inactive 중 하나여야 합니다.' })
      return
    }

    if (gaId != null) {
      const gaOk = await systemQuery(
        pool,
        `SELECT 1 FROM ga_companies WHERE id = $1 AND is_deleted = false`,
        [gaId],
      )
      if (gaOk.rows.length === 0) {
        res.status(400).json({ message: '유효하지 않은 GA입니다.' })
        return
      }
    }

    const before = await systemQuery(pool,
      `SELECT id, ga_id FROM users WHERE id = $1 AND is_deleted = false`,
      [targetId],
    )
    if (before.rows.length === 0) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
      return
    }
    const prevGaId = parseGaId(before.rows[0].ga_id)
    if (prevGaId == null) {
      res.status(400).json({ message: '사용자 GA 정보가 올바르지 않습니다.' })
      return
    }

    const parts = []
    const vals = []
    let n = 1
    if (gaId != null) {
      parts.push(`ga_id = $${n++}`)
      vals.push(gaId)
    }
    if (roleNorm) {
      parts.push(`role = $${n++}`)
      vals.push(roleNorm)
      if (roleNorm !== 'GA_ADMIN' && roleNorm !== 'GA_STAFF') {
        parts.push('delegate_password_plaintext = NULL')
      }
    }
    if (statusNorm) {
      parts.push(`status = $${n++}`)
      vals.push(statusNorm)
    }

    vals.push(targetId, prevGaId)
    const upd = await safeQuery(pool,
      `
      UPDATE users
      SET ${parts.join(', ')}
      WHERE id = $${n} AND ga_id = $${n + 1} AND is_deleted = false
      RETURNING id, username, ga_id, display_name, role, status, created_at
      `,
      vals,
    )
    if (upd.rowCount === 0) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
      return
    }
    const row = upd.rows[0]
    const g = await systemQuery(pool, `SELECT name FROM ga_companies WHERE id = $1`, [row.ga_id])
    res.json({
      id: String(row.id),
      username: row.username,
      display_name: String(row.display_name ?? '').trim(),
      ga_id: row.ga_id,
      ga_company_name: g.rows[0]?.name ?? '',
      role: normalizeUserRole(row.role),
      status: String(row.status ?? 'active').toLowerCase(),
      created_at: toIsoString(row.created_at),
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.delete('/admin/users/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect()
  try {
    const targetId = String(req.params.id ?? '').trim()
    const actorId = String(req.user?.id ?? '').trim()
    if (!targetId) {
      res.status(400).json({ message: '잘못된 사용자 ID입니다.' })
      return
    }
    if (actorId && targetId === actorId) {
      res.status(400).json({ message: '자기 자신은 삭제할 수 없습니다.' })
      return
    }

    const scope = await systemQuery(pool,
      `SELECT id, username FROM users WHERE id = $1 AND is_deleted = false`,
      [targetId],
    )
    if (scope.rowCount === 0) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
      return
    }
    const bootstrapUsername = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME || 'admin').trim()
    if (String(scope.rows[0].username ?? '').trim() === bootstrapUsername) {
      res.status(403).json({ message: '시스템에서 보호되는 관리자 계정은 삭제할 수 없습니다.' })
      return
    }

    await client.query('BEGIN')
    await client.query(`DELETE FROM sms_verification_codes WHERE user_id = $1`, [targetId])
    await client.query(`DELETE FROM sms_verification_logs WHERE user_id = $1`, [targetId])
    const del = await client.query(`DELETE FROM users WHERE id = $1`, [targetId])
    await client.query('COMMIT')
    if (del.rowCount === 0) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
      return
    }
    res.status(204).send()
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    handleDbError(error, req, res)
  } finally {
    client.release()
  }
})

/**
 * GA 담당자(GA_ADMIN/GA_STAFF) 계정 생성 공통 검증·삽입.
 * @returns {{ ok: true, id: string, username: string, role: string, ga_id: number, displayName: string } | { ok: false, status: number, message: string }}
 */
async function tryCreateGaDelegateFromRequest(req) {
  const isSuper = isSuperAdminRole(req.user?.role)
  const actorGaId = parseGaId(req.user?.gaId)
  if (!isSuper && actorGaId == null) {
    return { ok: false, status: 400, message: 'GA 컨텍스트가 없습니다.' }
  }
  const { username, password, name, ga_id: gaRaw, gaId: gaBody, role: roleRaw } = req.body ?? {}
  const targetGaId = parseGaId(gaRaw ?? gaBody)
  if (targetGaId == null) {
    return { ok: false, status: 400, message: 'ga_id가 필요합니다.' }
  }
  if (!isSuper && targetGaId !== actorGaId) {
    return { ok: false, status: 403, message: '자신이 속한 GA에만 사용자를 생성할 수 있습니다.' }
  }
  const gaOk = await systemQuery(
    pool,
    `
    SELECT 1 FROM ga_companies
    WHERE id = $1 AND is_deleted = false AND status = 'active'
    `,
    [targetGaId],
  )
  if (gaOk.rowCount === 0) {
    return { ok: false, status: 400, message: '유효하지 않은 GA입니다.' }
  }

  const roleNorm = typeof roleRaw === 'string' ? roleRaw.trim().toUpperCase() : ''
  const targetRole = GA_DELEGATE_ROLES.includes(roleNorm) ? roleNorm : null
  if (!targetRole) {
    return { ok: false, status: 400, message: 'role은 GA_ADMIN 또는 GA_STAFF 여야 합니다.' }
  }

  const validationMessage = validateCredentials(username, password)
  if (validationMessage) {
    return { ok: false, status: 400, message: validationMessage }
  }

  const normalizedUsername = String(username).trim()
  const displayName = String(name ?? '').trim()
  if (await isUsernameTakenGlobally(pool, normalizedUsername)) {
    return { ok: false, status: 409, message: '이미 사용 중인 아이디입니다.' }
  }
  const plainPassword = String(password)
  const passwordHash = await bcrypt.hash(plainPassword, 10)
  const id = randomUUID()

  const invitedBy = String(req.user?.id ?? '').trim()
  if (!invitedBy) {
    return { ok: false, status: 401, message: '생성 주체를 확인할 수 없습니다.' }
  }

  await safeQuery(pool,
    `
    INSERT INTO users (id, username, password_hash, role, display_name, ga_id, delegate_password_plaintext, invited_by_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [id, normalizedUsername, passwordHash, targetRole, displayName, targetGaId, plainPassword, invitedBy],
  )

  return { ok: true, id, username: normalizedUsername, role: targetRole, ga_id: targetGaId, displayName }
}

async function postAdminCreateDelegateUser(req, res) {
  try {
    const result = await tryCreateGaDelegateFromRequest(req)
    if (!result.ok) {
      res.status(result.status).json({ message: result.message })
      return
    }
    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        username: result.username,
        role: result.role,
        ga_id: result.ga_id,
        displayName: result.displayName,
      },
    })
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, req, res)
  }
}

apiRouter.post('/admin/user', requireAuth, requireSuperAdmin, postAdminCreateDelegateUser)

apiRouter.get('/admin/delegates', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const r = await systemQuery(
      pool,
      `
      SELECT
        u.id,
        u.username,
        u.role,
        u.status,
        u.created_at,
        u.ga_id,
        u.delegate_password_plaintext,
        g.name AS ga_name,
        g.code AS ga_code
      FROM users u
      INNER JOIN ga_companies g ON g.id = u.ga_id
      WHERE u.is_deleted = false
        AND g.is_deleted = false
        AND u.role IN ('GA_ADMIN', 'GA_STAFF')
      ORDER BY g.name ASC, u.username ASC
      `,
    )
    res.json(r.rows.map(mapGaDelegateAdminRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/admin/delegates', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await tryCreateGaDelegateFromRequest(req)
    if (!result.ok) {
      res.status(result.status).json({ message: result.message })
      return
    }
    const rowQ = await systemQuery(
      pool,
      `
      SELECT
        u.id,
        u.username,
        u.role,
        u.status,
        u.created_at,
        u.ga_id,
        u.delegate_password_plaintext,
        g.name AS ga_name,
        g.code AS ga_code
      FROM users u
      INNER JOIN ga_companies g ON g.id = u.ga_id
      WHERE u.id = $1
      `,
      [result.id],
    )
    res.status(201).json(mapGaDelegateAdminRow(rowQ.rows[0]))
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.patch('/admin/delegates/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const targetId = String(req.params.id ?? '').trim()
    if (!targetId) {
      res.status(400).json({ message: '잘못된 ID입니다.' })
      return
    }
    const curQ = await systemQuery(
      pool,
      `
      SELECT id, username, role, status, ga_id, delegate_password_plaintext
      FROM users
      WHERE id = $1 AND is_deleted = false
      `,
      [targetId],
    )
    if (curQ.rowCount === 0) {
      res.status(404).json({ message: '담당자를 찾을 수 없습니다.' })
      return
    }
    const cur = curQ.rows[0]
    const roleNorm = normalizeUserRole(cur.role)
    if (roleNorm !== 'GA_ADMIN' && roleNorm !== 'GA_STAFF') {
      res.status(400).json({ message: 'GA 담당자 계정만 수정할 수 있습니다.' })
      return
    }

    const body = req.body ?? {}
    let newUsername = null
    if (Object.prototype.hasOwnProperty.call(body, 'username')) {
      newUsername = String(body.username ?? '').trim()
      if (!newUsername || newUsername.length < 3 || newUsername.length > 30) {
        res.status(400).json({ message: '아이디는 3~30자여야 합니다.' })
        return
      }
    }
    let newStatus = null
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      newStatus = parseEntityStatus(body.status)
      if (!newStatus) {
        res.status(400).json({ message: 'status는 active, blocked, inactive 중 하나여야 합니다.' })
        return
      }
    }
    let passwordUpdate = null
    if (Object.prototype.hasOwnProperty.call(body, 'password')) {
      const p = body.password
      if (typeof p === 'string' && p.trim() !== '') {
        if (p.length < 4 || p.length > 100) {
          res.status(400).json({ message: '비밀번호는 4~100자여야 합니다.' })
          return
        }
        passwordUpdate = p
      }
    }

    if (newUsername != null && newUsername !== cur.username) {
      if (await isUsernameTakenGlobally(pool, newUsername, { excludeUserId: targetId })) {
        res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
        return
      }
    }

    const setParts = []
    const vals = []
    let n = 1
    if (newUsername != null && newUsername !== cur.username) {
      setParts.push(`username = $${n++}`)
      vals.push(newUsername)
    }
    const curStatus = String(cur.status ?? 'active').toLowerCase()
    if (newStatus != null && newStatus !== curStatus) {
      setParts.push(`status = $${n++}`)
      vals.push(newStatus)
    }
    if (passwordUpdate != null) {
      setParts.push(`password_hash = $${n++}`)
      vals.push(await bcrypt.hash(passwordUpdate, 10))
      setParts.push(`delegate_password_plaintext = $${n++}`)
      vals.push(passwordUpdate)
    }
    if (setParts.length > 0) {
      const curGaId = parseGaId(cur.ga_id)
      if (curGaId == null) {
        res.status(400).json({ message: '담당자 GA 정보가 올바르지 않습니다.' })
        return
      }
      vals.push(targetId, curGaId)
      await safeQuery(
        pool,
        `
        UPDATE users
        SET ${setParts.join(', ')}
        WHERE id = $${n} AND ga_id = $${n + 1} AND is_deleted = false
        RETURNING id
        `,
        vals,
      )
    }
    const rowQ = await systemQuery(
      pool,
      `
      SELECT
        u.id,
        u.username,
        u.role,
        u.status,
        u.created_at,
        u.ga_id,
        u.delegate_password_plaintext,
        g.name AS ga_name,
        g.code AS ga_code
      FROM users u
      INNER JOIN ga_companies g ON g.id = u.ga_id
      WHERE u.id = $1
      `,
      [targetId],
    )
    res.json(mapGaDelegateAdminRow(rowQ.rows[0]))
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.post('/feature-request', requireAuth, async (req, res) => {
  try {
    const gaId = parseGaId(req.user?.gaId)
    const userId = req.user?.id
    if (gaId == null || !userId) {
      res.status(400).json({ message: '세션 정보가 올바르지 않습니다.' })
      return
    }
    const content = String(req.body?.content ?? '').trim()
    if (!content) {
      res.status(400).json({ message: '내용을 입력해 주세요.' })
      return
    }
    if (content.length > 8000) {
      res.status(400).json({ message: '내용은 8000자 이하로 입력해 주세요.' })
      return
    }
    let title = String(req.body?.title ?? '').trim()
    if (title.length > 200) {
      res.status(400).json({ message: '제목은 200자 이하로 입력해 주세요.' })
      return
    }
    if (!title) {
      title = content.length > 120 ? `${content.slice(0, 117)}...` : content
    }
    const ins = await safeQuery(pool,
      `
      INSERT INTO feature_requests (ga_id, user_id, title, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
      `,
      [gaId, userId, title, content],
    )
    res.status(201).json({
      id: ins.rows[0].id,
      created_at: toIsoString(ins.rows[0].created_at),
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/feature-requests/my', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    const gaId = parseGaId(req.user?.gaId)
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const r = await safeQuery(pool,
      `
      SELECT id, title, content, status, created_at
      FROM feature_requests
      WHERE user_id = $1 AND ga_id = $2
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [userId, gaId],
    )
    const rows = r.rows.map((row) => ({
      id: row.id,
      title: String(row.title ?? ''),
      content: row.content,
      status: row.status,
      created_at: toIsoString(row.created_at),
    }))
    res.json(rows)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.delete('/feature-requests/my/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: '잘못된 ID입니다.' })
      return
    }
    const userId = req.user?.id
    const gaId = parseGaId(req.user?.gaId)
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const del = await safeQuery(
      pool,
      `
      DELETE FROM feature_requests
      WHERE id = $1 AND user_id = $2 AND ga_id = $3
      `,
      [id, userId, gaId],
    )
    if (del.rowCount === 0) {
      res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
      return
    }
    res.status(204).send()
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/admin/feature-requests', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const actorGa = parseGaId(req.user?.gaId)
    if (actorGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const r = await safeQuery(pool,
      `
      SELECT
        fr.id,
        fr.ga_id,
        g.name AS ga_name,
        u.username,
        COALESCE(fr.title, '') AS title,
        fr.content,
        fr.status,
        fr.created_at
      FROM feature_requests fr
      INNER JOIN ga_companies g ON g.id = fr.ga_id
      INNER JOIN users u ON u.id = fr.user_id
      WHERE fr.ga_id = $1
      ORDER BY fr.created_at DESC
      LIMIT 500
      `,
      [actorGa],
    )
    const rows = r.rows.map((row) => ({
      id: row.id,
      ga_id: row.ga_id,
      ga_name: row.ga_name,
      username: row.username,
      title: String(row.title ?? ''),
      content: row.content,
      status: row.status,
      created_at: toIsoString(row.created_at),
    }))
    res.json(rows)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.patch('/admin/feature-requests/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: '잘못된 ID입니다.' })
      return
    }
    const status = String(req.body?.status ?? '').trim()
    if (!FEATURE_REQUEST_STATUSES.includes(status)) {
      res.status(400).json({ message: 'status는 pending, reviewed, done 중 하나여야 합니다.' })
      return
    }
    const actorGa = parseGaId(req.user?.gaId)
    if (actorGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const upd = await safeQuery(pool,
      `
      UPDATE feature_requests
      SET status = $1
      WHERE id = $2 AND ga_id = $3
      RETURNING id, ga_id, user_id, title, content, status, created_at
      `,
      [status, id, actorGa],
    )
    if (upd.rowCount === 0) {
      res.status(404).json({ message: '요청을 찾을 수 없습니다.' })
      return
    }
    const row = upd.rows[0]
    res.json({
      id: row.id,
      ga_id: row.ga_id,
      user_id: row.user_id,
      title: String(row.title ?? ''),
      content: row.content,
      status: row.status,
      created_at: toIsoString(row.created_at),
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/company/list', requireAuth, async (req, res) => {
  try {
    const gaId = await resolveTenantGaIdForRequest(pool, req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    let scope = {}
    if (isInsurerManagerRole(req.user?.role)) {
      const cid = parseCompanyScopeId(req.user?.companyId)
      if (cid == null) {
        forbiddenResponse(req, res, '담당자 계정에 연결된 보험사가 없습니다.', { route: 'GET /company/list' })
        return
      }
      scope = { onlyCompanyId: cid }
    }
    const list = await loadCompanyDirectoryNestedList(gaId, scope)
    res.json(list)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/company/recent-updates', requireAuth, async (req, res) => {
  try {
    const gaId = await resolveTenantGaIdForRequest(pool, req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const params = [gaId]
    let extra = ''
    if (isInsurerManagerRole(req.user?.role)) {
      const cid = parseCompanyScopeId(req.user?.companyId)
      if (cid == null) {
        forbiddenResponse(req, res, '담당자 계정에 연결된 보험사가 없습니다.', {
          route: 'GET /company/recent-updates',
        })
        return
      }
      params.push(cid)
      extra = ' AND company_id = $2'
    }
    const result = await safeQuery(pool,
      `
      SELECT
        id,
        company_id,
        company_name,
        category,
        updated_at,
        updated_by_username,
        before_payload,
        after_payload
      FROM insurance_company_update_log
      WHERE ga_id = $1${extra}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 200
      `,
      params,
    )
    const rows = result.rows.map((row) => {
      const ts = row.updated_at
      const d = ts instanceof Date ? ts : new Date(ts)
      const dateStr = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
      return {
        id: String(row.id),
        companyId: row.company_id != null ? String(row.company_id) : '',
        companyName: row.company_name ?? '',
        category: row.category ?? '',
        updatedAt: dateStr,
        updatedBy: String(row.updated_by_username ?? '').trim() || '—',
        before: normalizeHistoryPayload(row.before_payload),
        after: normalizeHistoryPayload(row.after_payload),
      }
    })
    res.json(rows)
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/company/full-save', requireAuth, requireGaTenantAdmin, async (req, res) => {
  try {
    const tenantGa = await resolveTenantGaIdForRequest(pool, req)
    if (tenantGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const editor = String(req.user?.username ?? '').trim() || 'staff'
    const { company: co, contacts: contactsIn } = req.body ?? {}
    const name = String(co?.name ?? '').trim()
    if (!name) {
      res.status(400).json({ message: '보험사를 선택하세요.' })
      return
    }

    const category = resolveInsuranceCategoryForApi(co?.category, name)
    if (!category || !['LIFE', 'NON_LIFE', 'GENERAL'].includes(category)) {
      res.status(400).json({ message: '보험 종류(생명/손해/일반)를 선택하세요.' })
      return
    }

    const customerCenter = String(co?.customerCenter ?? co?.customer_center ?? '').trim()
    const systemPhone = String(co?.systemPhone ?? co?.system_phone ?? '').trim()
    const incallNumber = String(co?.incallNumber ?? co?.incall_number ?? '').trim()
    const visitInfo = String(co?.visitInfo ?? co?.visit_info ?? '').trim()

    const rawId = co?.id
    let existingId =
      rawId != null && rawId !== '' && Number.isInteger(Number(rawId)) && Number(rawId) > 0
        ? Number(rawId)
        : null

    const codeIn = String(co?.companyCode ?? co?.company_code ?? '').trim()

    const contactsList = Array.isArray(contactsIn) ? contactsIn : []

    const companyId = await withTransaction(async (client) => {
      if (!existingId && /^INS\d+$/.test(codeIn)) {
        const foundByCode = await safeQuery(client,
          `SELECT id FROM insurance_company_master WHERE ga_id = $1 AND company_code = $2`,
          [tenantGa, codeIn],
        )
        if (foundByCode.rowCount > 0) {
          existingId = Number(foundByCode.rows[0].id)
        }
      }

      let beforeSnap = emptyCompanySnapshot()
      if (existingId) {
        beforeSnap = await loadCompanySnapshot(client, existingId, tenantGa)
      }

      let cid
      if (existingId) {
        const updated = await safeQuery(client,
          `
          UPDATE insurance_company_master
          SET
            category = $1,
            name = $2,
            customer_center = $3,
            system_phone = $4,
            incall_number = $5,
            visit_info = $6,
            updated_at = NOW(),
            updated_by_username = $7
          WHERE id = $8 AND ga_id = $9
          RETURNING id
          `,
          [
            category,
            name,
            customerCenter,
            systemPhone,
            incallNumber,
            visitInfo,
            editor,
            existingId,
            tenantGa,
          ],
        )
        if (updated.rowCount === 0) {
          const err = new Error('해당 보험사를 찾을 수 없습니다.')
          err.httpStatus = 404
          throw err
        }
        cid = existingId
        await ensureMasterCompanyCode(client, cid)
        await safeQuery(
          client,
          `
          DELETE FROM insurance_company_contacts ic
          USING insurance_company_master m
          WHERE ic.company_id = m.id AND ic.company_id = $1 AND m.ga_id = $2
          `,
          [cid, tenantGa],
        )
      } else {
        let inserted
        try {
          inserted = await safeQuery(client,
            `
            INSERT INTO insurance_company_master (
              ga_id, category, name, customer_center, system_phone, incall_number, visit_info,
              updated_at, updated_by_username
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
            RETURNING id
            `,
            [tenantGa, category, name, customerCenter, systemPhone, incallNumber, visitInfo, editor],
          )
        } catch (e) {
          if (e.code !== '23505') {
            throw e
          }
          const dedupe = await safeQuery(client,
            `
            SELECT id
            FROM insurance_company_master
            WHERE ga_id = $1 AND category = $2 AND TRIM(name) = TRIM($3)
            LIMIT 1
            `,
            [tenantGa, category, name],
          )
          if (dedupe.rowCount === 0) {
            throw e
          }
          existingId = Number(dedupe.rows[0].id)
          beforeSnap = await loadCompanySnapshot(client, existingId, tenantGa)
          const updatedIns = await safeQuery(client,
            `
            UPDATE insurance_company_master
            SET
              category = $1,
              name = $2,
              customer_center = $3,
              system_phone = $4,
              incall_number = $5,
              visit_info = $6,
              updated_at = NOW(),
              updated_by_username = $7
            WHERE id = $8 AND ga_id = $9
            RETURNING id
            `,
            [
              category,
              name,
              customerCenter,
              systemPhone,
              incallNumber,
              visitInfo,
              editor,
              existingId,
              tenantGa,
            ],
          )
          if (updatedIns.rowCount === 0) {
            throw e
          }
          cid = existingId
          await ensureMasterCompanyCode(client, cid)
          await safeQuery(
            client,
            `
            DELETE FROM insurance_company_contacts ic
            USING insurance_company_master m
            WHERE ic.company_id = m.id AND ic.company_id = $1 AND m.ga_id = $2
            `,
            [cid, tenantGa],
          )
          inserted = null
        }
        if (inserted) {
          cid = inserted.rows[0].id
          await ensureMasterCompanyCode(client, cid)
        }
      }

      for (const c of contactsList) {
        const cn = String(c?.name ?? '').trim()
        const cp = String(c?.position ?? '').trim()
        const cph = String(c?.phone ?? '').trim()
        if (!cn && !cp && !cph) {
          continue
        }
        await safeQuery(client,
          `
          INSERT INTO insurance_company_contacts (company_id, name, position, phone)
          SELECT $1, $2, $3, $4
          FROM insurance_company_master m
          WHERE m.id = $1 AND m.ga_id = $5
          `,
          [cid, cn, cp, cph, tenantGa],
        )
      }

      const afterSnap = buildCompanySnapshotFromPayload(
        customerCenter,
        systemPhone,
        incallNumber,
        visitInfo,
        contactsList,
      )

      await safeQuery(client,
        `
        INSERT INTO insurance_company_update_log (
          ga_id, company_id, company_name, category, updated_by_username, before_payload, after_payload
        )
        VALUES ($1, $2, $3, $4, $5, CAST($6 AS jsonb), CAST($7 AS jsonb))
        `,
        [
          tenantGa,
          cid,
          name,
          category,
          editor,
          JSON.stringify(beforeSnap),
          JSON.stringify(afterSnap),
        ],
      )

      return cid
    })

    const list = await loadCompanyDirectoryNestedList(tenantGa)
    const data = list.find((x) => x.id === companyId) ?? null

    const wasUpdate = Boolean(existingId)
    if (wasUpdate) {
      res.json({ success: true, data })
      return
    }
    res.status(201).json({ success: true, data })
  } catch (error) {
    if (error.httpStatus === 404) {
      res.status(404).json({ message: error.message })
      return
    }
    handleDbError(error, req, res)
  }
})

/** 원수사 마스터 행 완전 삭제 — 소식지 등은 company_id 해제·이름 스냅샷만 유지, 담당자는 비활성·연결 해제 */
apiRouter.delete('/company/masters/:companyId', requireAuth, requireGaTenantAdmin, async (req, res) => {
  try {
    const tenantGa = await resolveTenantGaIdForRequest(pool, req)
    if (tenantGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const companyId = Number(req.params.companyId)
    if (!Number.isInteger(companyId) || companyId < 1) {
      res.status(400).json({ message: '유효하지 않은 보험사 id입니다.' })
      return
    }

    const meta = await withTransaction(async (client) => {
      const lock = await safeQuery(
        client,
        `SELECT id, name, ga_id FROM insurance_company_master WHERE id = $1 AND ga_id = $2 FOR UPDATE`,
        [companyId, tenantGa],
      )
      if (lock.rowCount === 0) {
        const err = new Error('해당 보험사를 찾을 수 없습니다.')
        err.httpStatus = 404
        throw err
      }
      const row = lock.rows[0]
      const nameSnap = String(row.name ?? '').trim()

      await safeQuery(
        client,
        `
        UPDATE insurer_managers
        SET company_id = NULL,
            is_deleted = true,
            updated_at = NOW()
        WHERE company_id = $1 AND ga_id = $2
        `,
        [companyId, tenantGa],
      )

      await safeQuery(
        client,
        `
        UPDATE insurance_company_newsletters
        SET
          company_id = NULL,
          company_name_snapshot = COALESCE(NULLIF(TRIM(company_name_snapshot), ''), $3),
          updated_at = NOW()
        WHERE company_id = $1 AND ga_id = $2
        `,
        [companyId, tenantGa, nameSnap],
      )

      await safeQuery(
        client,
        `DELETE FROM insurance_company_master WHERE id = $1 AND ga_id = $2`,
        [companyId, tenantGa],
      )

      return { nameSnap }
    })

    void logSecurityEvent(pool, {
      actorUserId: String(req.user?.id ?? '').slice(0, 200),
      actorRole: String(req.user?.role ?? '').slice(0, 64),
      action: 'HARD_DELETE_COMPANY',
      targetType: 'insurance_company_master',
      targetId: String(companyId),
      gaId: tenantGa,
      companyId,
      meta: { companyName: meta.nameSnap },
    })

    res.json({ success: true })
  } catch (error) {
    if (error.httpStatus === 404) {
      res.status(404).json({ message: error.message })
      return
    }
    if (error.httpStatus === 403) {
      res.status(403).json({ message: error.message })
      return
    }
    handleDbError(error, req, res)
  }
})

apiRouter.post('/company/general-save', requireAuth, requireGaTenantAdmin, async (req, res) => {
  try {
    const tenantGa = await resolveTenantGaIdForRequest(pool, req)
    if (tenantGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const { company: co, general: g } = req.body ?? {}
    const code = String(co?.companyCode ?? co?.company_code ?? '').trim()
    if (!code || !/^INS\d+$/.test(code)) {
      res.status(400).json({ message: '보험사 코드(companyCode)가 필요합니다.' })
      return
    }

    const found = await safeQuery(pool,
      `SELECT id, category, name FROM insurance_company_master WHERE ga_id = $1 AND company_code = $2`,
      [tenantGa, code],
    )
    if (found.rowCount === 0) {
      res.status(404).json({
        message: '먼저 「보험사 연락처」 화면에서 해당 보험사를 등록해 주세요.',
      })
      return
    }

    const companyId = found.rows[0].id
    const gen = g && typeof g === 'object' && !Array.isArray(g) ? g : {}
    const gDesc = String(gen.description ?? '').trim()
    const gPhone = String(gen.phone ?? '').trim()
    const gFax = String(gen.fax ?? '').trim()
    const gEmail = String(gen.email ?? '').trim()

    await safeQuery(pool,
      `
      INSERT INTO insurance_general_request (company_id, description, phone, fax, email)
      SELECT $1, $2, $3, $4, $5
      FROM insurance_company_master m
      WHERE m.id = $1 AND m.ga_id = $6
      ON CONFLICT (company_id)
      DO UPDATE SET
        description = EXCLUDED.description,
        phone = EXCLUDED.phone,
        fax = EXCLUDED.fax,
        email = EXCLUDED.email
      `,
      [companyId, gDesc, gPhone, gFax, gEmail, tenantGa],
    )

    res.json({ success: true })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/insurance/contacts', requireAuth, async (req, res) => {
  try {
    if (isInsurerManagerRole(req.user?.role)) {
      forbiddenResponse(req, res, '원수사 담당자는 이 목록에 접근할 수 없습니다.', {
        route: 'GET /insurance/contacts',
      })
      return
    }
    const gaId = effectiveTenantGaId(req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const contactsResult = await safeQuery(pool,
      `
      SELECT id, category, company_name, manager_name, position, phone_number, created_at, updated_at
      FROM insurance_contacts
      WHERE ga_id = $1
      ORDER BY
        CASE category
          WHEN 'LIFE' THEN 1
          WHEN 'NON_LIFE' THEN 2
          WHEN 'GENERAL' THEN 3
          ELSE 4
        END,
        company_name ASC,
        manager_name ASC
      `,
      [gaId],
    )

    const metaResult = await safeQuery(pool,
      `
      SELECT meta_value, $2 AS ga_id
      FROM insurance_contact_meta
      WHERE meta_key = $1
      `,
      [`contact_last_updated_at:${gaId}`, gaId],
    )

    const fallbackUpdatedAt =
      contactsResult.rows.length > 0
        ? contactsResult.rows.reduce((latest, row) => {
            const candidate = toIsoString(row.updated_at)
            return candidate > latest ? candidate : latest
          }, '')
        : ''

    res.json({
      lastUpdatedAt: metaResult.rows[0]?.meta_value
        ? toIsoString(metaResult.rows[0].meta_value)
        : fallbackUpdatedAt,
      contacts: contactsResult.rows.map(mapContactRow),
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/insurance/updates', requireAuth, async (req, res) => {
  try {
    const gaId = effectiveTenantGaId(req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const result = await safeQuery(pool,
      `
      SELECT
        id,
        contact_id,
        action_type,
        category,
        company_name,
        manager_name,
        position,
        old_phone_number,
        new_phone_number,
        description,
        created_at
      FROM insurance_contact_updates
      WHERE ga_id = $1
      ORDER BY created_at DESC
      `,
      [gaId],
    )

    res.json(result.rows.map(mapContactUpdateRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/insurance/contacts/:id/vcard', requireAuth, async (req, res) => {
  try {
    const gaId = effectiveTenantGaId(req)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const result = await safeQuery(pool,
      `
      SELECT id, company_name, manager_name, position, phone_number
      FROM insurance_contacts
      WHERE id = $1 AND ga_id = $2
      `,
      [req.params.id, gaId],
    )

    if (result.rowCount === 0) {
      res.status(404).json({ message: '연락처를 찾을 수 없습니다.' })
      return
    }

    const contact = result.rows[0]
    const safeName = `${contact.company_name}_${contact.manager_name}`
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80)

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.vcf"`)
    res.send(createVCardContent(contact))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

/** 하위 호환: 항상 GA_ADMIN으로 생성 (신규 연동은 POST /admin/user 사용) */
apiRouter.post('/admin/create-staff', requireAuth, requireSuperAdmin, async (req, res) => {
  req.body = { ...(req.body ?? {}), role: 'GA_ADMIN' }
  return postAdminCreateDelegateUser(req, res)
})

apiRouter.post('/admin/insurance/contacts', requireAuth, requireGaAdminOrSuper, async (req, res) => {
  try {
    const tenantGa = effectiveTenantGaId(req)
    if (tenantGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const companyName = String(req.body?.companyName ?? req.body?.company_name ?? '').trim()
    let category = normalizeCategory(req.body?.category)
    category = coerceMeritzFireToNonLifeCategory(category, companyName)
    const managerName = String(req.body?.managerName ?? req.body?.manager_name ?? '').trim()
    const position = String(req.body?.position ?? '').trim()
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber ?? req.body?.phone_number ?? '')
    const description = String(req.body?.description ?? '연락처 등록').trim()

    if (!['LIFE', 'NON_LIFE', 'GENERAL'].includes(category)) {
      res.status(400).json({ message: '카테고리 값이 올바르지 않습니다.' })
      return
    }
    if (!companyName || !managerName || !phoneNumber) {
      res.status(400).json({ message: '보험사명, 담당자명, 전화번호는 필수입니다.' })
      return
    }

    const inserted = await withTransaction(async (client) => {
      const contactId = randomUUID()
      const contactResult = await safeQuery(client,
        `
        INSERT INTO insurance_contacts (
          id, ga_id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        `,
        [contactId, tenantGa, category, companyName, managerName, position, phoneNumber],
      )

      await safeQuery(client,
        `
        INSERT INTO insurance_contact_updates (
          id, ga_id, contact_id, action_type, category, company_name, manager_name, position,
          old_phone_number, new_phone_number, description, created_at
        ) VALUES ($1, $2, $3, 'CREATE', $4, $5, $6, $7, NULL, $8, $9, NOW())
        `,
        [
          randomUUID(),
          tenantGa,
          contactId,
          category,
          companyName,
          managerName,
          position,
          phoneNumber,
          description,
        ],
      )

      await touchContactLastUpdatedAt(client, tenantGa)
      return contactResult.rows[0]
    })

    res.status(201).json(mapContactRow(inserted))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.put('/admin/insurance/contacts/:id', requireAuth, requireGaAdminOrSuper, async (req, res) => {
  try {
    const tenantGa = effectiveTenantGaId(req)
    if (tenantGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const contactId = req.params.id
    const companyName = String(req.body?.companyName ?? req.body?.company_name ?? '').trim()
    let category = normalizeCategory(req.body?.category)
    category = coerceMeritzFireToNonLifeCategory(category, companyName)
    const managerName = String(req.body?.managerName ?? req.body?.manager_name ?? '').trim()
    const position = String(req.body?.position ?? '').trim()
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber ?? req.body?.phone_number ?? '')
    const description = String(req.body?.description ?? '연락처 수정').trim()

    if (!['LIFE', 'NON_LIFE', 'GENERAL'].includes(category)) {
      res.status(400).json({ message: '카테고리 값이 올바르지 않습니다.' })
      return
    }
    if (!companyName || !managerName || !phoneNumber) {
      res.status(400).json({ message: '보험사명, 담당자명, 전화번호는 필수입니다.' })
      return
    }

    const updatedContact = await withTransaction(async (client) => {
      const existing = await safeQuery(client,
        `
        SELECT id, category, company_name, manager_name, position, phone_number
        FROM insurance_contacts
        WHERE id = $1 AND ga_id = $2
        `,
        [contactId, tenantGa],
      )

      if (existing.rowCount === 0) {
        return null
      }

      const updated = await safeQuery(client,
        `
        UPDATE insurance_contacts
        SET
          category = $1,
          company_name = $2,
          manager_name = $3,
          position = $4,
          phone_number = $5,
          updated_at = NOW()
        WHERE id = $6 AND ga_id = $7
        RETURNING id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        `,
        [category, companyName, managerName, position, phoneNumber, contactId, tenantGa],
      )

      const prev = existing.rows[0]
      await safeQuery(client,
        `
        INSERT INTO insurance_contact_updates (
          id, ga_id, contact_id, action_type, category, company_name, manager_name, position,
          old_phone_number, new_phone_number, description, created_at
        ) VALUES ($1, $2, $3, 'UPDATE', $4, $5, $6, $7, $8, $9, $10, NOW())
        `,
        [
          randomUUID(),
          tenantGa,
          contactId,
          category,
          companyName,
          managerName,
          position,
          normalizePhoneNumber(prev.phone_number),
          phoneNumber,
          description,
        ],
      )

      await touchContactLastUpdatedAt(client, tenantGa)
      return updated.rows[0]
    })

    if (!updatedContact) {
      res.status(404).json({ message: '수정할 연락처를 찾을 수 없습니다.' })
      return
    }

    res.json(mapContactRow(updatedContact))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.delete('/admin/insurance/contacts/:id', requireAuth, requireGaAdminOrSuper, async (req, res) => {
  try {
    const tenantGa = effectiveTenantGaId(req)
    if (tenantGa == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const contactId = req.params.id
    const description = String(req.body?.description ?? '연락처 삭제').trim()

    const deletedContact = await withTransaction(async (client) => {
      const existing = await safeQuery(client,
        `
        SELECT id, category, company_name, manager_name, position, phone_number
        FROM insurance_contacts
        WHERE id = $1 AND ga_id = $2
        `,
        [contactId, tenantGa],
      )

      if (existing.rowCount === 0) {
        return null
      }

      await safeQuery(client,
        `
        DELETE FROM insurance_contacts
        WHERE id = $1 AND ga_id = $2
        `,
        [contactId, tenantGa],
      )

      const prev = existing.rows[0]
      await safeQuery(client,
        `
        INSERT INTO insurance_contact_updates (
          id, ga_id, contact_id, action_type, category, company_name, manager_name, position,
          old_phone_number, new_phone_number, description, created_at
        ) VALUES ($1, $2, $3, 'DELETE', $4, $5, $6, $7, $8, NULL, $9, NOW())
        `,
        [
          randomUUID(),
          tenantGa,
          contactId,
          prev.category,
          prev.company_name,
          prev.manager_name,
          prev.position ?? '',
          normalizePhoneNumber(prev.phone_number),
          description,
        ],
      )

      await touchContactLastUpdatedAt(client, tenantGa)
      return prev
    })

    if (!deletedContact) {
      res.status(404).json({ message: '삭제할 연락처를 찾을 수 없습니다.' })
      return
    }

    res.status(204).send()
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/forms', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const result = await safeQuery(pool,
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1 AND ga_id = $2
      ORDER BY created_at DESC, id DESC
      `,
      [userId, gaId],
    )

    res.json(result.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/forms/expiring', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const result = await safeQuery(pool,
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1 AND ga_id = $2
        AND expiry_date IS NOT NULL
        AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY expiry_date ASC, updated_at DESC
      `,
      [userId, gaId],
    )

    res.json(result.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/forms', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const formData = extractFormData(req.body)
    if (!formData) {
      res.status(400).json({ message: 'form_data가 필요합니다.' })
      return
    }

    const linkedId = resolveLinkedCustomerIdFromRequest(req.body, formData)
    let customerIdFk = null
    if (linkedId != null) {
      const usable = await assertCustomerActiveAndOwnedByUser(linkedId, userId, gaId)
      if (!usable) {
        res.status(400).json({ message: '유효하지 않은 고객 연결입니다.' })
        return
      }
      customerIdFk = linkedId
    }

    const mergedForm = { ...formData, customerId: customerIdFk ?? 0 }

    const id = randomUUID()
    const customerName = String(
      req.body.customer_name ?? req.body.customerName ?? mergedForm.ownerName ?? '',
    )
    const carNumber = String(
      req.body.car_number ?? req.body.carNumber ?? mergedForm.vehicleNumber ?? '',
    )
    const expiryDate = normalizeExpiryDate(
      req.body.expiry_date ?? req.body.expiryDate ?? mergedForm.expiryDate ?? '',
    )

    const inserted = await safeQuery(pool,
      `
      INSERT INTO insurance_forms (
        id, user_id, ga_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS jsonb), NOW(), NOW())
      RETURNING id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [
        id,
        userId,
        gaId,
        customerIdFk,
        customerName,
        carNumber,
        expiryDate || null,
        JSON.stringify(mergedForm),
      ],
    )

    await logInsuranceFormsDbDiagnostics('post')

    void recordAnalyticsEvent(pool, { userId, gaId, eventType: 'document_created' })
    res.status(201).json(mapFormRow(inserted.rows[0]))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/forms/:id/renew', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const result = await safeQuery(pool,
      `
      SELECT id, user_id, ga_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = $1 AND user_id = $2 AND ga_id = $3
      `,
      [req.params.id, userId, gaId],
    )

    const original = result.rows[0]
    if (!original) {
      res.status(404).json({ message: '신청서를 찾을 수 없습니다.' })
      return
    }

    const renewedCustomerId =
      original.customer_id != null && original.customer_id !== '' ? Number(original.customer_id) : null

    let newExpiry = ''
    const rawExpiry = original.expiry_date ?? original.form_data?.expiryDate ?? ''
    const normalizedBase = normalizeExpiryDate(
      rawExpiry instanceof Date ? rawExpiry.toISOString().slice(0, 10) : String(rawExpiry),
    )
    if (normalizedBase) {
      const d = new Date(`${normalizedBase}T12:00:00.000Z`)
      if (!Number.isNaN(d.getTime())) {
        d.setUTCFullYear(d.getUTCFullYear() + 1)
        newExpiry = d.toISOString().slice(0, 10)
      }
    }

    const prevFormData =
      original.form_data && typeof original.form_data === 'object' && !Array.isArray(original.form_data)
        ? { ...original.form_data }
        : {}
    if (newExpiry) {
      prevFormData.expiryDate = newExpiry
    }
    if (Number.isInteger(renewedCustomerId) && renewedCustomerId > 0) {
      prevFormData.customerId = renewedCustomerId
    } else {
      prevFormData.customerId = 0
    }

    if (newExpiry) {
      const check = await safeQuery(pool,
        `
        SELECT id FROM insurance_forms
        WHERE user_id = $1 AND ga_id = $3 AND expiry_date = $2
        `,
        [userId, newExpiry, gaId],
      )
      if (check.rowCount > 0) {
        res.status(400).json({ error: '이미 갱신된 신청서 있음' })
        return
      }
    }

    const newId = randomUUID()
    const customerName = String(original.customer_name ?? prevFormData.ownerName ?? '')
    const carNumber = String(original.car_number ?? prevFormData.vehicleNumber ?? '')

    const formGaId = parseGaId(original.ga_id) ?? gaId

    const insert = await safeQuery(pool,
      `
      INSERT INTO insurance_forms (
        id, user_id, ga_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS jsonb), NOW(), NOW())
      RETURNING id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [
        newId,
        userId,
        formGaId,
        Number.isInteger(renewedCustomerId) && renewedCustomerId > 0 ? renewedCustomerId : null,
        customerName,
        carNumber,
        newExpiry || null,
        JSON.stringify(prevFormData),
      ],
    )

    await logInsuranceFormsDbDiagnostics('renew')

    void recordAnalyticsEvent(pool, { userId, gaId: formGaId, eventType: 'document_created' })
    res.status(201).json({ success: true, data: mapFormRow(insert.rows[0]) })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/customers', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const data = req.body ?? {}
    const name = String(data.name ?? '').trim()
    if (!name) {
      res.status(400).json({ message: '이름은 필수입니다' })
      return
    }

    const ssn = String(data.ssn ?? '').trim()

    let isDriver = null
    if (data.isDriver === true || data.is_driver === true) {
      isDriver = true
    } else if (data.isDriver === false || data.is_driver === false) {
      isDriver = false
    }
    const carType = String(data.carType ?? data.car_type ?? '').trim()

    const { age: insuranceAge, nextAgeDate: nextAgeDateObj } = calculateInsuranceInfoFromRrn(ssn)
    const nextAgeSql = nextAgeDateToSqlDate(nextAgeDateObj)

    const genderRaw = String(data.gender ?? '').trim()
    const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : ''

    const notes = normalizeCustomerNotesInput(data.notes)
    const driving =
      isDriver === true ? '운전함' : isDriver === false ? '운전 안함' : String(data.driving ?? '').trim()

    const carNumber = String(data.carNumber ?? data.car_number ?? '').trim()
    const carModel = String(data.carModel ?? data.car_model ?? '').trim()
    const carYear = String(data.carYear ?? data.car_year ?? '').trim()
    const renewalDateRaw = normalizeExpiryDate(String(data.renewalDate ?? data.renewal_date ?? ''))
    const renewalDateSql = renewalDateRaw || null

    const inserted = await safeQuery(pool,
      `
      INSERT INTO customers (
        user_id, ga_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        gender, insurance_age, next_age_date, is_driver, car_type,
        car_number, car_model, car_year, renewal_date,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CAST($22 AS jsonb))
      RETURNING
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        is_favorite, created_at
      `,
      [
        userId,
        gaId,
        name,
        ssn,
        String(data.phone ?? '').trim(),
        String(data.carrier ?? '').trim(),
        String(data.address ?? '').trim(),
        String(data.height ?? '').trim(),
        String(data.weight ?? '').trim(),
        String(data.job ?? '').trim(),
        driving,
        String(data.medical ?? '').trim(),
        gender,
        insuranceAge,
        nextAgeSql,
        isDriver,
        carType,
        carNumber,
        carModel,
        carYear,
        renewalDateSql,
        JSON.stringify(notes),
      ],
    )

    void recordAnalyticsEvent(pool, { userId, gaId, eventType: 'customer_created' })
    res.status(201).json({ success: true, data: mapCustomerRow(inserted.rows[0]) })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.post('/customer/external-create', async (req, res) => {
  try {
    const data = req.body ?? {}
    const refUserId = String(data.refUserId ?? data.ref_user_id ?? '').trim()
    if (!refUserId) {
      res.status(400).json({ message: '소개 링크 정보가 없습니다.' })
      return
    }

    const userRow = await systemQuery(pool, `SELECT id, role, ga_id FROM users WHERE id = $1`, [refUserId])
    if (userRow.rowCount === 0) {
      res.status(400).json({ message: '유효하지 않은 소개 링크입니다.' })
      return
    }
    if (normalizeUserRole(userRow.rows[0].role) !== 'USER') {
      res.status(400).json({ message: '고객 정보를 받을 수 있는 계정이 아닙니다.' })
      return
    }
    const refGaId = parseGaId(userRow.rows[0].ga_id)
    if (refGaId == null) {
      res.status(400).json({ message: '소개 계정에 GA가 연결되지 않았습니다.' })
      return
    }

    const name = String(data.name ?? '').trim()
    if (!name) {
      res.status(400).json({ message: '이름은 필수입니다' })
      return
    }

    const ssn = String(data.ssn ?? '').trim()

    let isDriver = null
    if (data.isDriver === true || data.is_driver === true) {
      isDriver = true
    } else if (data.isDriver === false || data.is_driver === false) {
      isDriver = false
    }
    const carType = String(data.carType ?? data.car_type ?? '').trim()

    const { age: insuranceAge, nextAgeDate: nextAgeDateObj } = calculateInsuranceInfoFromRrn(ssn)
    const nextAgeSql = nextAgeDateToSqlDate(nextAgeDateObj)

    const genderRaw = String(data.gender ?? '').trim()
    const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : ''

    const notes = normalizeCustomerNotesInput(data.notes)
    const driving =
      isDriver === true ? '운전함' : isDriver === false ? '운전 안함' : String(data.driving ?? '').trim()

    const carNumber = String(data.carNumber ?? data.car_number ?? '').trim()
    const carModel = String(data.carModel ?? data.car_model ?? '').trim()
    const carYear = String(data.carYear ?? data.car_year ?? '').trim()
    const renewalDateRaw = normalizeExpiryDate(String(data.renewalDate ?? data.renewal_date ?? ''))
    const renewalDateSql = renewalDateRaw || null

    const inserted = await safeQuery(pool,
      `
      INSERT INTO customers (
        user_id, ga_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        gender, insurance_age, next_age_date, is_driver, car_type,
        car_number, car_model, car_year, renewal_date,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CAST($22 AS jsonb))
      RETURNING
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        is_favorite, created_at
      `,
      [
        refUserId,
        refGaId,
        name,
        ssn,
        String(data.phone ?? '').trim(),
        String(data.carrier ?? '').trim(),
        String(data.address ?? '').trim(),
        String(data.height ?? '').trim(),
        String(data.weight ?? '').trim(),
        String(data.job ?? '').trim(),
        driving,
        String(data.medical ?? '').trim(),
        gender,
        insuranceAge,
        nextAgeSql,
        isDriver,
        carType,
        carNumber,
        carModel,
        carYear,
        renewalDateSql,
        JSON.stringify(notes),
      ],
    )

    void recordAnalyticsEvent(pool, { userId: refUserId, gaId: refGaId, eventType: 'customer_created' })
    res.status(201).json({ success: true, data: mapCustomerRow(inserted.rows[0]) })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.put('/customers/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const customerId = Number(req.params.id)
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      return
    }

    const data = req.body ?? {}
    const hasKey = (k) => Object.prototype.hasOwnProperty.call(data, k)

    const parts = []
    const vals = []
    let n = 1

    if (hasKey('name')) {
      const name = String(data.name ?? '').trim()
      if (!name) {
        res.status(400).json({ message: '이름은 필수입니다' })
        return
      }
      parts.push(`name = $${n++}`)
      vals.push(name)
    }

    const stringCols = [
      ['ssn', 'ssn'],
      ['phone', 'phone'],
      ['carrier', 'carrier'],
      ['address', 'address'],
      ['height', 'height'],
      ['weight', 'weight'],
      ['job', 'job'],
      ['driving', 'driving'],
      ['medical', 'medical'],
    ]
    for (const [key, col] of stringCols) {
      if (hasKey(key)) {
        parts.push(`${col} = $${n++}`)
        vals.push(String(data[key] ?? '').trim())
      }
    }

    if (hasKey('carNumber') || hasKey('car_number')) {
      parts.push(`car_number = $${n++}`)
      vals.push(String(data.carNumber ?? data.car_number ?? '').trim())
    }
    if (hasKey('carModel') || hasKey('car_model')) {
      parts.push(`car_model = $${n++}`)
      vals.push(String(data.carModel ?? data.car_model ?? '').trim())
    }
    if (hasKey('carYear') || hasKey('car_year')) {
      parts.push(`car_year = $${n++}`)
      vals.push(String(data.carYear ?? data.car_year ?? '').trim())
    }
    if (hasKey('renewalDate') || hasKey('renewal_date')) {
      const renewalDate = normalizeExpiryDate(String(data.renewalDate ?? data.renewal_date ?? ''))
      parts.push(`renewal_date = $${n++}`)
      vals.push(renewalDate || null)
    }

    if (hasKey('gender')) {
      const genderRaw = String(data.gender ?? '').trim()
      const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : ''
      parts.push(`gender = $${n++}`)
      vals.push(gender)
    }

    if (hasKey('isDriver') || hasKey('is_driver')) {
      const v = hasKey('isDriver') ? data.isDriver : data.is_driver
      let isDriver = null
      if (v === true) {
        isDriver = true
      } else if (v === false) {
        isDriver = false
      }
      parts.push(`is_driver = $${n++}`)
      vals.push(isDriver)
    }

    if (hasKey('carType') || hasKey('car_type')) {
      parts.push(`car_type = $${n++}`)
      vals.push(String(data.carType ?? data.car_type ?? '').trim())
    }

    if (hasKey('isFavorite') || hasKey('is_favorite')) {
      const v = hasKey('isFavorite') ? data.isFavorite : data.is_favorite
      parts.push(`is_favorite = $${n++}`)
      vals.push(v === true)
    }

    if (hasKey('notes')) {
      parts.push(`notes = CAST($${n++} AS jsonb)`)
      vals.push(JSON.stringify(normalizeCustomerNotesInput(data.notes)))
    }

    if (hasKey('ssn')) {
      const ssnVal = String(data.ssn ?? '').trim()
      const { age: insuranceAge, nextAgeDate: nextAgeDateObj } = calculateInsuranceInfoFromRrn(ssnVal)
      parts.push(`insurance_age = $${n++}`)
      vals.push(insuranceAge)
      parts.push(`next_age_date = $${n++}`)
      vals.push(nextAgeDateToSqlDate(nextAgeDateObj))
    }

    if (parts.length === 0) {
      res.status(400).json({ message: '수정할 필드가 없습니다.' })
      return
    }

    vals.push(customerId, userId, gaId)
    const updated = await safeQuery(pool,
      `
      UPDATE customers
      SET ${parts.join(', ')}
      WHERE id = $${n++} AND user_id = $${n++} AND ga_id = $${n++} AND deleted_at IS NULL
      RETURNING
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        is_favorite, created_at
      `,
      vals,
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
      return
    }

    res.json({ success: true, data: mapCustomerRow(updated.rows[0]) })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/customers/search', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const q = String(req.query.q ?? '').trim()
    let result
    if (!q) {
      result = await safeQuery(pool,
        `
        SELECT
          id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
          car_number, car_model, car_year, renewal_date,
          gender, insurance_age, next_age_date, is_driver, car_type, notes,
          is_favorite, created_at
        FROM customers
        WHERE user_id = $1 AND ga_id = $2 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 2000
        `,
        [userId, gaId],
      )
    } else {
      const pattern = `%${escapeIlikePattern(q)}%`
      result = await safeQuery(pool,
        `
        SELECT
          id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
          car_number, car_model, car_year, renewal_date,
          gender, insurance_age, next_age_date, is_driver, car_type, notes,
          is_favorite, created_at
        FROM customers
        WHERE user_id = $1 AND ga_id = $3 AND deleted_at IS NULL
          AND (name ILIKE $2 ESCAPE '\\' OR phone ILIKE $2 ESCAPE '\\')
        ORDER BY created_at DESC
        LIMIT 2000
        `,
        [userId, pattern, gaId],
      )
    }

    res.json(result.rows.map(mapCustomerRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/customers', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000)
    const [result, countResult] = await Promise.all([
      safeQuery(pool,
        `
        SELECT
          id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
          car_number, car_model, car_year, renewal_date,
          gender, insurance_age, next_age_date, is_driver, car_type, notes,
          is_favorite, created_at
        FROM customers
        WHERE user_id = $1 AND ga_id = $2 AND deleted_at IS NULL
        ORDER BY renewal_date ASC NULLS LAST, created_at DESC
        LIMIT $3
        `,
        [userId, gaId, limit],
      ),
      safeQuery(pool,
        `
        SELECT COUNT(*) AS c
        FROM customers
        WHERE user_id = $1 AND ga_id = $2 AND deleted_at IS NULL
        `,
        [userId, gaId],
      ),
    ])

    const total = Number(countResult.rows[0]?.c ?? 0) || 0
    res.json({
      data: result.rows.map(mapCustomerRow),
      total,
    })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/customers/:id/forms', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const customerId = Number(req.params.id)
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      return
    }

    const check = await safeQuery(pool, `SELECT 1 FROM customers WHERE id = $1 AND user_id = $2 AND ga_id = $3`, [
      customerId,
      userId,
      gaId,
    ])

    if (check.rowCount === 0) {
      res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
      return
    }

    const forms = await safeQuery(pool,
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1 AND customer_id = $2 AND ga_id = $3
      ORDER BY created_at DESC
      `,
      [userId, customerId, gaId],
    )

    res.json(forms.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.delete('/customers/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const customerId = Number(req.params.id)
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      return
    }

    const deleted = await safeQuery(pool,
      `
      UPDATE customers
      SET deleted_at = NOW()
      WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
      `,
      [customerId, userId, gaId],
    )

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: '고객을 찾을 수 없거나 이미 삭제되었습니다.' })
      return
    }

    res.json({ success: true })
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.get('/forms/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const result = await safeQuery(pool,
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = $1 AND user_id = $2 AND ga_id = $3
      `,
      [req.params.id, userId, gaId],
    )

    if (result.rowCount === 0) {
      res.status(404).json({ message: '신청서를 찾을 수 없습니다.' })
      return
    }

    res.json(mapFormRow(result.rows[0]))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.put('/forms/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const formData = extractFormData(req.body)
    if (!formData) {
      res.status(400).json({ message: 'form_data가 필요합니다.' })
      return
    }

    const existingForm = await safeQuery(pool,
      `SELECT customer_id FROM insurance_forms WHERE id = $1 AND user_id = $2 AND ga_id = $3`,
      [req.params.id, userId, gaId],
    )
    if (existingForm.rowCount === 0) {
      res.status(404).json({ message: '수정할 신청서를 찾을 수 없습니다.' })
      return
    }
    const prevFormCustomerId =
      existingForm.rows[0].customer_id != null && existingForm.rows[0].customer_id !== ''
        ? Number(existingForm.rows[0].customer_id)
        : null

    const linkedId = resolveLinkedCustomerIdFromRequest(req.body, formData)
    let customerIdFk = null
    if (linkedId != null) {
      const owned = await assertCustomerOwnedByUser(linkedId, userId, gaId)
      if (!owned) {
        res.status(400).json({ message: '유효하지 않은 고객 연결입니다.' })
        return
      }
      const active = await assertCustomerActiveAndOwnedByUser(linkedId, userId, gaId)
      if (!active) {
        const sameAsBefore =
          prevFormCustomerId != null && Number.isInteger(prevFormCustomerId) && prevFormCustomerId === linkedId
        if (!sameAsBefore) {
          res.status(400).json({ message: '삭제 처리된 고객에는 새로 연결할 수 없습니다.' })
          return
        }
      }
      customerIdFk = linkedId
    }

    const mergedForm = { ...formData, customerId: customerIdFk ?? 0 }

    const customerName = String(
      req.body.customer_name ?? req.body.customerName ?? mergedForm.ownerName ?? '',
    )
    const carNumber = String(
      req.body.car_number ?? req.body.carNumber ?? mergedForm.vehicleNumber ?? '',
    )
    const expiryDate = normalizeExpiryDate(
      req.body.expiry_date ?? req.body.expiryDate ?? mergedForm.expiryDate ?? '',
    )

    const updated = await safeQuery(pool,
      `
      UPDATE insurance_forms
      SET
        customer_id = $1,
        customer_name = $2,
        car_number = $3,
        expiry_date = $4,
        form_data = CAST($5 AS jsonb),
        updated_at = NOW()
      WHERE id = $6 AND user_id = $7 AND ga_id = $8
      RETURNING id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [
        customerIdFk,
        customerName,
        carNumber,
        expiryDate || null,
        JSON.stringify(mergedForm),
        req.params.id,
        userId,
        gaId,
      ],
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ message: '수정할 신청서를 찾을 수 없습니다.' })
      return
    }

    await logInsuranceFormsDbDiagnostics('put')

    res.json(mapFormRow(updated.rows[0]))
  } catch (error) {
    handleDbError(error, req, res)
  }
})

apiRouter.delete('/forms/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }

    const deleted = await safeQuery(pool,
      `
      DELETE FROM insurance_forms
      WHERE id = $1 AND user_id = $2 AND ga_id = $3
      RETURNING id
      `,
      [req.params.id, userId, gaId],
    )

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: '삭제할 신청서를 찾을 수 없습니다.' })
      return
    }

    res.status(204).send()
  } catch (error) {
    handleDbError(error, req, res)
  }
})

/**
 * 고객 상담/관계/고급검색 (GET·POST /customers/:id/consultations 등)
 * 반드시 app.use 로 apiRouter 를 붙이기 **전에** 등록한다. (등록이 뒤에 가면 라우트가 붙지 않음)
 */
registerCustomerExtraApi(apiRouter, { pool, requireAuth, handleDbError })

app.use('/api', apiRouter)
app.use('/backend', apiRouter)

if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH))
  app.get(/^(?!\/(api|backend)).*/, (_req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'))
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: '서버 오류가 발생했습니다.' })
})

async function startServer() {
  if (JWT_SECRET === DEFAULT_JWT_SECRET && RUNNING_IN_PRODUCTION) {
    console.error('='.repeat(70))
    console.error('[DEPLOY-BLOCKER] JWT_SECRET이 기본값입니다.')
    console.error('[DEPLOY-BLOCKER] 배포 전 Railway 환경변수 JWT_SECRET을 반드시 변경하세요.')
    console.error('='.repeat(70))
    throw new Error('보안 차단: 기본 JWT_SECRET 사용 금지')
  }

  await initDb()
  await seedInsuranceCompanyDirectory()
  await logInsuranceFormsDbDiagnostics('startup')
  await ensureYesterdayAnalyticsAggregated(pool)

  app.listen(PORT, () => {
    console.log(`Insurance server listening on port ${PORT}`)
    console.log('Insurance DB engine: PostgreSQL')
  })

  const SMS_CODE_PURGE_MS = 15 * 60 * 1000
  void purgeExpiredSmsVerificationCodes(pool).catch((err) => console.error('[sms-cleanup] purge failed', err))
  setInterval(() => {
    void purgeExpiredSmsVerificationCodes(pool).catch((err) => console.error('[sms-cleanup] purge failed', err))
  }, SMS_CODE_PURGE_MS)

  const analyticsScheduleState = { lastRunSeoulYmd: null }
  const ANALYTICS_TICK_MS = 60 * 60 * 1000
  void tickAnalyticsAggregationScheduler(pool, analyticsScheduleState)
  setInterval(() => {
    void tickAnalyticsAggregationScheduler(pool, analyticsScheduleState)
  }, ANALYTICS_TICK_MS)
}

startServer().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})
