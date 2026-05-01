import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { parseGaId } from '../lib/parseGaId.js'
import { isSuperAdminRole, normalizeRbacRole } from '../lib/rbacScope.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import { maskKrMobileForDisplay } from '../utils/maskKrMobile.js'
import { getContractOtpPepper, isRunningInProduction } from '../lib/contractOtpConfig.js'
import { encryptContractTargetPhoneDigits } from '../lib/contractStoredPhone.js'
import {
  assertSenderFieldValuesFilled,
  insertSenderPrefillDocumentValues,
  senderValuesByContractTemplates,
} from '../services/contractSenderPrefill.js'

const CT_PREFIX = 'ct_'
const PKG_PREFIX = 'pkg_'
const CSS_PREFIX = 'css_'
const CDI_PREFIX = 'cdi_'

const ALLOWED_TEMPLATE_STATUS = new Set(['draft', 'active', 'archived'])
const TERMINAL_SESSION = new Set(['expired', 'cancelled', 'completed'])

function newId(prefix) {
  return `${prefix}${randomUUID()}`
}

function hashPhoneDigits(digits) {
  const pepper = getContractOtpPepper()
  return createHash('sha256').update(`${digits}|${pepper}`, 'utf8').digest('hex')
}

export function getAuthUserId(req) {
  return String(req.user?.id ?? '').trim()
}

async function resolveEffectiveGaId(pool, req) {
  const role = normalizeRbacRole(req.user?.role)
  const userGa = parseGaId(req.user?.gaId)
  if (isSuperAdminRole(role)) {
    const qGa = parseGaId(
      req.query?.tenant_ga_id ?? req.query?.ga_id ?? req.body?.tenant_ga_id ?? req.body?.ga_id,
    )
    if (qGa != null) {
      const r = await pool.query(
        `SELECT 1 FROM ga_companies WHERE id = $1 AND is_deleted = false LIMIT 1`,
        [qGa],
      )
      if (r.rowCount > 0) {
        return qGa
      }
    }
    return userGa
  }
  return userGa
}

export async function assertCustomerForSend(client, customerId, req) {
  const role = normalizeRbacRole(req.user?.role)
  const userGa = parseGaId(req.user?.gaId)
  const uid = getAuthUserId(req)
  const params = [customerId]
  let sql = `
    SELECT id, phone, ga_id, user_id
    FROM customers
    WHERE id = $1 AND deleted_at IS NULL
  `
  if (!isSuperAdminRole(role)) {
    if (userGa == null) {
      return { error: 'GA 컨텍스트가 없습니다.', status: 400 }
    }
    params.push(userGa)
    sql += ` AND ga_id = $2`
    if (role === 'USER') {
      params.push(uid)
      sql += ` AND user_id = $3`
    }
  }
  const r = await client.query(sql, params)
  if (r.rowCount === 0) {
    return { error: '고객을 찾을 수 없습니다.', status: 404 }
  }
  const row = r.rows[0]
  const digits = normalizeKrMobile(row.phone)
  const v = validateKrMobileDigits(digits)
  if (v) {
    return { error: '고객 휴대폰 번호가 없거나 형식이 올바르지 않습니다.', status: 400 }
  }
  return { row, digits }
}

async function loadPdfTemplateRow(client, pdfTemplateId) {
  const id = Number(pdfTemplateId)
  if (!Number.isInteger(id) || id < 1) {
    return null
  }
  const r = await client.query(
    `
    SELECT id, title, storage_key, page_count, is_active, ga_id
    FROM pdf_templates
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  )
  return r.rows[0] ?? null
}

function pdfTemplateGaOk(pdfRow, effectiveGaId) {
  if (pdfRow.ga_id == null) {
    return true
  }
  if (effectiveGaId == null) {
    return false
  }
  return Number(pdfRow.ga_id) === Number(effectiveGaId)
}

async function countPdfEngineFields(client, pdfTemplateId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM pdf_template_fields WHERE template_id = $1`,
    [pdfTemplateId],
  )
  return Number(r.rows[0]?.c ?? 0)
}

export async function assertContractTemplateAccess(client, templateId, effectiveGaId, isSuper) {
  const r = await client.query(
    `SELECT * FROM contract_templates WHERE id = $1 LIMIT 1`,
    [templateId],
  )
  const row = r.rows[0]
  if (!row) {
    return { error: '템플릿을 찾을 수 없습니다.', status: 404 }
  }
  if (!isSuper) {
    if (row.ga_id == null) {
      return { error: '템플릿에 접근할 수 없습니다.', status: 403 }
    }
    if (effectiveGaId == null) {
      return { error: 'GA 컨텍스트가 없습니다.', status: 400 }
    }
    if (Number(row.ga_id) !== Number(effectiveGaId)) {
      return { error: '템플릿에 접근할 수 없습니다.', status: 403 }
    }
  }
  return { row }
}

