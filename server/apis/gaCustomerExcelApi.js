import multer from 'multer'
import * as XLSX from 'xlsx'
import { safeQuery } from '../utils/dbSafeQuery.js'

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

const ALLOWED_MATCH_DB_FIELDS = new Set(['name', 'birth_date', 'ssn'])
const ALLOWED_FILTER_OPS = new Set(['=', '!='])

function parseGaIdParam(raw) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

function cellToString(v) {
  if (v == null) {
    return ''
  }
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).trim()
}

function normalizeName(v) {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSsn(v) {
  return String(v ?? '')
    .replace(/[^0-9]/g, '')
    .trim()
}

/** yyyy-mm-dd, yyyy.mm.dd, yyyymmdd 등 → yyyy-mm-dd 비교용 */
function normalizeDateString(v) {
  const s = String(v ?? '')
    .trim()
    .replace(/\./g, '-')
    .replace(/\//g, '-')
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`
  }
  return s
}

function customerBirthYmd(row) {
  const bd = row.birth_date
  if (bd instanceof Date) {
    return bd.toISOString().slice(0, 10)
  }
  if (bd) {
    return normalizeDateString(String(bd).slice(0, 10))
  }
  return ''
}

function getCustomerNormalizedField(row, dbField) {
  if (dbField === 'name') {
    return normalizeName(row.name ?? '')
  }
  if (dbField === 'ssn') {
    return normalizeSsn(row.ssn ?? '')
  }
  if (dbField === 'birth_date') {
    return normalizeDateString(customerBirthYmd(row))
  }
  return ''
}

function getExcelCellNormalized(cells, columnId, dbField) {
  const raw = cells[columnId]
  const s = cellToString(raw)
  if (dbField === 'ssn') {
    return normalizeSsn(s)
  }
  if (dbField === 'birth_date') {
    return normalizeDateString(s)
  }
  return normalizeName(s)
}

/**
 * 첫 시트, 첫 행 헤더 → col_0… 안정 id 부여
 * @param {Buffer} buffer
 */
function parseExcelSampleToColumnsAndRows(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    throw new Error('EMPTY_WORKBOOK')
  }
  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error('EMPTY_SHEET')
  }
  const headerRow = matrix[0]
  if (!Array.isArray(headerRow)) {
    throw new Error('BAD_HEADER')
  }
  const columns = headerRow.map((h, index) => ({
    id: `col_${index}`,
    header: String(h ?? '').trim() || `열${index + 1}`,
    index,
  }))
  const dataRows = []
  for (let i = 1; i < matrix.length; i++) {
    const arr = matrix[i]
    const cells = {}
    let any = false
    for (let j = 0; j < columns.length; j++) {
      const v = Array.isArray(arr) ? arr[j] : undefined
      const str = cellToString(v)
      cells[columns[j].id] = str
      if (str) {
        any = true
      }
    }
    if (any) {
      dataRows.push({ rowIndex: i + 1, cells })
    }
  }
  return { columns, dataRows }
}

function parseJsonArray(raw, fallback = []) {
  if (raw == null) {
    return fallback
  }
  if (Array.isArray(raw)) {
    return raw
  }
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

function columnIdSet(columns) {
  return new Set(columns.map((c) => c.id))
}

function rowPassesFilter(cells, filterColumnId, filterOp, filterValue) {
  if (!filterColumnId || !filterOp) {
    return true
  }
  const cellStr = cellToString(cells[filterColumnId])
  const fv = String(filterValue ?? '').trim()
  if (filterOp === '=') {
    return cellStr === fv
  }
  if (filterOp === '!=') {
    return cellStr !== fv
  }
  return true
}

function rowMatchesCustomer(cells, matchRules, customerRow) {
  for (const rule of matchRules) {
    const colId = String(rule.columnId ?? '').trim()
    const dbField = String(rule.dbField ?? '').trim()
    if (!colId || !ALLOWED_MATCH_DB_FIELDS.has(dbField)) {
      return false
    }
    const a = getExcelCellNormalized(cells, colId, dbField)
    const b = getCustomerNormalizedField(customerRow, dbField)
    if (a === '' || b === '' || a !== b) {
      return false
    }
  }
  return matchRules.length > 0
}

function mapSettingsRow(row) {
  const sampleColumns = parseJsonArray(row.sample_columns, [])
  const matchRules = parseJsonArray(row.match_rules, [])
  const displayColumnIds = parseJsonArray(row.display_column_ids, [])
  return {
    gaId: Number(row.ga_id),
    featureEnabled: Boolean(row.feature_enabled),
    configReady: Boolean(row.config_ready),
    sampleOriginalFilename: row.sample_original_filename != null ? String(row.sample_original_filename) : '',
    sampleUploadedAt: row.sample_uploaded_at,
    sampleColumns,
    matchRules,
    displayColumnIds,
    filter:
      row.filter_column_id != null && String(row.filter_column_id).trim()
        ? {
            columnId: String(row.filter_column_id).trim(),
            op: String(row.filter_op ?? '=').trim(),
            value: String(row.filter_value ?? ''),
          }
        : null,
    updatedAt: row.updated_at,
    settingsVersion: Number(row.settings_version ?? 1),
    matchRuleCount: matchRules.length,
    displayColumnCount: displayColumnIds.length,
    hasFilter: Boolean(row.filter_column_id && String(row.filter_column_id).trim()),
  }
}

async function ensureSettingsRow(client, gaId) {
  await safeQuery(
    client,
    `
    INSERT INTO ga_customer_excel_settings (ga_id)
    VALUES ($1)
    ON CONFLICT (ga_id) DO NOTHING
    `,
    [gaId],
  )
}

async function loadSettingsOrDefault(pool, gaId) {
  const r = await safeQuery(
    pool,
    `SELECT * FROM ga_customer_excel_settings WHERE ga_id = $1 LIMIT 1`,
    [gaId],
  )
  if (r.rowCount === 0) {
    return {
      gaId,
      featureEnabled: false,
      configReady: false,
      sampleOriginalFilename: '',
      sampleUploadedAt: null,
      sampleColumns: [],
      matchRules: [],
      displayColumnIds: [],
      filter: null,
      updatedAt: null,
      settingsVersion: 0,
      matchRuleCount: 0,
      displayColumnCount: 0,
      hasFilter: false,
    }
  }
  return mapSettingsRow(r.rows[0])
}

function computeConfigReady(sampleColumns, matchRules, displayColumnIds) {
  const colIds = columnIdSet(sampleColumns)
  if (sampleColumns.length === 0) {
    return false
  }
  if (!Array.isArray(matchRules) || matchRules.length === 0) {
    return false
  }
  for (const m of matchRules) {
    const cid = String(m.columnId ?? '').trim()
    const db = String(m.dbField ?? '').trim()
    if (!cid || !colIds.has(cid) || !ALLOWED_MATCH_DB_FIELDS.has(db)) {
      return false
    }
  }
  for (const did of displayColumnIds) {
    if (!colIds.has(String(did))) {
      return false
    }
  }
  return true
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 */
export function registerGaCustomerExcelApi(apiRouter, ctx) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError, parseGaId, requireInsuranceFormUserId } = ctx

  /** 슈퍼 관리자: 설정 조회 */
  apiRouter.get('/admin/ga/:gaId/customer-excel/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const gaId = parseGaIdParam(req.params.gaId)
      if (gaId == null) {
        res.status(400).json({ message: '잘못된 GA ID입니다.' })
        return
      }
      const g = await safeQuery(pool, `SELECT id FROM ga_companies WHERE id = $1 AND is_deleted = false LIMIT 1`, [
        gaId,
      ])
      if (g.rowCount === 0) {
        res.status(404).json({ message: 'GA를 찾을 수 없습니다.' })
        return
      }
      const settings = await loadSettingsOrDefault(pool, gaId)
      res.json(settings)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  /** 슈퍼 관리자: 샘플 엑셀 업로드 → 컬럼 분석만 반영 (저장 확정은 PUT) */
  apiRouter.post(
    '/admin/ga/:gaId/customer-excel/sample',
    requireAuth,
    requireSuperAdmin,
    uploadExcel.single('file'),
    async (req, res) => {
      try {
        const gaId = parseGaIdParam(req.params.gaId)
        if (gaId == null) {
          res.status(400).json({ message: '잘못된 GA ID입니다.' })
          return
        }
        const g = await safeQuery(pool, `SELECT id FROM ga_companies WHERE id = $1 AND is_deleted = false LIMIT 1`, [
          gaId,
        ])
        if (g.rowCount === 0) {
          res.status(404).json({ message: 'GA를 찾을 수 없습니다.' })
          return
        }
        const file = req.file
        if (!file?.buffer) {
          res.status(400).json({ message: '엑셀 파일을 선택해 주세요.' })
          return
        }
        const orig = String(file.originalname ?? 'sample.xlsx')
        const lower = orig.toLowerCase()
        if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
          res.status(400).json({ message: 'xlsx 또는 xls 파일만 업로드할 수 있습니다.' })
          return
        }
        let columns
        try {
          ;({ columns } = parseExcelSampleToColumnsAndRows(file.buffer))
        } catch (err) {
          const code = err instanceof Error ? err.message : 'PARSE_ERROR'
          res.status(400).json({ message: '엑셀을 읽을 수 없습니다.', code })
          return
        }
        if (columns.length === 0) {
          res.status(400).json({ message: '헤더 행을 찾을 수 없습니다.' })
          return
        }

        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await ensureSettingsRow(client, gaId)
          await safeQuery(
            client,
            `
            UPDATE ga_customer_excel_settings
            SET sample_original_filename = $2,
                sample_uploaded_at = NOW(),
                sample_columns = CAST($3 AS jsonb)::jsonb,
                config_ready = false,
                updated_at = NOW()
            WHERE ga_id = $1
            `,
            [gaId, orig, JSON.stringify(columns)],
          )
          await client.query('COMMIT')
        } catch (e) {
          try {
            await client.query('ROLLBACK')
          } catch {
            /* ignore */
          }
          throw e
        } finally {
          client.release()
        }

        const settings = await loadSettingsOrDefault(pool, gaId)
        res.json({ ok: true, sampleColumns: columns, settings })
      } catch (e) {
        handleDbError(e, req, res)
      }
    },
  )

  /** 슈퍼 관리자: ON/OFF·매핑·표시·필터 저장 */
  apiRouter.put('/admin/ga/:gaId/customer-excel/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const gaId = parseGaIdParam(req.params.gaId)
      if (gaId == null) {
        res.status(400).json({ message: '잘못된 GA ID입니다.' })
        return
      }
      const g = await safeQuery(pool, `SELECT id FROM ga_companies WHERE id = $1 AND is_deleted = false LIMIT 1`, [
        gaId,
      ])
      if (g.rowCount === 0) {
        res.status(404).json({ message: 'GA를 찾을 수 없습니다.' })
        return
      }

      const body = req.body ?? {}
      const featureEnabled = Boolean(body.featureEnabled ?? body.feature_enabled)
      const matchRules = Array.isArray(body.matchRules) ? body.matchRules : []
      const displayColumnIds = Array.isArray(body.displayColumnIds) ? body.displayColumnIds : []
      const filterRaw = body.filter ?? null

      const client = await pool.connect()
      try {
        await ensureSettingsRow(client, gaId)
        const cur = await safeQuery(client, `SELECT * FROM ga_customer_excel_settings WHERE ga_id = $1`, [gaId])
        const row = cur.rows[0]
        const sampleColumns = parseJsonArray(row.sample_columns, [])

        if (sampleColumns.length === 0 && (featureEnabled || matchRules.length > 0 || displayColumnIds.length > 0)) {
          res.status(400).json({ message: '먼저 샘플 엑셀을 업로드해 주세요.' })
          return
        }

        const colIds = columnIdSet(sampleColumns)
        const cleanedMatch = []
        for (const m of matchRules) {
          const columnId = String(m.columnId ?? m.excelColumnId ?? '').trim()
          const dbField = String(m.dbField ?? '').trim()
          if (!columnId || !dbField) {
            continue
          }
          if (sampleColumns.length > 0 && (!colIds.has(columnId) || !ALLOWED_MATCH_DB_FIELDS.has(dbField))) {
            res.status(400).json({ message: '조회 기준 컬럼 매핑이 올바르지 않습니다.' })
            return
          }
          cleanedMatch.push({ columnId, dbField })
        }

        if (featureEnabled && cleanedMatch.length === 0) {
          res.status(400).json({ message: '조회 기준 컬럼을 최소 1개 이상 지정해야 합니다.' })
          return
        }

        const cleanedDisplay = []
        for (const id of displayColumnIds) {
          const cid = String(id ?? '').trim()
          if (!cid) {
            continue
          }
          if (sampleColumns.length > 0 && !colIds.has(cid)) {
            res.status(400).json({ message: '표시 컬럼 선택이 샘플 컬럼과 일치하지 않습니다.' })
            return
          }
          cleanedDisplay.push(cid)
        }

        let filterColumnId = null
        let filterOp = null
        let filterValue = null
        if (filterRaw && typeof filterRaw === 'object') {
          filterColumnId = String(filterRaw.columnId ?? '').trim() || null
          filterOp = String(filterRaw.op ?? '=').trim() || '='
          filterValue = filterRaw.value != null ? String(filterRaw.value) : ''
          if (filterColumnId) {
            if (sampleColumns.length > 0 && !colIds.has(filterColumnId)) {
              res.status(400).json({ message: '필터 컬럼이 샘플 컬럼에 없습니다.' })
              return
            }
            if (!ALLOWED_FILTER_OPS.has(filterOp)) {
              res.status(400).json({ message: '필터 연산자는 = 또는 != 만 지원합니다.' })
              return
            }
          } else {
            filterOp = null
            filterValue = null
          }
        }

        const configReady = computeConfigReady(sampleColumns, cleanedMatch, cleanedDisplay)

        await client.query('BEGIN')
        await safeQuery(
          client,
          `
          UPDATE ga_customer_excel_settings
          SET feature_enabled = $2,
              match_rules = CAST($3 AS jsonb)::jsonb,
              display_column_ids = CAST($4 AS jsonb)::jsonb,
              filter_column_id = $5,
              filter_op = $6,
              filter_value = $7,
              config_ready = $8,
              settings_version = settings_version + 1,
              updated_at = NOW()
          WHERE ga_id = $1
          `,
          [
            gaId,
            featureEnabled,
            JSON.stringify(cleanedMatch),
            JSON.stringify(cleanedDisplay),
            filterColumnId,
            filterOp,
            filterValue,
            configReady,
          ],
        )
        await client.query('COMMIT')
        const settings = await loadSettingsOrDefault(pool, gaId)
        res.json({ ok: true, settings })
      } catch (e) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* ignore */
        }
        throw e
      } finally {
        client.release()
      }
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  /** 설계사: 기능 노출 여부 (프론트는 이 값만 신뢰) */
  apiRouter.get('/ga-customer-excel/capability', requireAuth, async (req, res) => {
    try {
      const gaId = parseGaId(req.user?.gaId)
      if (gaId == null) {
        res.json({
          gaId: null,
          featureEnabled: false,
          configReady: false,
          showDesignerUi: false,
          message: 'GA 컨텍스트가 없습니다.',
        })
        return
      }
      const settings = await loadSettingsOrDefault(pool, gaId)
      const showDesignerUi = Boolean(settings.featureEnabled && settings.configReady)
      let message = ''
      if (!settings.featureEnabled) {
        message = ''
      } else if (!settings.configReady) {
        message = '이 GA는 고객 엑셀 설정이 아직 완료되지 않았습니다'
      }
      res.json({
        gaId,
        featureEnabled: settings.featureEnabled,
        configReady: settings.configReady,
        showDesignerUi,
        message,
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  /** 설계사: 운영 엑셀 업로드 (GA 단위, 기존 업로드 행 교체) */
  apiRouter.post('/ga-customer-excel/upload', requireAuth, uploadExcel.single('file'), async (req, res) => {
    const client = await pool.connect()
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
      const role = String(req.user?.role ?? '')
      if (role === 'SUPER_ADMIN' || role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER') {
        res.status(403).json({ message: '이 기능은 GA 설계사 계정에서만 사용할 수 있습니다.' })
        return
      }

      const settings = await loadSettingsOrDefault(pool, gaId)
      if (!settings.featureEnabled || !settings.configReady) {
        res.status(403).json({ message: '고객 엑셀 기능이 비활성이거나 설정이 완료되지 않았습니다.' })
        return
      }

      const file = req.file
      if (!file?.buffer) {
        res.status(400).json({ message: '엑셀 파일을 선택해 주세요.' })
        return
      }
      const orig = String(file.originalname ?? 'data.xlsx')
      let dataRows
      let parsedColumns
      try {
        const parsed = parseExcelSampleToColumnsAndRows(file.buffer)
        parsedColumns = parsed.columns
        dataRows = parsed.dataRows
      } catch (err) {
        const code = err instanceof Error ? err.message : 'PARSE_ERROR'
        res.status(400).json({ message: '엑셀을 읽을 수 없습니다.', code })
        return
      }

      const expectedIds = columnIdSet(settings.sampleColumns)
      const actualIds = new Set(parsedColumns.map((c) => c.id))
      if (expectedIds.size !== actualIds.size) {
        res.status(400).json({ message: '업로드 파일의 열 개수가 샘플 엑셀과 다릅니다.' })
        return
      }
      for (const id of expectedIds) {
        if (!actualIds.has(id)) {
          res.status(400).json({ message: '업로드 파일의 열 구조가 샘플 엑셀과 다릅니다.' })
          return
        }
      }

      await client.query('BEGIN')
      await safeQuery(client, `DELETE FROM ga_customer_excel_rows WHERE ga_id = $1`, [gaId])
      await safeQuery(client, `DELETE FROM ga_customer_excel_uploads WHERE ga_id = $1`, [gaId])

      const up = await safeQuery(
        client,
        `
        INSERT INTO ga_customer_excel_uploads (ga_id, uploaded_by_user_id, original_filename, row_count, settings_version_at_upload)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [gaId, userId, orig, dataRows.length, settings.settingsVersion],
      )
      const uploadId = Number(up.rows[0].id)

      for (const dr of dataRows) {
        await safeQuery(
          client,
          `
          INSERT INTO ga_customer_excel_rows (ga_id, upload_id, row_index, cells)
          VALUES ($1, $2, $3, CAST($4 AS jsonb)::jsonb)
          `,
          [gaId, uploadId, dr.rowIndex, JSON.stringify(dr.cells)],
        )
      }

      await client.query('COMMIT')
      res.json({ ok: true, uploadId, rowCount: dataRows.length, originalFilename: orig })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  /** 설계사: 고객 기준 GA 엑셀 데이터 (매칭·필터·표시 컬럼만 서버에서 적용) */
  apiRouter.get('/customers/:id/ga-excel-data', requireAuth, async (req, res) => {
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

      const settings = await loadSettingsOrDefault(pool, gaId)
      if (!settings.featureEnabled || !settings.configReady) {
        res.status(403).json({ message: '고객 엑셀 기능을 사용할 수 없습니다.' })
        return
      }

      const cust = await safeQuery(
        pool,
        `
        SELECT id, user_id, ga_id, name, ssn, birth_date
        FROM customers
        WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
        LIMIT 1
        `,
        [customerId, userId, gaId],
      )
      if (cust.rowCount === 0) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const customerRow = cust.rows[0]

      const up = await safeQuery(
        pool,
        `
        SELECT id FROM ga_customer_excel_uploads
        WHERE ga_id = $1
        ORDER BY uploaded_at DESC, id DESC
        LIMIT 1
        `,
        [gaId],
      )
      if (up.rowCount === 0) {
        res.json({
          displayHeaders: [],
          rows: [],
          message: '업로드된 GA 고객 엑셀 데이터가 없습니다.',
        })
        return
      }
      const uploadId = Number(up.rows[0].id)

      const rowsRes = await safeQuery(
        pool,
        `
        SELECT row_index, cells
        FROM ga_customer_excel_rows
        WHERE ga_id = $1 AND upload_id = $2
        ORDER BY row_index ASC, id ASC
        `,
        [gaId, uploadId],
      )

      const sampleColumns = settings.sampleColumns
      const headerById = new Map(sampleColumns.map((c) => [c.id, c.header]))
      const displayIds = settings.displayColumnIds
      const displayHeaders = displayIds.map((id) => headerById.get(String(id)) ?? String(id))

      const matchRules = settings.matchRules
      const fc = settings.filter?.columnId ?? null
      const fo = settings.filter?.op ?? '='
      const fv = settings.filter?.value ?? ''

      const outRows = []
      for (const r of rowsRes.rows) {
        const cells = typeof r.cells === 'object' && r.cells != null ? r.cells : {}
        if (!rowPassesFilter(cells, fc, fo, fv)) {
          continue
        }
        if (!rowMatchesCustomer(cells, matchRules, customerRow)) {
          continue
        }
        const displayCells = {}
        for (const colId of displayIds) {
          const key = String(colId)
          displayCells[key] = cellToString(cells[key])
        }
        outRows.push({ rowIndex: Number(r.row_index), cells: displayCells })
      }

      res.json({
        displayHeaders,
        displayColumnIds: displayIds,
        rows: outRows,
        message: '',
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
