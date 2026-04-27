import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  parseCustomerImportBuffer,
  assertImportFilenameAllowed,
  chunkArray,
} from '../services/customerImportParser.js'
import { normalizeImportRow } from '../services/customerImportNormalizer.js'
import { loadCustomerDuplicateIndex, classifyImportRow } from '../services/customerImportValidator.js'
import { calculateInsuranceInfoFromRrn, nextAgeDateToSqlDate } from '../lib/autoImportInsuranceFromRrn.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

const ROW_INSERT_CHUNK = 200
const APPLY_BATCH = 100
const REASON_MAX = 900
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {import('pg').PoolClient | import('pg').Pool} executor
 * @param {string} jobId
 */
async function refreshJobCounts(executor, jobId) {
  await executor.query(
    `
    UPDATE customer_import_jobs j SET
      total_rows = (SELECT COUNT(*)::int FROM customer_import_rows r WHERE r.job_id = j.id),
      ready_rows = (SELECT COUNT(*)::int FROM customer_import_rows r WHERE r.job_id = j.id AND r.status = 'ready'),
      incomplete_rows = (SELECT COUNT(*)::int FROM customer_import_rows r WHERE r.job_id = j.id AND r.status = 'incomplete'),
      duplicate_rows = (SELECT COUNT(*)::int FROM customer_import_rows r WHERE r.job_id = j.id AND r.status = 'duplicate'),
      error_rows = (SELECT COUNT(*)::int FROM customer_import_rows r WHERE r.job_id = j.id AND r.status = 'error'),
      imported_rows = (SELECT COUNT(*)::int FROM customer_import_rows r WHERE r.job_id = j.id AND r.status = 'imported'),
      updated_at = NOW()
    WHERE j.id = $1::uuid
    `,
    [jobId],
  )
}

/** @param {ReturnType<typeof normalizeImportRow>} n */
function buildNormalizedPayload(n) {
  return {
    name: n.name,
    phone: n.phone,
    phoneRawDigits: n.phoneRawDigits,
    ssn: n.ssn,
    ssnDigits: n.ssnDigits,
    gender: n.gender,
    address: n.address,
    carNumber: n.carNumber,
    renewalDate: n.renewalDate,
    job: n.job,
    notesText: n.notesText,
  }
}

/**
 * @param {ReturnType<typeof normalizeImportRow>} n
 * @param {Awaited<ReturnType<typeof loadCustomerDuplicateIndex>>} dupIdx
 * @param {Set<string>} filePhones
 * @param {Set<string>} fileSsns
 */
function classifyWithFileDup(n, dupIdx, filePhones, fileSsns) {
  const c = classifyImportRow(n, dupIdx)
  if (c.status !== 'ready') {
    return c
  }
  if (n.phone && filePhones.has(n.phone)) {
    return {
      status: 'duplicate',
      reason: '동일 파일 내 전화번호가 중복됩니다.',
      matchedCustomerId: null,
    }
  }
  const sd = n.ssnDigits && n.ssnDigits.length >= 7 ? n.ssnDigits : ''
  if (sd && fileSsns.has(sd)) {
    return {
      status: 'duplicate',
      reason: '동일 파일 내 주민번호가 중복됩니다.',
      matchedCustomerId: null,
    }
  }
  if (n.phone) {
    filePhones.add(n.phone)
  }
  if (sd) {
    fileSsns.add(sd)
  }
  return c
}

function normalizeNotesForInsert(notesText) {
  const t = String(notesText ?? '').trim()
  if (!t) {
    return { items: [], insuranceHistory: '' }
  }
  return {
    items: [{ id: randomUUID(), content: sliceReason(t, 10000), createdAt: new Date().toISOString() }],
    insuranceHistory: '',
  }
}

