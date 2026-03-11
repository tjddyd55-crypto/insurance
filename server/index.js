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

function extractFormData(body) {
  const formData = body?.formData ?? body?.form_data
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
    return null
  }

  return formData
}

function handleDbError(error, res) {
  if (error?.code === '23505') {
    res.status(409).json({ message: '이미 존재하는 데이터입니다.' })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'DB 처리 중 오류가 발생했습니다.' })
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = {
      id: payload.sub,
      username: payload.username,
    }
    next()
  } catch {
    res.status(401).json({ message: '인증이 만료되었거나 유효하지 않습니다.' })
  }
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

    const token = jwt.sign(
      { sub: String(user.id), username: user.username },
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

apiRouter.get('/forms', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1
      ORDER BY updated_at DESC
      `,
      [req.user.id],
    )

    res.json(result.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/forms/expiring', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = $1
        AND expiry_date IS NOT NULL
        AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY expiry_date ASC, updated_at DESC
      `,
      [req.user.id],
    )

    res.json(result.rows.map(mapFormRow))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.post('/forms', requireAuth, async (req, res) => {
  try {
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
      [id, req.user.id, customerName, carNumber, expiryDate || null, JSON.stringify(formData)],
    )

    res.status(201).json(mapFormRow(inserted.rows[0]))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/forms/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.user.id],
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
        req.user.id,
      ],
    )

    if (updated.rowCount === 0) {
      res.status(404).json({ message: '수정할 신청서를 찾을 수 없습니다.' })
      return
    }

    res.json(mapFormRow(updated.rows[0]))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.delete('/forms/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await pool.query(
      `
      DELETE FROM insurance_forms
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [req.params.id, req.user.id],
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
  await initDb()

  app.listen(PORT, () => {
    console.log(`Insurance server listening on port ${PORT}`)
    console.log('Insurance DB engine: PostgreSQL')
  })
}

startServer().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})
