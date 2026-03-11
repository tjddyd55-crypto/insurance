import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT ?? 3001)
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production'
const DIST_PATH = path.join(process.cwd(), 'dist')

function resolveDbPath() {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH
  }

  const candidateDirs = [
    process.env.RAILWAY_VOLUME_MOUNT_PATH,
    '/data',
    path.join(process.cwd(), 'data'),
    process.env.TMPDIR,
    process.env.TEMP,
  ].filter(Boolean)

  for (const dir of candidateDirs) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.accessSync(dir, fs.constants.W_OK)
      return path.join(dir, 'insurance.db')
    } catch {
      // 다음 경로 후보를 확인한다.
    }
  }

  return path.join(process.cwd(), 'data', 'insurance.db')
}

const DB_PATH = resolveDbPath()
const RUNNING_ON_RAILWAY =
  Boolean(process.env.RAILWAY_ENVIRONMENT) || Boolean(process.env.RAILWAY_SERVICE_NAME)
const USING_EPHEMERAL_DB_PATH =
  DB_PATH.startsWith('/tmp/') || DB_PATH.startsWith('/var/tmp/')

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
  expiry_date TEXT,
  form_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_insurance_forms_user_id
ON insurance_forms (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_forms_expiry
ON insurance_forms (user_id, expiry_date);
`)

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

function ensureInsuranceFormSchema() {
  const columns = db.prepare('PRAGMA table_info(insurance_forms)').all()
  const hasExpiryDate = columns.some((column) => column.name === 'expiry_date')
  if (!hasExpiryDate) {
    db.prepare('ALTER TABLE insurance_forms ADD COLUMN expiry_date TEXT').run()
  }

  const rowsToBackfill = db
    .prepare(
      `
      SELECT id, form_data
      FROM insurance_forms
      WHERE expiry_date IS NULL OR expiry_date = ''
      `,
    )
    .all()

  if (rowsToBackfill.length === 0) {
    return
  }

  const updateExpiryDate = db.prepare(
    'UPDATE insurance_forms SET expiry_date = ? WHERE id = ?',
  )
  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.form_data)
        const expiryDate = normalizeExpiryDate(parsed?.expiryDate ?? '')
        if (expiryDate) {
          updateExpiryDate.run(expiryDate, row.id)
        }
      } catch {
        // 손상된 JSON은 백필 단계에서 건너뛴다.
      }
    }
  })

  transaction(rowsToBackfill)
}

ensureInsuranceFormSchema()

const app = express()
app.use(express.json({ limit: '2mb' }))

function isSqliteReadonlyError(error) {
  return error?.code === 'SQLITE_READONLY'
}

function isSqliteBusyError(error) {
  return error?.code === 'SQLITE_BUSY'
}

function handleDbError(error, res) {
  if (isSqliteReadonlyError(error)) {
    res.status(500).json({
      message: 'DB 쓰기 권한이 없어 저장할 수 없습니다. DB_PATH를 쓰기 가능한 경로로 설정해 주세요.',
    })
    return
  }

  if (isSqliteBusyError(error)) {
    res.status(503).json({ message: 'DB가 잠겨 있습니다. 잠시 후 다시 시도해 주세요.' })
    return
  }

  throw error
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
  const formData = JSON.parse(row.form_data)
  const customerName = row.customer_name || formData.ownerName || ''
  const carNumber = row.car_number || formData.vehicleNumber || ''
  const expiryDate = normalizeExpiryDate(row.expiry_date ?? formData.expiryDate ?? '')

  return {
    ...formData,
    expiryDate,
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
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.post('/login', async (req, res) => {
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

apiRouter.get('/forms', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = ?
      ORDER BY datetime(updated_at) DESC
      `,
    )
    .all(req.user.id)

  res.json(rows.map(mapFormRow))
})

apiRouter.get('/forms/expiring', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      FROM insurance_forms
      WHERE user_id = ?
        AND expiry_date IS NOT NULL
        AND expiry_date != ''
        AND expiry_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 day')
      ORDER BY date(expiry_date) ASC, datetime(updated_at) DESC
      `,
    )
    .all(req.user.id)

  res.json(rows.map(mapFormRow))
})

apiRouter.post('/forms', requireAuth, (req, res) => {
  try {
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
    const expiryDate = normalizeExpiryDate(
      req.body.expiry_date ?? req.body.expiryDate ?? formData.expiryDate ?? '',
    )

    db.prepare(
      `
      INSERT INTO insurance_forms (
        id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      req.user.id,
      customerName,
      carNumber,
      expiryDate,
      JSON.stringify(formData),
      now,
      now,
    )

    const row = db
      .prepare(
        `
        SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
        FROM insurance_forms
        WHERE id = ? AND user_id = ?
        `,
      )
      .get(id, req.user.id)

    res.status(201).json(mapFormRow(row))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.get('/forms/:id', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `
      SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
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

apiRouter.put('/forms/:id', requireAuth, (req, res) => {
  try {
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
    const expiryDate = normalizeExpiryDate(
      req.body.expiry_date ?? req.body.expiryDate ?? formData.expiryDate ?? '',
    )

    const result = db
      .prepare(
        `
        UPDATE insurance_forms
        SET customer_name = ?, car_number = ?, expiry_date = ?, form_data = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        `,
      )
      .run(
        customerName,
        carNumber,
        expiryDate,
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
        SELECT id, user_id, customer_name, car_number, expiry_date, form_data, created_at, updated_at
        FROM insurance_forms
        WHERE id = ? AND user_id = ?
        `,
      )
      .get(req.params.id, req.user.id)

    res.json(mapFormRow(row))
  } catch (error) {
    handleDbError(error, res)
  }
})

apiRouter.delete('/forms/:id', requireAuth, (req, res) => {
  try {
    const result = db
      .prepare('DELETE FROM insurance_forms WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id)

    if (result.changes === 0) {
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

app.listen(PORT, () => {
  console.log(`Insurance server listening on port ${PORT}`)
  console.log(`Insurance DB path: ${DB_PATH}`)
  if (USING_EPHEMERAL_DB_PATH) {
    console.warn(
      'WARNING: DB_PATH가 임시 경로입니다. 컨테이너 재시작 시 회원/신청서 데이터가 초기화될 수 있습니다.',
    )
  }
  if (RUNNING_ON_RAILWAY && !process.env.DB_PATH && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn(
      'WARNING: Railway Volume이 감지되지 않았습니다. 영구 저장을 위해 DB_PATH 또는 RAILWAY_VOLUME_MOUNT_PATH를 설정하세요.',
    )
  }
})