function sliceReason(s, max = REASON_MAX) {
  const t = String(s ?? '')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function normalizeRenewalSql(raw) {
  const s = String(raw ?? '').trim()
  if (!s) {
    return null
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    return null
  }
  return d.toISOString().slice(0, 10)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {number} gaId
 * @param {Record<string, unknown>} n
 */
async function insertCustomerFromNormalized(pool, userId, gaId, n) {
  const name = String(n.name ?? '').trim()
  const ssnRaw = String(n.ssnDigits ?? n.ssn ?? '').replace(/[^0-9]/g, '')
  const ssn = ssnRaw
  const { age: insuranceAge, nextAgeDate: nextAgeDateObj } = calculateInsuranceInfoFromRrn(ssn)
  const nextAgeSql = nextAgeDateToSqlDate(nextAgeDateObj)
  const genderRaw = String(n.gender ?? '').trim()
  const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : ''

  const phone = String(n.phone ?? '').trim()
  const address = String(n.address ?? '').trim()
  const job = String(n.job ?? '').trim()
  const carNumber = String(n.carNumber ?? '').trim()
  const renewalDateSql = normalizeRenewalSql(n.renewalDate ?? '')
  const notes = normalizeNotesForInsert(n.notesText ?? '')

  const inserted = await safeQuery(
    pool,
    `
    INSERT INTO customers (
      user_id, ga_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
      gender, insurance_age, next_age_date, is_driver, car_type,
      car_number, car_model, car_year, renewal_date,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CAST($22 AS jsonb))
    RETURNING id
    `,
    [
      userId,
      gaId,
      name,
      ssn,
      phone,
      '',
      address,
      '',
      '',
      job,
      '',
      '',
      gender,
      insuranceAge,
      nextAgeSql,
      null,
      '',
      carNumber,
      '',
      '',
      renewalDateSql,
      JSON.stringify(notes),
    ],
  )
  return inserted.rows[0]
}

function mapJobRow(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    userId: row.user_id,
    gaId: row.ga_id,
    originalFilename: row.original_filename,
    status: row.status,
    totalRows: row.total_rows,
    readyRows: row.ready_rows,
    incompleteRows: row.incomplete_rows,
    duplicateRows: row.duplicate_rows,
    errorRows: row.error_rows,
    importedRows: row.imported_rows,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRowRecord(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    rowIndex: row.row_index,
    rawRow: row.raw_row,
    normalizedRow: row.normalized_row,
    status: row.status,
    reason: row.reason,
    matchedCustomerId: row.matched_customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {import('express').Router} router
 * @param {{
 *   pool: import('pg').Pool
 *   requireAuth: import('express').RequestHandler
 *   handleDbError: (err: unknown, req: import('express').Request, res: import('express').Response) => void
 *   requireInsuranceFormUserId: (req: import('express').Request, res: import('express').Response) => string | null
 *   parseGaId: (v: unknown) => number | null
 *   recordAnalyticsEvent: (pool: import('pg').Pool, opts: { userId: string, gaId: number | null, eventType: string }) => void
 * }} ctx
 */
export function registerCustomerImportApi(router, ctx) {
  const { pool, requireAuth, handleDbError, requireInsuranceFormUserId, parseGaId, recordAnalyticsEvent: recordA } =
    ctx

  router.post(
    '/customers/import-jobs',
    requireAuth,
    (req, res, next) => {
      upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ message: '파일 크기는 25MB 이하여야 합니다.' })
            return
          }
          res.status(400).json({ message: '파일 업로드에 실패했습니다.' })
          return
        }
        if (err) {
          next(err)
          return
        }
        next()
      })
    },
    async (req, res) => {
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
        if (!req.file?.buffer) {
          res.status(400).json({ message: '파일이 필요합니다. (multipart field: file)' })
          return
        }
        const originalFilename = String(req.file.originalname ?? 'upload.xlsx')
        if (!assertImportFilenameAllowed(originalFilename)) {
          res.status(400).json({ message: '지원 형식: .xlsx, .xls, .csv' })
          return
        }

        const parsed = parseCustomerImportBuffer(req.file.buffer, originalFilename)
        if (parsed.rows.length === 0) {
          res.status(400).json({ message: '파싱된 데이터 행이 없습니다.' })
          return
        }

        const dupIdx = await loadCustomerDuplicateIndex(pool, userId, gaId)
        const filePhones = new Set()
        const fileSsns = new Set()

        const rowPayloads = parsed.rows.map(({ rowIndex, raw }) => {
          const n = normalizeImportRow(raw)
          const c = classifyWithFileDup(n, dupIdx, filePhones, fileSsns)
          return { rowIndex, raw, n, c }
        })

        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const jobIns = await client.query(
            `
            INSERT INTO customer_import_jobs (user_id, ga_id, original_filename, status, total_rows)
            VALUES ($1, $2, $3, 'pending', 0)
            RETURNING *
            `,
            [userId, gaId, originalFilename],
          )
          const jobId = jobIns.rows[0].id

          for (const chunk of chunkArray(rowPayloads, ROW_INSERT_CHUNK)) {
            const values = []
            const ph = []
            let pi = 1
            for (const item of chunk) {
              ph.push(
                `($${pi++}::uuid, $${pi++}::int, $${pi++}::jsonb, $${pi++}::jsonb, $${pi++}, $${pi++}, $${pi++})`,
              )
              values.push(
                jobId,
                item.rowIndex,
                JSON.stringify(item.raw),
                JSON.stringify(buildNormalizedPayload(item.n)),
                item.c.status,
                item.c.reason,
                item.c.matchedCustomerId,
              )
            }
            await client.query(
              `
              INSERT INTO customer_import_rows (job_id, row_index, raw_row, normalized_row, status, reason, matched_customer_id)
              VALUES ${ph.join(',')}
              `,
              values,
            )
          }

          await client.query(`UPDATE customer_import_jobs SET status = 'analyzed', updated_at = NOW() WHERE id = $1::uuid`, [
            jobId,
          ])
          await refreshJobCounts(client, jobId)
          await client.query('COMMIT')

          const done = await safeQuery(pool, `SELECT * FROM customer_import_jobs WHERE id = $1::uuid`, [jobId])
          res.status(201).json({ success: true, data: mapJobRow(done.rows[0]) })
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  router.get('/customers/import-jobs', requireAuth, async (req, res) => {
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
      const lim = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100)
      const r = await safeQuery(
        pool,
        `
        SELECT * FROM customer_import_jobs
        WHERE user_id = $1 AND ga_id = $2
        ORDER BY created_at DESC
        LIMIT $3
        `,
        [userId, gaId, lim],
      )
      res.json({ success: true, data: r.rows.map(mapJobRow) })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  router.get('/customers/import-jobs/:jobId', requireAuth, async (req, res) => {
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
      const jobId = String(req.params.jobId ?? '')
      if (!UUID_RE.test(jobId)) {
        res.status(400).json({ message: '잘못된 작업 ID입니다.' })
        return
      }
      const r = await safeQuery(
        pool,
        `SELECT * FROM customer_import_jobs WHERE id = $1::uuid AND user_id = $2 AND ga_id = $3`,
        [jobId, userId, gaId],
      )
      if (r.rowCount === 0) {
        res.status(404).json({ message: '작업을 찾을 수 없습니다.' })
        return
      }
      await refreshJobCounts(pool, jobId)
      const again = await safeQuery(pool, `SELECT * FROM customer_import_jobs WHERE id = $1::uuid`, [jobId])
      res.json({ success: true, data: mapJobRow(again.rows[0]) })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  router.get('/customers/import-jobs/:jobId/rows', requireAuth, async (req, res) => {
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
      const jobId = String(req.params.jobId ?? '')
      if (!UUID_RE.test(jobId)) {
        res.status(400).json({ message: '잘못된 작업 ID입니다.' })
        return
      }
      const jobCheck = await safeQuery(
        pool,
        `SELECT 1 FROM customer_import_jobs WHERE id = $1::uuid AND user_id = $2 AND ga_id = $3`,
        [jobId, userId, gaId],
      )
      if (jobCheck.rowCount === 0) {
        res.status(404).json({ message: '작업을 찾을 수 없습니다.' })
        return
      }

      const statusRaw = String(req.query.status ?? '').trim().toLowerCase()
      const allowed = new Set(['ready', 'incomplete', 'duplicate', 'error', 'imported', ''])
      if (!allowed.has(statusRaw)) {
        res.status(400).json({ message: 'status는 ready|incomplete|duplicate|error|imported 중 하나여야 합니다.' })
        return
      }
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
      const offset = Math.max(Number(req.query.offset) || 0, 0)

      let r
      let cRow
      if (statusRaw) {
        r = await safeQuery(
          pool,
          `
          SELECT r.*
          FROM customer_import_rows r
          WHERE r.job_id = $1::uuid AND r.status = $2
          ORDER BY r.row_index ASC
          LIMIT $3 OFFSET $4
          `,
          [jobId, statusRaw, limit, offset],
        )
        cRow = await safeQuery(
          pool,
          `SELECT COUNT(*)::int AS c FROM customer_import_rows r WHERE r.job_id = $1::uuid AND r.status = $2`,
          [jobId, statusRaw],
        )
      } else {
        r = await safeQuery(
          pool,
          `
          SELECT r.*
          FROM customer_import_rows r
          WHERE r.job_id = $1::uuid
          ORDER BY r.row_index ASC
          LIMIT $2 OFFSET $3
          `,
          [jobId, limit, offset],
        )
        cRow = await safeQuery(
          pool,
          `SELECT COUNT(*)::int AS c FROM customer_import_rows r WHERE r.job_id = $1::uuid`,
          [jobId],
        )
      }

      res.json({
        success: true,
        data: r.rows.map(mapRowRecord),
        total: Number(cRow.rows[0]?.c ?? 0) || 0,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  router.post('/customers/import-jobs/:jobId/apply', requireAuth, async (req, res) => {
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
      const jobId = String(req.params.jobId ?? '')
      if (!UUID_RE.test(jobId)) {
        res.status(400).json({ message: '잘못된 작업 ID입니다.' })
        return
      }
      const jobCheck = await safeQuery(
        pool,
        `SELECT * FROM customer_import_jobs WHERE id = $1::uuid AND user_id = $2 AND ga_id = $3`,
        [jobId, userId, gaId],
      )
      if (jobCheck.rowCount === 0) {
        res.status(404).json({ message: '작업을 찾을 수 없습니다.' })
        return
      }

      await safeQuery(pool, `UPDATE customer_import_jobs SET status = 'applying', updated_at = NOW() WHERE id = $1::uuid`, [
        jobId,
      ])

      let applied = 0
      let failed = 0

      while (true) {
        const batch = await safeQuery(
          pool,
          `
          SELECT id, normalized_row
          FROM customer_import_rows
          WHERE job_id = $1::uuid AND status = 'ready'
          ORDER BY row_index ASC
          LIMIT $2
          `,
          [jobId, APPLY_BATCH],
        )
        if (batch.rowCount === 0) {
          break
        }
        for (const row of batch.rows) {
          const n = row.normalized_row
          if (!n || typeof n !== 'object') {
            await safeQuery(pool,
              `UPDATE customer_import_rows SET status = 'error', reason = $2, updated_at = NOW() WHERE id = $1::uuid`,
              [row.id, '정규화 데이터가 없습니다.'],
            )
            failed += 1
            continue
          }
          try {
            const ins = await insertCustomerFromNormalized(pool, userId, gaId, n)
            await safeQuery(
              pool,
              `
              UPDATE customer_import_rows
              SET status = 'imported', matched_customer_id = $2, reason = NULL, updated_at = NOW()
              WHERE id = $1::uuid
              `,
              [row.id, ins.id],
            )
            applied += 1
            void recordA(pool, { userId, gaId, eventType: 'customer_created' })
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            await safeQuery(
              pool,
              `
              UPDATE customer_import_rows
              SET status = 'error', reason = $2, updated_at = NOW()
              WHERE id = $1::uuid
              `,
              [row.id, sliceReason(msg)],
            )
            failed += 1
          }
        }
        await refreshJobCounts(pool, jobId)
      }

      const readyLeft = await safeQuery(
        pool,
        `SELECT COUNT(*)::int AS c FROM customer_import_rows WHERE job_id = $1::uuid AND status = 'ready'`,
        [jobId],
      )
      const rem = Number(readyLeft.rows[0]?.c ?? 0) || 0
      const statusNext = rem === 0 ? 'completed' : 'analyzed'
      await safeQuery(pool,
        `UPDATE customer_import_jobs SET status = $2, updated_at = NOW() WHERE id = $1::uuid`,
        [jobId, statusNext],
      )
      await refreshJobCounts(pool, jobId)
      const done = await safeQuery(pool, `SELECT * FROM customer_import_jobs WHERE id = $1::uuid`, [jobId])
      res.json({
        success: true,
        data: {
          job: mapJobRow(done.rows[0]),
          appliedInRequest: applied,
          failedInRequest: failed,
        },
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  router.patch('/customers/import-jobs/:jobId/rows/:rowId', requireAuth, async (_req, res) => {
    res.status(501).json({ message: '2차 범위에서 제공 예정입니다.' })
  })
}