async function assertPackageAccess(client, packageId, effectiveGaId, isSuper) {
  const r = await client.query(`SELECT * FROM contract_packages WHERE id = $1 LIMIT 1`, [packageId])
  const row = r.rows[0]
  if (!row) {
    return { error: '패키지를 찾을 수 없습니다.', status: 404 }
  }
  if (!isSuper) {
    if (row.ga_id == null) {
      return { error: '패키지에 접근할 수 없습니다.', status: 403 }
    }
    if (effectiveGaId == null) {
      return { error: 'GA 컨텍스트가 없습니다.', status: 400 }
    }
    if (Number(row.ga_id) !== Number(effectiveGaId)) {
      return { error: '패키지에 접근할 수 없습니다.', status: 403 }
    }
  }
  return { row }
}

export function buildTargetPhoneSnapshot(digits) {
  let encrypted = null
  try {
    encrypted = encryptContractTargetPhoneDigits(digits)
  } catch (e) {
    if (isRunningInProduction()) {
      throw e
    }
    encrypted = null
  }
  if (isRunningInProduction() && !encrypted) {
    throw new Error('[contract phone] CONTRACT_TARGET_PHONE_ENCRYPTION_KEY is not set')
  }
  return {
    target_phone_encrypted: encrypted,
    target_phone_hash: hashPhoneDigits(digits),
    target_phone_masked: maskKrMobileForDisplay(digits),
  }
}

export async function generateUniqueLinkCode(client) {
  for (let i = 0; i < 8; i += 1) {
    const code = randomBytes(32).toString('base64url')
    const ck = await client.query(
      `SELECT 1 FROM contract_send_sessions WHERE link_code = $1 LIMIT 1`,
      [code],
    )
    if (ck.rowCount === 0) {
      return code
    }
  }
  throw new Error('link_code_collision')
}

export function parseTemplateIdsArray(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'templateIds가 필요합니다.' }
  }
  const out = []
  const seen = new Set()
  for (const x of raw) {
    const id = typeof x === 'string' ? x.trim() : String(x ?? '').trim()
    if (!id.startsWith(CT_PREFIX) || id.length < CT_PREFIX.length + 4) {
      return { error: 'templateIds는 계약 템플릿 id 문자열 배열이어야 합니다.' }
    }
    if (seen.has(id)) {
      return { error: 'templateIds에 중복이 있습니다.' }
    }
    seen.add(id)
    out.push(id)
  }
  return { ids: out }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   forbidInsurerManagerApi: import('express').RequestHandler,
 *   requireContractAdminConsole: import('express').RequestHandler,
 *   handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void,
 * }} ctx
 */
