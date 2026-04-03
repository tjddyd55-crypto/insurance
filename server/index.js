import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pool from './db.js'
import { initDb } from './initDb.js'
import { coerceMeritzFireToNonLifeCategory } from './lib/insuranceCompanyCategoryRules.js'
import { seedInsuranceCompanyDirectory } from './seedInsuranceData.js'

const PORT = Number(process.env.PORT ?? 3001)
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production'
const DEFAULT_JWT_SECRET = 'change-this-in-production'
const VALID_USER_ROLES = ['super_admin', 'staff', 'user']
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

function normalizeCustomerNotesInput(raw) {
  if (raw == null || !Array.isArray(raw)) {
    return []
  }
  const out = []
  for (const item of raw) {
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

function mapCustomerNotesJson(raw) {
  if (raw == null) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => ({
        id: String(item?.id ?? '').trim(),
        content: String(item?.content ?? '').trim(),
        createdAt: String(item?.createdAt ?? '').trim(),
      }))
      .filter((n) => n.id && n.content && n.createdAt)
  }
  return []
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
    phone: row.phone ?? '',
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
  return VALID_USER_ROLES.includes(r) ? r : 'user'
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

async function assertCustomerOwnedByUser(customerId, userId) {
  if (customerId == null) {
    return true
  }
  const r = await pool.query(`SELECT 1 FROM customers WHERE id = $1 AND user_id = $2`, [customerId, userId])
  return r.rowCount > 0
}

async function assertCustomerActiveAndOwnedByUser(customerId, userId) {
  if (customerId == null) {
    return false
  }
  const r = await pool.query(
    `SELECT 1 FROM customers WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [customerId, userId],
  )
  return r.rowCount > 0
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

function normalizeInsuranceCompanyCategory(value) {
  const s = String(value ?? '').trim()
  if (!s) {
    return ''
  }
  const u = s.toUpperCase().replace(/-/g, '_')
  if (u === 'NONLIFE') {
    return 'NON_LIFE'
  }
  if (u === 'LIFE' || u === 'NON_LIFE' || u === 'GENERAL') {
    return u
  }
  const lower = s.toLowerCase()
  if (lower === 'life') {
    return 'LIFE'
  }
  if (lower === 'nonlife') {
    return 'NON_LIFE'
  }
  const ko = s.replace(/\s+/g, '')
  if (/^(생명|생명보험|생보)$/.test(ko) || ko === '생명보험') {
    return 'LIFE'
  }
  if (
    /^(손해|손해보험|손보|재산|화재)$/.test(ko) ||
    ko === '손해보험' ||
    ko === '손해보험사'
  ) {
    return 'NON_LIFE'
  }
  if (/^(일반|일반보험)$/.test(ko) || ko === '일반보험') {
    return 'GENERAL'
  }
  return ''
}

function mapInsuranceCompanyMaster(row) {
  const normalized = normalizeInsuranceCompanyCategory(row.category)
  const updatedRaw = row.updated_at ?? row.created_at
  return {
    id: Number(row.id),
    category: normalized || row.category || '',
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

async function loadCompanyDirectoryNestedList() {
  const masters = await pool.query(
    `
    SELECT *
    FROM insurance_company_master
    ORDER BY category ASC NULLS LAST, name ASC
    `,
  )
  const contacts = await pool.query(
    `
    SELECT *
    FROM insurance_company_contacts
    ORDER BY company_id ASC, id ASC
    `,
  )
  const generals = await pool.query(`SELECT * FROM insurance_general_request`)

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

  function insuranceTypeSortKey(cat) {
    const n = normalizeInsuranceCompanyCategory(cat)
    if (n === 'LIFE') {
      return 1
    }
    if (n === 'NON_LIFE') {
      return 2
    }
    if (n === 'GENERAL') {
      return 3
    }
    return 9
  }

  items.sort((a, b) => {
    const d = insuranceTypeSortKey(a.category) - insuranceTypeSortKey(b.category)
    if (d !== 0) {
      return d
    }
    return String(a.name).localeCompare(String(b.name), 'ko')
  })
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

function handleDbError(error, res) {
  if (error?.code === '23505') {
    if (error?.constraint === 'users_username_key') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    res.status(409).json({ message: '이미 존재하는 데이터입니다.' })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'DB 처리 중 오류가 발생했습니다.' })
}

async function logInsuranceFormsDbDiagnostics(contextLabel) {
  try {
    const recent = await pool.query(
      `
      SELECT id, user_id, created_at
      FROM insurance_forms
      ORDER BY created_at DESC NULLS LAST, id DESC
      LIMIT 5
      `,
    )
    console.log(`[insurance_forms:${contextLabel}] DB 저장 확인:`, recent.rows)

    const nullCheck = await pool.query(
      `SELECT COUNT(*)::int AS count FROM insurance_forms WHERE user_id IS NULL`,
    )
    console.log(
      `[insurance_forms:${contextLabel}] user_id NULL 개수:`,
      nullCheck.rows[0]?.count ?? 0,
    )
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

function requireAuth(req, res, next) {
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

    req.user = {
      id: String(userId),
      username: typeof decoded.username === 'string' ? decoded.username : '',
      role: normalizeUserRole(decoded.role),
    }

    if (req.originalUrl?.includes('/forms')) {
      console.log('로그인 user:', req.user)
    }
    next()
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      message: '인증이 만료되었거나 유효하지 않습니다.',
    })
  }
}

/** super_admin 전용 API(예: 계정/시스템 설정)에 그대로 연결하면 됩니다. */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    res.status(403).json({ message: '전체 관리자 권한이 필요합니다.' })
    return
  }
  next()
}

function requireStaffOrAdmin(req, res, next) {
  if (!req.user || !['staff', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ message: '원수사 연락처 관리 권한이 없습니다.' })
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

async function loadCompanySnapshot(client, companyId) {
  const m = await client.query(
    `
    SELECT customer_center, system_phone, incall_number, visit_info
    FROM insurance_company_master
    WHERE id = $1
    `,
    [companyId],
  )
  if (m.rowCount === 0) {
    return emptyCompanySnapshot()
  }
  const row = m.rows[0]
  const c = await client.query(
    `
    SELECT name, position, phone
    FROM insurance_company_contacts
    WHERE company_id = $1
    ORDER BY id ASC
    `,
    [companyId],
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

async function touchContactLastUpdatedAt(client) {
  await client.query(
    `
    INSERT INTO insurance_contact_meta (meta_key, meta_value, updated_at)
    VALUES ('contact_last_updated_at', NOW()::text, NOW())
    ON CONFLICT (meta_key)
    DO UPDATE SET meta_value = NOW()::text, updated_at = NOW()
    `,
  )
}

const app = express()
app.use(express.json({ limit: '2mb' }))

const apiRouter = express.Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

apiRouter.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}
    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const normalizedUsername = username.trim()
    const passwordHash = await bcrypt.hash(password, 10)
    const id = randomUUID()

    const inserted = await pool.query(
      `
      INSERT INTO users (id, username, password_hash)
      VALUES ($1, $2, $3)
      RETURNING created_at
      `,
      [id, normalizedUsername, passwordHash],
    )

    res.status(201).json({
      id,
      username: normalizedUsername,
      createdAt: toIsoString(inserted.rows[0].created_at),
    })
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, res)
  }
})

apiRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}
    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const normalizedUsername = username.trim()
    const loginDebug = process.env.INSURANCE_LOGIN_DEBUG === 'true'

    console.log('로그인 시도 username:', normalizedUsername)

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE username = $1
      `,
      [normalizedUsername],
    )

    const user = result.rows[0]
    console.log('DB user:', user ? { id: user.id, username: user.username } : null)

    if (!user) {
      console.log('❌ 사용자 없음')
      res.status(401).json({
        error: 'Invalid credentials',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    if (loginDebug) {
      console.log('입력 비번:', password)
      console.log('DB hash:', user.password_hash)
    }

    const match = await bcrypt.compare(password, user.password_hash)
    console.log('비밀번호 일치 여부:', match)

    if (!match) {
      console.log('❌ 비밀번호 불일치')
      res.status(401).json({
        error: 'Invalid credentials',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      })
      return
    }

    const uid = String(user.id)
    const role = normalizeUserRole(user.role)
    const token = jwt.sign(
      {
        userId: user.id,
        sub: user.id,
        username: user.username,
        role,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    )

    res.json({
      token,
      user: {
        id: uid,
        username: user.username,
        role,
      },
    })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/company/list', requireAuth, async (_req, res) => {
  try {
    const list = await loadCompanyDirectoryNestedList()
    res.json(list)
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/company/recent-updates', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
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
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 200
      `,
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
    handleDbError(error, res)
  }
})

apiRouter.post('/company/full-save', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const editor = String(req.user?.username ?? '').trim() || 'staff'
    const { company: co, contacts: contactsIn } = req.body ?? {}
    const name = String(co?.name ?? '').trim()
    if (!name) {
      res.status(400).json({ message: '보험사를 선택하세요.' })
      return
    }

    let category = normalizeInsuranceCompanyCategory(co?.category)
    category = coerceMeritzFireToNonLifeCategory(category, name)
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

    const contactsList = Array.isArray(contactsIn) ? contactsIn : []

    const companyId = await withTransaction(async (client) => {
      if (!existingId) {
        const found = await client.query(
          `SELECT id FROM insurance_company_master WHERE category = $1 AND name = $2`,
          [category, name],
        )
        if (found.rowCount > 0) {
          existingId = Number(found.rows[0].id)
        }
      }

      let beforeSnap = emptyCompanySnapshot()
      if (existingId) {
        beforeSnap = await loadCompanySnapshot(client, existingId)
      }

      let cid
      if (existingId) {
        const updated = await client.query(
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
          WHERE id = $8
          RETURNING id
          `,
          [category, name, customerCenter, systemPhone, incallNumber, visitInfo, editor, existingId],
        )
        if (updated.rowCount === 0) {
          const err = new Error('해당 보험사를 찾을 수 없습니다.')
          err.httpStatus = 404
          throw err
        }
        cid = existingId
        await client.query(`DELETE FROM insurance_company_contacts WHERE company_id = $1`, [cid])
      } else {
        const inserted = await client.query(
          `
          INSERT INTO insurance_company_master (
            category, name, customer_center, system_phone, incall_number, visit_info,
            updated_at, updated_by_username
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
          RETURNING id
          `,
          [category, name, customerCenter, systemPhone, incallNumber, visitInfo, editor],
        )
        cid = inserted.rows[0].id
      }

      for (const c of contactsList) {
        const cn = String(c?.name ?? '').trim()
        const cp = String(c?.position ?? '').trim()
        const cph = String(c?.phone ?? '').trim()
        if (!cn && !cp && !cph) {
          continue
        }
        await client.query(
          `
          INSERT INTO insurance_company_contacts (company_id, name, position, phone)
          VALUES ($1, $2, $3, $4)
          `,
          [cid, cn, cp, cph],
        )
      }

      const afterSnap = buildCompanySnapshotFromPayload(
        customerCenter,
        systemPhone,
        incallNumber,
        visitInfo,
        contactsList,
      )

      await client.query(
        `
        INSERT INTO insurance_company_update_log (
          company_id, company_name, category, updated_by_username, before_payload, after_payload
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        `,
        [cid, name, category, editor, JSON.stringify(beforeSnap), JSON.stringify(afterSnap)],
      )

      return cid
    })

    const list = await loadCompanyDirectoryNestedList()
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
    handleDbError(error, res)
  }
})

