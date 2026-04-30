import { createHash, randomUUID } from 'node:crypto'
import { parseGaId } from '../lib/parseGaId.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import { maskKrMobileForDisplay } from '../utils/maskKrMobile.js'
import {
  getAuthUserId,
  assertContractTemplateAccess,
  buildTargetPhoneSnapshot,
  generateUniqueLinkCode,
  parseTemplateIdsArray,
} from './contractAdminApi.js'

const CSS_PREFIX = 'css_'
const CDI_PREFIX = 'cdi_'

function newId(prefix) {
  return `${prefix}${randomUUID()}`
}

function escapeIlikePattern(raw) {
  return String(raw ?? '').replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

async function assertCustomerForUserSend(client, customerId, req) {
  const userGa = parseGaId(req.user?.gaId)
  const uid = getAuthUserId(req)
  if (!uid) {
    return { error: '로그인이 필요합니다.', status: 401 }
  }
  if (userGa == null) {
    return { error: 'GA 컨텍스트가 없습니다.', status: 400 }
  }
  const r = await client.query(
    `
    SELECT id, phone, ga_id, user_id
    FROM customers
    WHERE id = $1 AND deleted_at IS NULL AND ga_id = $2 AND user_id = $3
    `,
    [customerId, userGa, uid],
  )
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

function mapSendSessionDetailRow(row, docs, evidenceByDoc) {
  return {
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
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   forbidInsurerManagerApi: import('express').RequestHandler,
 *   requireContractUserSend: import('express').RequestHandler,
 *   handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void,
 * }} ctx
 */
export function registerContractUserApi(apiRouter, ctx) {
  const { pool, requireAuth, forbidInsurerManagerApi, requireContractUserSend, handleDbError } = ctx
  const chain = [requireAuth, forbidInsurerManagerApi, requireContractUserSend]

  apiRouter.get('/contracts/templates', ...chain, async (req, res) => {
    try {
      const userGa = parseGaId(req.user?.gaId)
      if (userGa == null) {
        res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.category,
          t.status,
          t.version,
          t.pdf_template_id,
          p.title AS pdf_engine_title,
          COALESCE(
            (SELECT COUNT(*)::int FROM pdf_template_fields f WHERE f.template_id = t.pdf_template_id),
            0
          ) AS pdf_field_count,
          COALESCE(
            (SELECT COUNT(*)::int FROM pdf_template_fields f
             WHERE f.template_id = t.pdf_template_id AND f.field_type = 'signature'),
            0
          ) AS signature_field_count,
          t.updated_at
        FROM contract_templates t
        LEFT JOIN pdf_templates p ON p.id = t.pdf_template_id
        WHERE t.ga_id = $1 AND t.status = 'active'
        ORDER BY t.updated_at DESC
        LIMIT 200
        `,
        [userGa],
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
          pdfFieldCount: row.pdf_field_count,
          signatureFieldCount: row.signature_field_count,
          sendable: Boolean(row.pdf_template_id && Number(row.pdf_field_count) > 0),
        })),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/contracts/customers/search', ...chain, async (req, res) => {
    try {
      const userGa = parseGaId(req.user?.gaId)
      const uid = getAuthUserId(req)
      if (!uid) {
        res.status(401).json({ ok: false, message: '로그인이 필요합니다.' })
        return
      }
      if (userGa == null) {
        res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const q = String(req.query.q ?? '').trim()
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)

      let sql = `
        SELECT c.id, c.name, c.customer_code, c.phone
        FROM customers c
        WHERE c.deleted_at IS NULL AND c.ga_id = $1 AND c.user_id = $2
      `
      const params = [userGa, uid]
      if (q) {
        const pattern = `%${escapeIlikePattern(q)}%`
        const rawId = /^\d+$/.test(q) ? Number(q) : null
        const idParam = rawId != null && Number.isInteger(rawId) && rawId > 0 ? rawId : null
        params.push(pattern, idParam)
        sql += `
          AND (
            c.name ILIKE $3 ESCAPE '\\'
            OR c.phone ILIKE $3 ESCAPE '\\'
            OR (c.customer_code IS NOT NULL AND c.customer_code ILIKE $3 ESCAPE '\\')
            OR ($4::int IS NOT NULL AND c.id = $4)
          )
        `
      }
      params.push(limit)
      sql += ` ORDER BY c.created_at DESC LIMIT $${params.length}`

      const r = await pool.query(sql, params)

      const customers = r.rows.map((row) => {
        const digits = normalizeKrMobile(row.phone)
        const phoneErr = validateKrMobileDigits(digits)
        const hasPhone = phoneErr == null
        const maskedPhone = hasPhone ? maskKrMobileForDisplay(digits) : ''
        return {
          id: row.id,
          name: row.name,
          customerCode: row.customer_code,
          maskedPhone,
          hasPhone,
        }
      })
      res.json({ ok: true, customers })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/contracts/send-sessions', ...chain, async (req, res) => {
    const client = await pool.connect()
    try {
      const userGa = parseGaId(req.user?.gaId)
      if (userGa == null) {
        res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      if (
        req.body?.phone != null ||
        req.body?.targetPhone != null ||
        req.body?.target_phone != null
      ) {
        res.status(400).json({ ok: false, message: 'phone은 요청 본문으로 받을 수 없습니다.' })
        return
      }
      const customerId = Number(req.body?.customerId ?? req.body?.customer_id)
      if (!Number.isInteger(customerId) || customerId < 1) {
        res.status(400).json({ ok: false, message: 'customerId가 올바르지 않습니다.' })
        return
      }
      const tplIdsRaw = req.body?.templateIds ?? req.body?.template_ids
      const parsed = parseTemplateIdsArray(tplIdsRaw)
      if (parsed.error) {
        res.status(400).json({ ok: false, message: parsed.error })
        return
      }

      const cust = await assertCustomerForUserSend(client, customerId, req)
      if (cust.error) {
        res.status(cust.status ?? 400).json({ ok: false, message: cust.error })
        return
      }
      const snapshot = buildTargetPhoneSnapshot(cust.digits)

      const contractTemplatesOrdered = /** @type {{ id: string, title: string, version: number, required: number, pdfHash: string | null, pdfTemplateId: number | null }[]} */ ([])

      await client.query('BEGIN')
      for (const tid of parsed.ids) {
        const tacc = await assertContractTemplateAccess(client, tid, userGa, false)
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
            ? createHash('sha256').update(`pdf_tmpl:${t.pdf_template_id}`, 'utf8').digest('hex')
            : null,
          pdfTemplateId: t.pdf_template_id,
        })
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
          $1, NULL, $2, $3, 'pending',
          $4, $5, $6,
          $7, ${nowSql}, ${nowSql}, ${nowSql}
        )
        `,
        [
          sendId,
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

  apiRouter.get('/contracts/send-sessions', ...chain, async (req, res) => {
    try {
      const userGa = parseGaId(req.user?.gaId)
      const uid = getAuthUserId(req)
      if (!uid) {
        res.status(401).json({ ok: false, message: '로그인이 필요합니다.' })
        return
      }
      if (userGa == null) {
        res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        SELECT s.id, s.link_code, s.customer_id, s.status, s.target_phone_masked, s.sent_at, s.created_at, s.package_id
        FROM contract_send_sessions s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.sent_by_user_id = $1
          AND c.user_id = $1
          AND c.ga_id = $2
        ORDER BY s.created_at DESC
        LIMIT 200
        `,
        [uid, userGa],
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

  apiRouter.get('/contracts/send-sessions/:id', ...chain, async (req, res) => {
    try {
      const userGa = parseGaId(req.user?.gaId)
      const uid = getAuthUserId(req)
      if (!uid) {
        res.status(401).json({ ok: false, message: '로그인이 필요합니다.' })
        return
      }
      if (userGa == null) {
        res.status(400).json({ ok: false, message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const r = await pool.query(
        `
        SELECT s.*
        FROM contract_send_sessions s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.id = $1
          AND s.sent_by_user_id = $2
          AND c.user_id = $2
          AND c.ga_id = $3
        LIMIT 1
        `,
        [req.params.id, uid, userGa],
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
        sendSession: mapSendSessionDetailRow(row, docs, evidenceByDoc),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