export function registerContractAdminApi(apiRouter, ctx) {
  const { pool, requireAuth, forbidInsurerManagerApi, requireContractAdminConsole, handleDbError } = ctx

  const chain = [requireAuth, forbidInsurerManagerApi, requireContractAdminConsole]

  apiRouter.get('/admin/contracts/templates', ...chain, async (req, res) => {
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const status = String(req.query?.status ?? '').trim()
      const category = String(req.query?.category ?? '').trim()
      const params = /** @type {unknown[]} */ ([])
      let where = 'WHERE 1=1'
      if (!(isSuper && effectiveGa == null)) {
        if (effectiveGa == null) {
          res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
          return
        }
        params.push(effectiveGa)
        where += ` AND t.ga_id = $${params.length}`
      }
      if (status && ALLOWED_TEMPLATE_STATUS.has(status)) {
        params.push(status)
        where += ` AND t.status = $${params.length}`
      }
      if (category) {
        params.push(category)
        where += ` AND t.category = $${params.length}`
      }
      const r = await pool.query(
        `
        SELECT t.*, p.title AS pdf_engine_title, p.storage_key AS pdf_engine_storage_key
        FROM contract_templates t
        LEFT JOIN pdf_templates p ON p.id = t.pdf_template_id
        ${where}
        ORDER BY t.updated_at DESC
        LIMIT 500
        `,
        params,
      )
      res.json({
        ok: true,
        templates: r.rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          status: row.status,
          version: row.version,
          pdfTemplateId: row.pdf_template_id,
          pdfEngineTitle: row.pdf_engine_title,
          pageCount: row.page_count,
          gaId: row.ga_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/contracts/templates/:id', ...chain, async (req, res) => {
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const { row, error, status } = await assertContractTemplateAccess(
        pool,
        req.params.id,
        effectiveGa,
        isSuper,
      )
      if (error) {
        res.status(status ?? 400).json({ ok: false, message: error })
        return
      }
      const fieldsR = await pool.query(
        `SELECT COUNT(*)::int AS c FROM contract_template_fields WHERE template_id = $1`,
        [row.id],
      )
      const pdfR = row.pdf_template_id
        ? await pool.query(
            `SELECT id, title, storage_key, page_count, is_active FROM pdf_templates WHERE id = $1 LIMIT 1`,
            [row.pdf_template_id],
          )
        : { rows: [] }
      const pr = pdfR.rows[0]
      res.json({
        ok: true,
        template: {
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          status: row.status,
          version: row.version,
          pdfTemplateId: row.pdf_template_id,
          pdfFileId: row.pdf_file_id,
          pdfFilePath: row.pdf_file_path,
          pdfHash: row.pdf_hash,
          pageCount: row.page_count,
          gaId: row.ga_id,
          contractTemplateFieldsCount: fieldsR.rows[0]?.c ?? 0,
          pdfEngine: pr
            ? {
                id: pr.id,
                title: pr.title,
                storageKey: pr.storage_key,
                pageCount: pr.page_count,
                isActive: pr.is_active,
              }
            : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/contracts/templates', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      if (effectiveGa == null) {
        res.status(400).json({ ok: false, message: 'GA가 필요합니다. tenant_ga_id(슈퍼관리자) 또는 소속 GA를 확인하세요.' })
        return
      }
      const title = String(req.body?.title ?? '').trim()
      if (!title) {
        res.status(400).json({ ok: false, message: 'title은 필수입니다.' })
        return
      }
      const pdfTemplateIdRaw = req.body?.pdfTemplateId ?? req.body?.pdf_template_id
      const pdfTemplateId =
        pdfTemplateIdRaw === undefined || pdfTemplateIdRaw === null || pdfTemplateIdRaw === ''
          ? null
          : Number(pdfTemplateIdRaw)
      if (pdfTemplateId != null && (!Number.isInteger(pdfTemplateId) || pdfTemplateId < 1)) {
        res.status(400).json({ ok: false, message: 'pdfTemplateId가 올바르지 않습니다.' })
        return
      }
      let pdfRow = null
      if (pdfTemplateId != null) {
        pdfRow = await loadPdfTemplateRow(client, pdfTemplateId)
        if (!pdfRow) {
          res.status(400).json({ ok: false, message: 'pdfTemplateId에 해당하는 PDF 템플릿이 없습니다.' })
          return
        }
        if (!pdfRow.is_active) {
          res.status(400).json({ ok: false, message: '비활성 PDF 템플릿은 연결할 수 없습니다.' })
          return
        }
        if (!pdfTemplateGaOk(pdfRow, effectiveGa)) {
          res.status(403).json({ ok: false, message: '해당 GA에서 사용할 수 없는 PDF 템플릿입니다.' })
          return
        }
      }
      const statusRaw = String(req.body?.status ?? 'draft').trim() || 'draft'
      if (!ALLOWED_TEMPLATE_STATUS.has(statusRaw)) {
        res.status(400).json({ ok: false, message: 'status 값이 올바르지 않습니다.' })
        return
      }
      const id = newId(CT_PREFIX)
      const uid = getAuthUserId(req)
      const description = req.body?.description != null ? String(req.body.description) : null
      const category = req.body?.category != null ? String(req.body.category).trim() : null

      await client.query(
        `
        INSERT INTO contract_templates (
          id, title, description, category, pdf_template_id, pdf_file_path, page_count,
          status, version, created_by_user_id, ga_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, NOW(), NOW())
        `,
        [
          id,
          title,
          description,
          category,
          pdfTemplateId,
          pdfRow ? String(pdfRow.storage_key) : null,
          pdfRow ? pdfRow.page_count : null,
          statusRaw,
          uid || null,
          effectiveGa,
        ],
      )
      res.status(201).json({ ok: true, success: true, data: { id } })
    } catch (e) {
      if (e instanceof Error && e.message.includes('CONTRACT_OTP_PEPPER')) {
        res.status(500).json({ ok: false, message: '서버 설정 오류(CONTRACT_OTP_PEPPER)입니다.' })
        return
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch('/admin/contracts/templates/:id', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const acc = await assertContractTemplateAccess(client, req.params.id, effectiveGa, isSuper)
      if (acc.error) {
        res.status(acc.status ?? 400).json({ ok: false, message: acc.error })
        return
      }
      const row = acc.row
      const sets = /** @type {string[]} */ ([])
      const params = /** @type {unknown[]} */ ([])

      if (req.body?.title != null) {
        const t = String(req.body.title).trim()
        if (!t) {
          res.status(400).json({ ok: false, message: 'title이 비어 있습니다.' })
          return
        }
        params.push(t)
        sets.push(`title = $${params.length}`)
      }
      if (req.body?.description !== undefined) {
        params.push(req.body.description == null ? null : String(req.body.description))
        sets.push(`description = $${params.length}`)
      }
      if (req.body?.category !== undefined) {
        params.push(req.body.category == null ? null : String(req.body.category).trim())
        sets.push(`category = $${params.length}`)
      }
      if (req.body?.pdfTemplateId !== undefined || req.body?.pdf_template_id !== undefined) {
        const raw = req.body?.pdfTemplateId ?? req.body?.pdf_template_id
        if (raw === null || raw === '') {
          params.push(null)
          const i1 = params.length
          sets.push(`pdf_template_id = $${i1}`)
          params.push(null)
          const i2 = params.length
          sets.push(`pdf_file_path = $${i2}`)
          params.push(null)
          const i3 = params.length
          sets.push(`page_count = $${i3}`)
        } else {
          const pid = Number(raw)
          if (!Number.isInteger(pid) || pid < 1) {
            res.status(400).json({ ok: false, message: 'pdfTemplateId가 올바르지 않습니다.' })
            return
          }
          const pdfRow = await loadPdfTemplateRow(client, pid)
          if (!pdfRow) {
            res.status(400).json({ ok: false, message: 'pdfTemplateId에 해당하는 PDF 템플릿이 없습니다.' })
            return
          }
          if (!pdfRow.is_active) {
            res.status(400).json({ ok: false, message: '비활성 PDF 템플릿은 연결할 수 없습니다.' })
            return
          }
          if (!pdfTemplateGaOk(pdfRow, row.ga_id != null ? Number(row.ga_id) : effectiveGa)) {
            res.status(403).json({ ok: false, message: '해당 GA에서 사용할 수 없는 PDF 템플릿입니다.' })
            return
          }
          params.push(pid)
          sets.push(`pdf_template_id = $${params.length}`)
          params.push(String(pdfRow.storage_key))
          sets.push(`pdf_file_path = $${params.length}`)
          params.push(pdfRow.page_count)
          sets.push(`page_count = $${params.length}`)
        }
      }
      if (sets.length === 0) {
        res.status(400).json({ ok: false, message: '변경할 필드가 없습니다.' })
        return
      }
      params.push(row.id)
      await client.query(
        `UPDATE contract_templates SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      )
      res.json({ ok: true, success: true })
    } catch (e) {
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch('/admin/contracts/templates/:id/status', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const acc = await assertContractTemplateAccess(client, req.params.id, effectiveGa, isSuper)
      if (acc.error) {
        res.status(acc.status ?? 400).json({ ok: false, message: acc.error })
        return
      }
      const row = acc.row
      const status = String(req.body?.status ?? '').trim()
      if (!ALLOWED_TEMPLATE_STATUS.has(status)) {
        res.status(400).json({ ok: false, message: 'status 값이 올바르지 않습니다.' })
        return
      }
      if (status === 'active') {
        const pid = row.pdf_template_id
        if (pid == null) {
          res.status(400).json({ ok: false, message: 'active 전환에는 pdfTemplateId 연결이 필요합니다.' })
          return
        }
        const fc = await countPdfEngineFields(client, pid)
        if (fc < 1) {
          res.status(400).json({ ok: false, message: 'PDF 템플릿에 좌표 필드가 없어 active로 전환할 수 없습니다.' })
          return
        }
      }
      await client.query(`UPDATE contract_templates SET status = $2, updated_at = NOW() WHERE id = $1`, [
        row.id,
        status,
      ])
      res.json({ ok: true, success: true })
    } catch (e) {
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.get('/admin/contracts/packages', ...chain, async (req, res) => {
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const params = /** @type {unknown[]} */ ([])
      let where = 'WHERE 1=1'
      if (!(isSuper && effectiveGa == null)) {
        if (effectiveGa == null) {
          res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
          return
        }
        params.push(effectiveGa)
        where += ` AND ga_id = $${params.length}`
      }
      const st = String(req.query?.status ?? '').trim()
      if (st && ALLOWED_TEMPLATE_STATUS.has(st)) {
        params.push(st)
        where += ` AND status = $${params.length}`
      }
      const r = await pool.query(
        `SELECT * FROM contract_packages ${where} ORDER BY updated_at DESC LIMIT 300`,
        params,
      )
      res.json({ ok: true, packages: r.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        gaId: row.ga_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/contracts/packages/:id', ...chain, async (req, res) => {
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const acc = await assertPackageAccess(pool, req.params.id, effectiveGa, isSuper)
      if (acc.error) {
        res.status(acc.status ?? 400).json({ ok: false, message: acc.error })
        return
      }
      const pkg = acc.row
      const items = await pool.query(
        `
        SELECT i.*, t.title AS template_title, t.status AS template_status
        FROM contract_package_items i
        JOIN contract_templates t ON t.id = i.template_id
        WHERE i.package_id = $1
        ORDER BY i.sort_order ASC, i.created_at ASC
        `,
        [pkg.id],
      )
      res.json({
        ok: true,
        package: {
          id: pkg.id,
          title: pkg.title,
          description: pkg.description,
          status: pkg.status,
          gaId: pkg.ga_id,
          items: items.rows.map((it) => ({
            id: it.id,
            templateId: it.template_id,
            templateTitle: it.template_title,
            templateStatus: it.template_status,
            sortOrder: it.sort_order,
            required: it.required === 1 || it.required === true,
          })),
          createdAt: pkg.created_at,
          updatedAt: pkg.updated_at,
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/contracts/packages', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      if (effectiveGa == null) {
        res.status(400).json({ ok: false, message: 'GA가 필요합니다.' })
        return
      }
      const title = String(req.body?.title ?? '').trim()
      if (!title) {
        res.status(400).json({ ok: false, message: 'title은 필수입니다.' })
        return
      }
      const itemsRaw = req.body?.items
      if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
        res.status(400).json({ ok: false, message: 'items는 1개 이상이어야 합니다.' })
        return
      }
      const isSuper = isSuperAdminRole(req.user?.role)
      await client.query('BEGIN')
      const pkgId = newId(PKG_PREFIX)
      const uid = getAuthUserId(req)
      const description = req.body?.description != null ? String(req.body.description) : null
      const st = String(req.body?.status ?? 'draft').trim() || 'draft'
      if (!ALLOWED_TEMPLATE_STATUS.has(st)) {
        await client.query('ROLLBACK')
        res.status(400).json({ ok: false, message: 'status 값이 올바르지 않습니다.' })
        return
      }

      await client.query(
        `
        INSERT INTO contract_packages (id, title, description, status, ga_id, created_by_user_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `,
        [pkgId, title, description, st, effectiveGa, uid || null],
      )

      for (let idx = 0; idx < itemsRaw.length; idx += 1) {
        const it = itemsRaw[idx]
        const tid = typeof it?.templateId === 'string' ? it.templateId.trim() : String(it?.templateId ?? '').trim()
        if (!tid.startsWith(CT_PREFIX)) {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: 'items[].templateId가 올바르지 않습니다.' })
          return
        }
        const tacc = await assertContractTemplateAccess(client, tid, effectiveGa, isSuper)
        if (tacc.error) {
          await client.query('ROLLBACK')
          res.status(tacc.status ?? 400).json({ ok: false, message: tacc.error })
          return
        }
        const reqd = it?.required === false ? 0 : 1
        const itemId = newId('cpi_')
        await client.query(
          `
          INSERT INTO contract_package_items (id, package_id, template_id, sort_order, required, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          `,
          [itemId, pkgId, tid, idx, reqd],
        )
      }

      await client.query('COMMIT')
      res.status(201).json({ ok: true, success: true, data: { id: pkgId } })
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

  apiRouter.patch('/admin/contracts/packages/:id', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const acc = await assertPackageAccess(client, req.params.id, effectiveGa, isSuper)
      if (acc.error) {
        res.status(acc.status ?? 400).json({ ok: false, message: acc.error })
        return
      }
      const row = acc.row
      const sets = /** @type {string[]} */ ([])
      const params = /** @type {unknown[]} */ ([])

      if (req.body?.title != null) {
        const t = String(req.body.title).trim()
        if (!t) {
          res.status(400).json({ ok: false, message: 'title이 비어 있습니다.' })
          return
        }
        params.push(t)
        sets.push(`title = $${params.length}`)
      }
      if (req.body?.description !== undefined) {
        params.push(req.body.description == null ? null : String(req.body.description))
        sets.push(`description = $${params.length}`)
      }

      if (Array.isArray(req.body?.items)) {
        await client.query('BEGIN')
        if (req.body.items.length === 0) {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: 'items는 1개 이상이어야 합니다.' })
          return
        }
        await client.query(`DELETE FROM contract_package_items WHERE package_id = $1`, [row.id])
        for (let idx = 0; idx < req.body.items.length; idx += 1) {
          const it = req.body.items[idx]
          const tid = typeof it?.templateId === 'string' ? it.templateId.trim() : String(it?.templateId ?? '').trim()
          if (!tid.startsWith(CT_PREFIX)) {
            await client.query('ROLLBACK')
            res.status(400).json({ ok: false, message: 'items[].templateId가 올바르지 않습니다.' })
            return
          }
          const tacc = await assertContractTemplateAccess(client, tid, effectiveGa, isSuper)
          if (tacc.error) {
            await client.query('ROLLBACK')
            res.status(tacc.status ?? 400).json({ ok: false, message: tacc.error })
            return
          }
          const reqd = it?.required === false ? 0 : 1
          const itemId = newId('cpi_')
          await client.query(
            `
            INSERT INTO contract_package_items (id, package_id, template_id, sort_order, required, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            `,
            [itemId, row.id, tid, idx, reqd],
          )
        }
        await client.query('COMMIT')
      }

      if (sets.length > 0) {
        params.push(row.id)
        await client.query(
          `UPDATE contract_packages SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
          params,
        )
      }

      res.json({ ok: true, success: true })
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

  apiRouter.patch('/admin/contracts/packages/:id/status', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const acc = await assertPackageAccess(client, req.params.id, effectiveGa, isSuper)
      if (acc.error) {
        res.status(acc.status ?? 400).json({ ok: false, message: acc.error })
        return
      }
      const row = acc.row
      const status = String(req.body?.status ?? '').trim()
      if (!ALLOWED_TEMPLATE_STATUS.has(status)) {
        res.status(400).json({ ok: false, message: 'status 값이 올바르지 않습니다.' })
        return
      }
      if (status === 'active') {
        const items = await client.query(
          `
          SELECT t.status AS template_status
          FROM contract_package_items i
          JOIN contract_templates t ON t.id = i.template_id
          WHERE i.package_id = $1
          `,
          [row.id],
        )
        if (items.rowCount === 0) {
          res.status(400).json({ ok: false, message: '패키지에 템플릿이 없습니다.' })
          return
        }
        const bad = items.rows.some((x) => String(x.template_status) !== 'active')
        if (bad) {
          res.status(400).json({ ok: false, message: '포함 템플릿이 모두 active일 때만 패키지를 active로 전환할 수 있습니다.' })
          return
        }
      }
      await client.query(`UPDATE contract_packages SET status = $2, updated_at = NOW() WHERE id = $1`, [row.id, status])
      res.json({ ok: true, success: true })
    } catch (e) {
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/admin/contracts/send-sessions', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const customerId = Number(req.body?.customerId ?? req.body?.customer_id)
      if (!Number.isInteger(customerId) || customerId < 1) {
        res.status(400).json({ ok: false, message: 'customerId가 올바르지 않습니다.' })
        return
      }
      const pPkg = req.body?.packageId ?? req.body?.package_id
      const tplIdsRaw = req.body?.templateIds ?? req.body?.template_ids
      const hasPkg = pPkg !== undefined && pPkg !== null && String(pPkg).trim() !== ''
      const hasTpl = tplIdsRaw !== undefined && tplIdsRaw !== null
      if (hasPkg && hasTpl) {
        res.status(400).json({ ok: false, message: 'packageId와 templateIds는 동시에 보낼 수 없습니다.' })
        return
      }
      if (!hasPkg && !hasTpl) {
        res.status(400).json({ ok: false, message: 'packageId 또는 templateIds 중 하나는 필수입니다.' })
        return
      }

      const cust = await assertCustomerForSend(client, customerId, req)
      if (cust.error) {
        res.status(cust.status ?? 400).json({ ok: false, message: cust.error })
        return
      }
      const snapshot = buildTargetPhoneSnapshot(cust.digits)

      let contractTemplatesOrdered = /** @type {{ id: string, title: string, version: number, required: number, pdfHash: string | null, pdfTemplateId: number | null }[]} */ ([])

      await client.query('BEGIN')

      if (hasPkg) {
        const pid = String(pPkg).trim()
        if (!pid.startsWith(PKG_PREFIX)) {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: 'packageId 형식이 올바르지 않습니다.' })
          return
        }
        const pacc = await assertPackageAccess(client, pid, effectiveGa, isSuper)
        if (pacc.error) {
          await client.query('ROLLBACK')
          res.status(pacc.status ?? 400).json({ ok: false, message: pacc.error })
          return
        }
        const pkg = pacc.row
        if (String(pkg.status) !== 'active') {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: 'active 패키지만 발송할 수 있습니다.' })
          return
        }
        const items = await client.query(
          `
          SELECT i.template_id, i.sort_order, i.required, t.id, t.title, t.status, t.version, t.pdf_template_id
          FROM contract_package_items i
          JOIN contract_templates t ON t.id = i.template_id
          WHERE i.package_id = $1
          ORDER BY i.sort_order ASC, i.created_at ASC
          `,
          [pkg.id],
        )
        if (items.rowCount === 0) {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: '패키지에 템플릿이 없습니다.' })
          return
        }
        const inactive = items.rows.filter((x) => String(x.status) !== 'active')
        if (inactive.length > 0) {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: '포함 템플릿이 모두 active일 때만 발송할 수 있습니다.' })
          return
        }
        contractTemplatesOrdered = items.rows.map((x) => ({
          id: x.id,
          title: x.title,
          version: x.version,
          required: x.required === 1 || x.required === true ? 1 : 0,
          pdfHash: x.pdf_template_id
            ? createHash('sha256')
                .update(`pdf_tmpl:${x.pdf_template_id}`, 'utf8')
                .digest('hex')
            : null,
          pdfTemplateId: x.pdf_template_id,
        }))
      }

      if (hasTpl) {
        const parsed = parseTemplateIdsArray(tplIdsRaw)
        if (parsed.error) {
          await client.query('ROLLBACK')
          res.status(400).json({ ok: false, message: parsed.error })
          return
        }
        contractTemplatesOrdered = []
        for (const tid of parsed.ids) {
          const tacc = await assertContractTemplateAccess(client, tid, effectiveGa, isSuper)
          if (tacc.error) {
            await client.query('ROLLBACK')
            res.status(tacc.status ?? 400).json({ ok: false, message: tacc.error })
            return
          }
          const t = tacc.row
          if (String(t.status) !== 'active') {
            await client.query('ROLLBACK')
            res.status(400).json({ ok: false, message: `템플릿 ${tid}은(는) active 상태가 아닙니다.` })
            return
          }
          contractTemplatesOrdered.push({
            id: t.id,
            title: t.title,
            version: t.version,
            required: 1,
            pdfHash: t.pdf_template_id
              ? createHash('sha256')
                  .update(`pdf_tmpl:${t.pdf_template_id}`, 'utf8')
                  .digest('hex')
              : null,
            pdfTemplateId: t.pdf_template_id,
          })
        }
      }

      const senderRoot = req.body?.senderFieldValues ?? req.body?.sender_field_values
      const senderMaps = senderValuesByContractTemplates(
        senderRoot,
        contractTemplatesOrdered.map((x) => String(x.id)),
      )
      for (const ct of contractTemplatesOrdered) {
        if (ct.pdfTemplateId == null) {
          await client.query('ROLLBACK')
          res.status(400).json({
            ok: false,
            message: 'PDF 엔진이 연결된 계약 템플릿만 전자서명 발송할 수 있습니다.',
          })
          return
        }
        const senderCheck = await assertSenderFieldValuesFilled(
          client,
          Number(ct.pdfTemplateId),
          senderMaps.get(String(ct.id)) ?? {},
        )
        if (!senderCheck.ok) {
          await client.query('ROLLBACK')
          res.status(senderCheck.status ?? 400).json({
            ok: false,
            message: senderCheck.message ?? '발송 전 입력이 올바르지 않습니다.',
          })
          return
        }
      }

      const sendId = newId(CSS_PREFIX)
      const linkCode = await generateUniqueLinkCode(client)
      const uid = getAuthUserId(req)
      const nowSql = `NOW()`

      await client.query(
        `
        INSERT INTO contract_send_sessions (
          id, package_id, customer_id, link_code, status,
          target_phone_encrypted, target_phone_hash, target_phone_masked,
          sent_by_user_id, sent_at, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, 'pending',
          $5, $6, $7,
          $8, ${nowSql}, ${nowSql}, ${nowSql}
        )
        `,
        [
          sendId,
          hasPkg ? String(pPkg).trim() : null,
          customerId,
          linkCode,
          snapshot.target_phone_encrypted,
          snapshot.target_phone_hash,
          snapshot.target_phone_masked,
          uid || null,
        ],
      )

      for (let i = 0; i < contractTemplatesOrdered.length; i += 1) {
        const ct = contractTemplatesOrdered[i]
        const docId = newId(CDI_PREFIX)
        await client.query(
          `
          INSERT INTO contract_document_instances (
            id, send_session_id, template_id, template_version, title_snapshot,
            required, sort_order, status, original_pdf_hash, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW(), NOW())
          `,
          [docId, sendId, ct.id, ct.version, ct.title, ct.required, i, ct.pdfHash],
        )
        const pdfTm = ct.pdfTemplateId != null ? Number(ct.pdfTemplateId) : NaN
        if (Number.isFinite(pdfTm)) {
          await insertSenderPrefillDocumentValues(
            client,
            docId,
            pdfTm,
            senderMaps.get(String(ct.id)) ?? {},
          )
        }
      }

      await client.query('COMMIT')
      res.status(201).json({
        ok: true,
        sendSession: {
          id: sendId,
          linkCode,
          customerId,
          status: 'pending',
          maskedPhone: snapshot.target_phone_masked,
          documentCount: contractTemplatesOrdered.length,
          createdAt: new Date().toISOString(),
        },
      })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      if (e instanceof Error && e.message.includes('CONTRACT_OTP_PEPPER')) {
        res.status(500).json({ ok: false, message: '서버 설정 오류입니다.' })
        return
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.get('/admin/contracts/send-sessions', ...chain, async (req, res) => {
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const params = /** @type {unknown[]} */ ([])
      let where = `
        FROM contract_send_sessions s
        JOIN customers c ON c.id = s.customer_id
        WHERE 1=1
      `
      if (!isSuper) {
        if (effectiveGa == null) {
          res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
          return
        }
        params.push(effectiveGa)
        where += ` AND c.ga_id = $${params.length}`
        if (normalizeRbacRole(req.user?.role) === 'USER') {
          params.push(getAuthUserId(req))
          where += ` AND c.user_id = $${params.length}`
        }
      }
      const r = await pool.query(
        `
        SELECT s.id, s.link_code, s.customer_id, s.status, s.target_phone_masked, s.sent_at, s.created_at, s.package_id
        ${where}
        ORDER BY s.created_at DESC
        LIMIT 200
        `,
        params,
      )
      res.json({
        ok: true,
        sendSessions: r.rows.map((row) => ({
          id: row.id,
          linkCode: row.link_code,
          customerId: row.customer_id,
          status: row.status,
          maskedPhone: row.target_phone_masked,
          packageId: row.package_id,
          sentAt: row.sent_at,
          createdAt: row.created_at,
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/contracts/send-sessions/:id', ...chain, async (req, res) => {
    try {
      const effectiveGa = await resolveEffectiveGaId(pool, req)
      const isSuper = isSuperAdminRole(req.user?.role)
      const params = [req.params.id]
      let where = `
        FROM contract_send_sessions s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.id = $1
      `
      if (!isSuper) {
        if (effectiveGa == null) {
          res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
          return
        }
        params.push(effectiveGa)
        where += ` AND c.ga_id = $${params.length}`
        if (normalizeRbacRole(req.user?.role) === 'USER') {
          params.push(getAuthUserId(req))
          where += ` AND c.user_id = $${params.length}`
        }
      }
      const r = await pool.query(
        `
        SELECT s.*
        ${where}
        LIMIT 1
        `,
        params,
      )
      if (r.rowCount === 0) {
        res.status(404).json({ ok: false, message: '발송 세션을 찾을 수 없습니다.' })
        return
      }
      const row = r.rows[0]
      const docs = await pool.query(
        `
        SELECT id, template_id, template_version, title_snapshot, status, sort_order, original_pdf_hash, created_at, completed_at
        FROM contract_document_instances
        WHERE send_session_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [row.id],
      )
      const docIds = docs.rows.map((d) => d.id)
      /** @type {Map<string, Record<string, unknown>>} */
      const evidenceByDoc = new Map()
      if (docIds.length > 0) {
        const evRows = await pool.query(
          `
          SELECT DISTINCT ON (document_instance_id)
            document_instance_id,
            evidence_hash,
            signed_at,
            otp_verified_at,
            provider,
            level,
            signature_file_id,
            signed_pdf_file_id,
            signed_pdf_hash
          FROM signature_evidences
          WHERE send_session_id = $1
            AND document_instance_id = ANY($2::text[])
          ORDER BY document_instance_id, created_at DESC
          `,
          [row.id, docIds],
        )
        for (const er of evRows.rows) {
          evidenceByDoc.set(String(er.document_instance_id), er)
        }
      }
      res.json({
        ok: true,
        sendSession: {
          id: row.id,
          linkCode: row.link_code,
          customerId: row.customer_id,
          packageId: row.package_id,
          status: row.status,
          maskedPhone: row.target_phone_masked,
          identitySessionId: row.identity_session_id,
          sentByUserId: row.sent_by_user_id,
          sentAt: row.sent_at,
          createdAt: row.created_at,
          completedAt: row.completed_at ?? null,
          documents: docs.rows.map((d) => {
            const ev = evidenceByDoc.get(String(d.id))
            return {
              id: d.id,
              templateId: d.template_id,
              templateVersion: d.template_version,
              titleSnapshot: d.title_snapshot,
              status: d.status,
              sortOrder: d.sort_order,
              originalPdfHash: d.original_pdf_hash,
              createdAt: d.created_at,
              completedAt: d.completed_at ?? null,
              evidence: ev
                ? {
                    documentInstanceId: d.id,
                    documentTitle: d.title_snapshot,
                    status: d.status,
                    completedAt: d.completed_at ?? null,
                    evidenceHash: ev.evidence_hash ? String(ev.evidence_hash) : null,
                    evidenceHashPrefix: ev.evidence_hash ? String(ev.evidence_hash).slice(0, 12) : null,
                    identityProvider: ev.provider != null ? String(ev.provider) : 'self_sms',
                    identityLevel: ev.level != null ? String(ev.level) : 'phone_possession',
                    otpVerifiedAt: ev.otp_verified_at ?? null,
                    signedAt: ev.signed_at ?? null,
                    hasSignatureFile: Boolean(ev.signature_file_id),
                    hasSignedPdfFile: Boolean(ev.signed_pdf_file_id),
                    hasSignedPdfHash: Boolean(ev.signed_pdf_hash),
                  }
                : null,
            }
          }),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