apiRouter.post('/company/general-save', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const { company: co, general: g } = req.body ?? {}
    const name = String(co?.name ?? '').trim()
    let category = normalizeInsuranceCompanyCategory(co?.category)
    category = coerceMeritzFireToNonLifeCategory(category, name)
    if (!name || !category || !['LIFE', 'NON_LIFE', 'GENERAL'].includes(category)) {
      res.status(400).json({ message: '보험 종류와 보험사명이 필요합니다.' })
      return
    }

    const found = await pool.query(
      `SELECT id FROM insurance_company_master WHERE category = $1 AND name = $2`,
      [category, name],
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

    await pool.query(
      `
      INSERT INTO insurance_general_request (company_id, description, phone, fax, email)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (company_id)
      DO UPDATE SET
        description = EXCLUDED.description,
        phone = EXCLUDED.phone,
        fax = EXCLUDED.fax,
        email = EXCLUDED.email
      `,
      [companyId, gDesc, gPhone, gFax, gEmail],
    )

    res.json({ success: true })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/insurance/contacts', requireAuth, async (_req, res) => {
  try {
    const contactsResult = await pool.query(
      `
      SELECT id, category, company_name, manager_name, position, phone_number, created_at, updated_at
      FROM insurance_contacts
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
    )

    const metaResult = await pool.query(
      `
      SELECT meta_value
      FROM insurance_contact_meta
      WHERE meta_key = 'contact_last_updated_at'
      `,
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
    handleDbError(error, res)
  }
})

apiRouter.get('/insurance/updates', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
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
      ORDER BY created_at DESC
      `,
    )

    res.json(result.rows.map(mapContactUpdateRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/insurance/contacts/:id/vcard', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, company_name, manager_name, position, phone_number
      FROM insurance_contacts
      WHERE id = $1
      `,
      [req.params.id],
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
    handleDbError(error, res)
  }
})

apiRouter.post('/admin/create-staff', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, name } = req.body ?? {}
    const validationMessage = validateCredentials(username, password)
    if (validationMessage) {
      res.status(400).json({ message: validationMessage })
      return
    }

    const normalizedUsername = String(username).trim()
    const displayName = String(name ?? '').trim()
    const passwordHash = await bcrypt.hash(password, 10)
    const id = randomUUID()

    await pool.query(
      `
      INSERT INTO users (id, username, password_hash, role, display_name)
      VALUES ($1, $2, $3, 'staff', $4)
      `,
      [id, normalizedUsername, passwordHash, displayName],
    )

    res.status(201).json({
      success: true,
      data: {
        id,
        username: normalizedUsername,
        role: 'staff',
        displayName,
      },
    })
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
      return
    }
    handleDbError(error, res)
  }
})

apiRouter.post('/admin/insurance/contacts', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
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
      const contactResult = await client.query(
        `
        INSERT INTO insurance_contacts (
          id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        `,
        [contactId, category, companyName, managerName, position, phoneNumber],
      )

      await client.query(
        `
        INSERT INTO insurance_contact_updates (
          id, contact_id, action_type, category, company_name, manager_name, position,
          old_phone_number, new_phone_number, description, created_at
        ) VALUES ($1, $2, 'CREATE', $3, $4, $5, $6, NULL, $7, $8, NOW())
        `,
        [randomUUID(), contactId, category, companyName, managerName, position, phoneNumber, description],
      )

      await touchContactLastUpdatedAt(client)
      return contactResult.rows[0]
    })

    res.status(201).json(mapContactRow(inserted))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.put('/admin/insurance/contacts/:id', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
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
      const existing = await client.query(
        `
        SELECT id, category, company_name, manager_name, position, phone_number
        FROM insurance_contacts
        WHERE id = $1
        `,
        [contactId],
      )

      if (existing.rowCount === 0) {
        return null
      }

      const updated = await client.query(
        `
        UPDATE insurance_contacts
        SET
          category = $1,
          company_name = $2,
          manager_name = $3,
          position = $4,
          phone_number = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING id, category, company_name, manager_name, position, phone_number, created_at, updated_at
        `,
        [category, companyName, managerName, position, phoneNumber, contactId],
      )

      const prev = existing.rows[0]
      await client.query(
        `
        INSERT INTO insurance_contact_updates (
          id, contact_id, action_type, category, company_name, manager_name, position,
          old_phone_number, new_phone_number, description, created_at
        ) VALUES ($1, $2, 'UPDATE', $3, $4, $5, $6, $7, $8, $9, NOW())
        `,
        [
          randomUUID(),
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

      await touchContactLastUpdatedAt(client)
      return updated.rows[0]
    })

    if (!updatedContact) {
      res.status(404).json({ message: '수정할 연락처를 찾을 수 없습니다.' })
      return
    }

    res.json(mapContactRow(updatedContact))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.delete('/admin/insurance/contacts/:id', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const contactId = req.params.id
    const description = String(req.body?.description ?? '연락처 삭제').trim()

    const deletedContact = await withTransaction(async (client) => {
      const existing = await client.query(
        `
        SELECT id, category, company_name, manager_name, position, phone_number
        FROM insurance_contacts
        WHERE id = $1
        `,
        [contactId],
      )

      if (existing.rowCount === 0) {
        return null
      }

      await client.query(
        `
        DELETE FROM insurance_contacts
        WHERE id = $1
        `,
        [contactId],
      )

      const prev = existing.rows[0]
      await client.query(
        `
        INSERT INTO insurance_contact_updates (
          id, contact_id, action_type, category, company_name, manager_name, position,
          old_phone_number, new_phone_number, description, created_at
        ) VALUES ($1, $2, 'DELETE', $3, $4, $5, $6, $7, NULL, $8, NOW())
        `,
        [
          randomUUID(),
          contactId,
          prev.category,
          prev.company_name,
          prev.manager_name,
          prev.position ?? '',
          normalizePhoneNumber(prev.phone_number),
          description,
        ],
      )

      await touchContactLastUpdatedAt(client)
      return prev
    })

    if (!deletedContact) {
      res.status(404).json({ message: '삭제할 연락처를 찾을 수 없습니다.' })
      return
    }

    res.status(204).send()
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/forms', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const result = await pool.query(
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [userId],
    )

    res.json(result.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/forms/expiring', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const result = await pool.query(
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1
        AND expiry_date IS NOT NULL
        AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY expiry_date ASC, updated_at DESC
      `,
      [userId],
    )

    res.json(result.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.post('/forms', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    console.log('저장 userId:', userId)

    const formData = extractFormData(req.body)
    if (!formData) {
      res.status(400).json({ message: 'form_data가 필요합니다.' })
      return
    }

    const linkedId = resolveLinkedCustomerIdFromRequest(req.body, formData)
    let customerIdFk = null
    if (linkedId != null) {
      const usable = await assertCustomerActiveAndOwnedByUser(linkedId, userId)
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

    const inserted = await pool.query(
      `
      INSERT INTO insurance_forms (
        id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
      RETURNING id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [id, userId, customerIdFk, customerName, carNumber, expiryDate || null, JSON.stringify(mergedForm)],
    )

    await logInsuranceFormsDbDiagnostics('post')

    res.status(201).json(mapFormRow(inserted.rows[0]))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.post('/forms/:id/renew', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const result = await pool.query(
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, userId],
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
      const check = await pool.query(
        `
        SELECT id FROM insurance_forms
        WHERE user_id = $1 AND expiry_date = $2
        `,
        [userId, newExpiry],
      )
      if (check.rowCount > 0) {
        res.status(400).json({ error: '이미 갱신된 신청서 있음' })
        return
      }
    }

    const newId = randomUUID()
    const customerName = String(original.customer_name ?? prevFormData.ownerName ?? '')
    const carNumber = String(original.car_number ?? prevFormData.vehicleNumber ?? '')

    const insert = await pool.query(
      `
      INSERT INTO insurance_forms (
        id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
      RETURNING id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [
        newId,
        userId,
        Number.isInteger(renewedCustomerId) && renewedCustomerId > 0 ? renewedCustomerId : null,
        customerName,
        carNumber,
        newExpiry || null,
        JSON.stringify(prevFormData),
      ],
    )

    await logInsuranceFormsDbDiagnostics('renew')

    res.status(201).json({ success: true, data: mapFormRow(insert.rows[0]) })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.post('/customers', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const data = req.body ?? {}
    const name = String(data.name ?? '').trim()
    if (!name) {
      res.status(400).json({ message: '고객 이름은 필수입니다.' })
      return
    }

    const ssn = String(data.ssn ?? '').trim()
    if (!ssn) {
      res.status(400).json({ message: '주민번호를 입력해주세요.' })
      return
    }

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

    const inserted = await pool.query(
      `
      INSERT INTO customers (
        user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        gender, insurance_age, next_age_date, is_driver, car_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      RETURNING
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        created_at
      `,
      [
        userId,
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
        JSON.stringify(notes),
      ],
    )

    res.status(201).json({ success: true, data: mapCustomerRow(inserted.rows[0]) })
  } catch (error) {
    handleDbError(error, res)
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

    const userRow = await pool.query(`SELECT id, role FROM users WHERE id = $1`, [refUserId])
    if (userRow.rowCount === 0) {
      res.status(400).json({ message: '유효하지 않은 소개 링크입니다.' })
      return
    }
    if (normalizeUserRole(userRow.rows[0].role) !== 'user') {
      res.status(400).json({ message: '고객 정보를 받을 수 있는 계정이 아닙니다.' })
      return
    }

    const name = String(data.name ?? '').trim()
    if (!name) {
      res.status(400).json({ message: '고객 이름은 필수입니다.' })
      return
    }

    const ssn = String(data.ssn ?? '').trim()
    if (!ssn) {
      res.status(400).json({ message: '주민번호를 입력해주세요.' })
      return
    }

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

    const inserted = await pool.query(
      `
      INSERT INTO customers (
        user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        gender, insurance_age, next_age_date, is_driver, car_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      RETURNING
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        created_at
      `,
      [
        refUserId,
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
        JSON.stringify(notes),
      ],
    )

    res.status(201).json({ success: true, data: mapCustomerRow(inserted.rows[0]) })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.put('/customers/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
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
        res.status(400).json({ message: '고객 이름은 필수입니다.' })
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

    if (hasKey('notes')) {
      parts.push(`notes = $${n++}::jsonb`)
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

    const setsDriverTrue =
      (hasKey('isDriver') && data.isDriver === true) || (hasKey('is_driver') && data.is_driver === true)
    if (
      setsDriverTrue &&
      (hasKey('carType') || hasKey('car_type')) &&
      !String(data.carType ?? data.car_type ?? '').trim()
    ) {
      res.status(400).json({ message: '차종을 입력해주세요.' })
      return
    }

    if (parts.length === 0) {
      res.status(400).json({ message: '수정할 필드가 없습니다.' })
      return
    }

    vals.push(customerId, userId)
    const updated = await pool.query(
      `
      UPDATE customers
      SET ${parts.join(', ')}
      WHERE id = $${n++} AND user_id = $${n++} AND deleted_at IS NULL
      RETURNING
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        created_at
      `,
      vals,
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
      return
    }

    res.json({ success: true, data: mapCustomerRow(updated.rows[0]) })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/customers/search', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const q = String(req.query.q ?? '').trim()
    let result
    if (!q) {
      result = await pool.query(
        `
        SELECT
          id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
          car_number, car_model, car_year, renewal_date,
          gender, insurance_age, next_age_date, is_driver, car_type, notes,
          created_at
        FROM customers
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 2000
        `,
        [userId],
      )
    } else {
      const pattern = `%${escapeIlikePattern(q)}%`
      result = await pool.query(
        `
        SELECT
          id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
          car_number, car_model, car_year, renewal_date,
          gender, insurance_age, next_age_date, is_driver, car_type, notes,
          created_at
        FROM customers
        WHERE user_id = $1 AND deleted_at IS NULL
          AND (name ILIKE $2 ESCAPE '\\' OR phone ILIKE $2 ESCAPE '\\')
        ORDER BY created_at DESC
        LIMIT 2000
        `,
        [userId, pattern],
      )
    }

    res.json(result.rows.map(mapCustomerRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/customers', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000)
    const result = await pool.query(
      `
      SELECT
        id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
        car_number, car_model, car_year, renewal_date,
        gender, insurance_age, next_age_date, is_driver, car_type, notes,
        created_at
      FROM customers
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY renewal_date ASC NULLS LAST, created_at DESC
      LIMIT $2
      `,
      [userId, limit],
    )

    res.json(result.rows.map(mapCustomerRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/customers/:id/forms', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const customerId = Number(req.params.id)
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      return
    }

    const check = await pool.query(`SELECT 1 FROM customers WHERE id = $1 AND user_id = $2`, [
      customerId,
      userId,
    ])

    if (check.rowCount === 0) {
      res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
      return
    }

    const forms = await pool.query(
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1 AND customer_id = $2
      ORDER BY created_at DESC
      `,
      [userId, customerId],
    )

    res.json(forms.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.delete('/customers/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const customerId = Number(req.params.id)
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      return
    }

    const deleted = await pool.query(
      `
      UPDATE customers
      SET deleted_at = NOW()
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `,
      [customerId, userId],
    )

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: '고객을 찾을 수 없거나 이미 삭제되었습니다.' })
      return
    }

    res.json({ success: true })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/forms/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const result = await pool.query(
      `
      SELECT id, user_id, customer_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, userId],
    )

    if (result.rowCount === 0) {
      res.status(404).json({ message: '신청서를 찾을 수 없습니다.' })
      return
    }

    res.json(mapFormRow(result.rows[0]))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.put('/forms/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    console.log('저장 userId:', userId)

    const formData = extractFormData(req.body)
    if (!formData) {
      res.status(400).json({ message: 'form_data가 필요합니다.' })
      return
    }

    const existingForm = await pool.query(
      `SELECT customer_id FROM insurance_forms WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId],
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
      const owned = await assertCustomerOwnedByUser(linkedId, userId)
      if (!owned) {
        res.status(400).json({ message: '유효하지 않은 고객 연결입니다.' })
        return
      }
      const active = await assertCustomerActiveAndOwnedByUser(linkedId, userId)
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

    const updated = await pool.query(
      `
      UPDATE insurance_forms
      SET
        customer_id = $1,
        customer_name = $2,
        car_number = $3,
        expiry_date = $4,
        form_data = $5::jsonb,
        updated_at = NOW()
      WHERE id = $6 AND user_id = $7
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
      ],
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ message: '수정할 신청서를 찾을 수 없습니다.' })
      return
    }

    await logInsuranceFormsDbDiagnostics('put')

    res.json(mapFormRow(updated.rows[0]))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.delete('/forms/:id', requireAuth, async (req, res) => {
  try {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return
    }

    const deleted = await pool.query(
      `
      DELETE FROM insurance_forms
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [req.params.id, userId],
    )

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: '삭제할 신청서를 찾을 수 없습니다.' })
      return
    }

    res.status(204).send()
  } catch (error) {
    handleDbError(error, res)
  }
})

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

  app.listen(PORT, () => {
    console.log(`Insurance server listening on port ${PORT}`)
    console.log('Insurance DB engine: PostgreSQL')
  })
}

startServer().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})
