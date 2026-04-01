import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pool from './db.js'
import { initDb } from './initDb.js'

const PORT = Number(process.env.PORT ?? 3001)
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production'
const DEFAULT_JWT_SECRET = 'change-this-in-production'
const INSURANCE_CONTACT_ADMIN_USERNAME =
  process.env.INSURANCE_CONTACT_ADMIN_USERNAME ?? 'admin'
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

  return {
    ...formData,
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

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function normalizeCategory(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().toUpperCase()
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

function createVCardContent(contact) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.manager_name}`,
    `N:${contact.manager_name};;;`,
    `ORG:${contact.company_name}`,
    contact.position ? `TITLE:${contact.position}` : '',
    `TEL;TYPE=CELL:${contact.phone_number}`,
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
    const payload = jwt.verify(token, JWT_SECRET)
    const userId = payload.userId ?? payload.sub
    if (userId === undefined || userId === null || String(userId).trim() === '') {
      res.status(401).json({ message: '토큰에 사용자 ID가 없습니다.' })
      return
    }

    req.user = {
      id: String(userId),
      username: typeof payload.username === 'string' ? payload.username : '',
    }

    if (req.originalUrl?.includes('/forms')) {
      console.log('로그인 user:', req.user)
    }
    next()
  } catch {
    res.status(401).json({ message: '인증이 만료되었거나 유효하지 않습니다.' })
  }
}

function requireInsuranceContactAdmin(req, res, next) {
  if (!req.user || req.user.username !== INSURANCE_CONTACT_ADMIN_USERNAME) {
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
    const result = await pool.query(
      `
      SELECT id, username, password_hash
      FROM users
      WHERE username = $1
      `,
      [normalizedUsername],
    )

    const user = result.rows[0]
    if (!user) {
      res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
      return
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
      return
    }

    const uid = String(user.id)
    const token = jwt.sign(
      { sub: uid, userId: uid, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' },
    )

    res.json({
      token,
      user: {
        id: String(user.id),
        username: user.username,
      },
    })
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/insurance/contacts', async (_req, res) => {
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

apiRouter.get('/insurance/updates', async (_req, res) => {
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

apiRouter.get('/insurance/contacts/:id/vcard', async (req, res) => {
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

apiRouter.post('/admin/insurance/contacts', requireAuth, requireInsuranceContactAdmin, async (req, res) => {
  try {
    const category = normalizeCategory(req.body?.category)
    const companyName = String(req.body?.companyName ?? req.body?.company_name ?? '').trim()
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

apiRouter.put('/admin/insurance/contacts/:id', requireAuth, requireInsuranceContactAdmin, async (req, res) => {
  try {
    const contactId = req.params.id
    const category = normalizeCategory(req.body?.category)
    const companyName = String(req.body?.companyName ?? req.body?.company_name ?? '').trim()
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

apiRouter.delete('/admin/insurance/contacts/:id', requireAuth, requireInsuranceContactAdmin, async (req, res) => {
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
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
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
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
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

    const id = randomUUID()
    const customerName = String(
      req.body.customer_name ?? req.body.customerName ?? formData.ownerName ?? '',
    )
    const carNumber = String(
      req.body.car_number ?? req.body.carNumber ?? formData.vehicleNumber ?? '',
    )
    const expiryDate = normalizeExpiryDate(
      req.body.expiry_date ?? req.body.expiryDate ?? formData.expiryDate ?? '',
    )

    const inserted = await pool.query(
      `
      INSERT INTO insurance_forms (
        id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
      RETURNING id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [id, userId, customerName, carNumber, expiryDate || null, JSON.stringify(formData)],
    )

    await logInsuranceFormsDbDiagnostics('post')

    res.status(201).json(mapFormRow(inserted.rows[0]))
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
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
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

    const customerName = String(
      req.body.customer_name ?? req.body.customerName ?? formData.ownerName ?? '',
    )
    const carNumber = String(
      req.body.car_number ?? req.body.carNumber ?? formData.vehicleNumber ?? '',
    )
    const expiryDate = normalizeExpiryDate(
      req.body.expiry_date ?? req.body.expiryDate ?? formData.expiryDate ?? '',
    )

    const updated = await pool.query(
      `
      UPDATE insurance_forms
      SET customer_name = $1, car_number = $2, expiry_date = $3, form_data = $4::jsonb, updated_at = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      `,
      [
        customerName,
        carNumber,
        expiryDate || null,
        JSON.stringify(formData),
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
