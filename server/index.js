import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT ?? 3001)
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production'
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'insurance.db')
const DIST_PATH = path.join(process.cwd(), 'dist')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insurance_forms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  car_number TEXT NOT NULL,
  form_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_insurance_forms_user_id
ON insurance_forms (user_id, updated_at DESC);
`)

const app = express()
app.use(express.json({ limit: '2mb' }))

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
  const formData = JSON.parse(row.form_data)
  const customerName = row.customer_name || formData.ownerName || ''
  const carNumber = row.car_number || formData.vehicleNumber || ''

  return {
    ...formData,
    id: row.id,
    userId: row.user_id,
    customerName,
    carNumber,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: buildFormTitle(customerName, carNumber, row.updated_at),
  }
}

function extractFormData(body) {
  const formData = body?.formData ?? body?.form_data
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
    return null
  }

  return formData
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body ?? {}
  const validationMessage = validateCredentials(username, password)
  if (validationMessage) {
    res.status(400).json({ message: validationMessage })
    return
  }

  const normalizedUsername = username.trim()
  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(normalizedUsername)

  if (existing) {
    res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const id = randomUUID()
  const createdAt = new Date().toISOString()

  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, normalizedUsername, passwordHash, createdAt)

  res.status(201).json({
    id,
    username: normalizedUsername,
    createdAt,
  })
})

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  const validationMessage = validateCredentials(username, password)
  if (validationMessage) {
    res.status(400).json({ message: validationMessage })
    return
  }

  const normalizedUsername = username.trim()
  const user = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(normalizedUsername)

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
    { sub: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' },
  )

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  })
})

app.get('/api/forms', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = ?
      ORDER BY datetime(updated_at) DESC
      `,
    )
    .all(req.user.id)

  res.json(rows.map(mapFormRow))
})

app.post('/api/forms', requireAuth, (req, res) => {
  const formData = extractFormData(req.body)
  if (!formData) {
    res.status(400).json({ message: 'form_data가 필요합니다.' })
    return
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  const customerName = String(
    req.body.customer_name ?? req.body.customerName ?? formData.ownerName ?? '',
  )
  const carNumber = String(
    req.body.car_number ?? req.body.carNumber ?? formData.vehicleNumber ?? '',
  )

  db.prepare(
    `
    INSERT INTO insurance_forms (
      id, user_id, customer_name, car_number, form_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    req.user.id,
    customerName,
    carNumber,
    JSON.stringify(formData),
    now,
    now,
  )

  const row = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = ? AND user_id = ?
      `,
    )
    .get(id, req.user.id)

  res.status(201).json(mapFormRow(row))
})

app.get('/api/forms/:id', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = ? AND user_id = ?
      `,
    )
    .get(req.params.id, req.user.id)

  if (!row) {
    res.status(404).json({ message: '신청서를 찾을 수 없습니다.' })
    return
  }

  res.json(mapFormRow(row))
})

app.put('/api/forms/:id', requireAuth, (req, res) => {
  const formData = extractFormData(req.body)
  if (!formData) {
    res.status(400).json({ message: 'form_data가 필요합니다.' })
    return
  }

  const now = new Date().toISOString()
  const customerName = String(
    req.body.customer_name ?? req.body.customerName ?? formData.ownerName ?? '',
  )
  const carNumber = String(
    req.body.car_number ?? req.body.carNumber ?? formData.vehicleNumber ?? '',
  )

  const result = db
    .prepare(
      `
      UPDATE insurance_forms
      SET customer_name = ?, car_number = ?, form_data = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
      `,
    )
    .run(
      customerName,
      carNumber,
      JSON.stringify(formData),
      now,
      req.params.id,
      req.user.id,
    )

  if (result.changes === 0) {
    res.status(404).json({ message: '수정할 신청서를 찾을 수 없습니다.' })
    return
  }

  const row = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE id = ? AND user_id = ?
      `,
    )
    .get(req.params.id, req.user.id)

  res.json(mapFormRow(row))
})

app.delete('/api/forms/:id', requireAuth, (req, res) => {
  const result = db
    .prepare('DELETE FROM insurance_forms WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id)

  if (result.changes === 0) {
    res.status(404).json({ message: '삭제할 신청서를 찾을 수 없습니다.' })
    return
  }

  res.status(204).send()
})

if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'))
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: '서버 오류가 발생했습니다.' })
})

app.listen(PORT, () => {
  console.log(`Insurance server listening on port ${PORT}`)
})
