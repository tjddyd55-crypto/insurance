import { decryptContractTargetPhoneBlob } from '../lib/contractStoredPhone.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import { maskKrMobileForDisplay } from '../utils/maskKrMobile.js'
import { getTemplateById, listFields } from '../pdf-engine/repository/pdfTemplateRepo.js'
import { getTemplateObject } from '../pdf-engine/storage/pdfTemplateStorage.js'

const TERMINAL_SESSION = new Set(['expired', 'cancelled'])
const COMPLETED_SESSION = new Set(['completed'])
const DOC_ACCESS_STATUSES = new Set(['identity_verified', 'signing', 'completed'])

function maskCustomerDisplayName(name) {
  const s = String(name ?? '').trim()
  if (!s) {
    return '고객'
  }
  if (s.length === 1) {
    return `${s}*`
  }
  if (s.length === 2) {
    return `${s[0]}*`
  }
  const mid = Math.min(4, s.length - 2)
  return `${s[0]}${'*'.repeat(mid)}${s[s.length - 1]}`
}

function computeMaskedPhone(row) {
  const enc = String(row.target_phone_encrypted ?? '').trim()
  let digits = null
  if (enc) {
    const d = decryptContractTargetPhoneBlob(enc)
    if (d && validateKrMobileDigits(d) === null) {
      digits = d
    }
  }
  if (!digits) {
    const d = normalizeKrMobile(row.customer_phone_raw)
    if (validateKrMobileDigits(d) === null) {
      digits = d
    }
  }
  const m = String(row.target_phone_masked ?? '').trim()
  if (m) {
    return m
  }
  if (digits) {
    return maskKrMobileForDisplay(digits)
  }
  return null
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} sendSessionId
 */
async function loadLatestIdentityStatus(pool, sendSessionId) {
  const r = await pool.query(
    `
    SELECT status
    FROM identity_verification_sessions
    WHERE send_session_id = $1
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
    `,
    [sendSessionId],
  )
  return r.rows[0] ? String(r.rows[0].status ?? '') : null
}

/**
 * @param {string} sendStatus
 * @param {string | null} identityStatus
 */
function isIdentityVerified(sendStatus, identityStatus) {
  if (DOC_ACCESS_STATUSES.has(sendStatus)) {
    return true
  }
  return identityStatus === 'verified'
}

/**
 * @param {string} sendStatus
 * @param {string | null} identityStatus
 */
function allowsDocumentDetail(sendStatus, identityStatus) {
  if (TERMINAL_SESSION.has(sendStatus)) {
    return false
  }
  if (COMPLETED_SESSION.has(sendStatus)) {
    return true
  }
  return isIdentityVerified(sendStatus, identityStatus)
}

function fieldRowToPublicDto(row) {
  return {
    id: String(row.id),
    fieldKey: row.field_key,
    label: row.label ?? '',
    fieldType: row.field_type,
    required: Boolean(row.required),
    orderIndex: row.order_index,
    placements: row.placements ?? [],
    options: row.options ?? null,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} linkCode
 */
async function loadSendSessionRow(pool, linkCode) {
  const lc = String(linkCode ?? '').trim()
  if (!lc) {
    return null
  }
  const r = await pool.query(
    `
    SELECT css.*, c.name AS customer_name, c.phone AS customer_phone_raw
    FROM contract_send_sessions css
    INNER JOIN customers c ON c.id = css.customer_id
    WHERE css.link_code = $1
    LIMIT 1
    `,
    [lc],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, handleDbError: Function }} ctx
 */
export function registerContractPublicApi(apiRouter, ctx) {
  const { pool, handleDbError } = ctx

  apiRouter.get('/contracts/public/:linkCode/documents/:documentInstanceId/pdf', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const docId = String(req.params.documentInstanceId ?? '').trim()
      const row = await loadSendSessionRow(pool, linkCode)
      if (!row) {
        res.status(404).json({ success: false, message: '유효하지 않은 링크입니다.' })
        return
      }
      const sendStatus = String(row.status ?? '')
      const idStatus = await loadLatestIdentityStatus(pool, row.id)
      if (!allowsDocumentDetail(sendStatus, idStatus)) {
        res.status(403).json({ success: false, message: '계약서 수신번호 인증이 필요합니다.' })
        return
      }
      const docR = await pool.query(
        `
        SELECT cdi.id, cdi.template_id, ct.pdf_template_id
        FROM contract_document_instances cdi
        INNER JOIN contract_templates ct ON ct.id = cdi.template_id
        WHERE cdi.id = $1 AND cdi.send_session_id = $2
        LIMIT 1
        `,
        [docId, row.id],
      )
      if (docR.rowCount === 0) {
        res.status(404).json({ success: false, message: '문서를 찾을 수 없습니다.' })
        return
      }
      const pdfTid = docR.rows[0].pdf_template_id
      if (pdfTid == null) {
        res.status(404).json({ success: false, message: 'PDF 템플릿이 연결되어 있지 않습니다.' })
        return
      }
      const tpl = await getTemplateById(pool, Number(pdfTid))
      if (!tpl || !tpl.storage_key) {
        res.status(404).json({ success: false, message: 'PDF 파일을 찾을 수 없습니다.' })
        return
      }
      const buf = await getTemplateObject(String(tpl.storage_key))
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Cache-Control', 'private, no-store')
      res.status(200).send(buf)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/contracts/public/:linkCode/documents/:documentInstanceId', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const docId = String(req.params.documentInstanceId ?? '').trim()
      const row = await loadSendSessionRow(pool, linkCode)
      if (!row) {
        res.status(404).json({ success: false, message: '유효하지 않은 링크입니다.' })
        return
      }
      const sendStatus = String(row.status ?? '')
      const idStatus = await loadLatestIdentityStatus(pool, row.id)
      if (!allowsDocumentDetail(sendStatus, idStatus)) {
        res.status(403).json({ success: false, message: '계약서 수신번호 인증이 필요합니다.' })
        return
      }
      const docR = await pool.query(
        `
        SELECT cdi.*, ct.pdf_template_id
        FROM contract_document_instances cdi
        INNER JOIN contract_templates ct ON ct.id = cdi.template_id
        WHERE cdi.id = $1 AND cdi.send_session_id = $2
        LIMIT 1
        `,
        [docId, row.id],
      )
      if (docR.rowCount === 0) {
        res.status(404).json({ success: false, message: '문서를 찾을 수 없습니다.' })
        return
      }
      const doc = docR.rows[0]
      if (String(doc.status ?? '') === 'pending') {
        await pool.query(
          `UPDATE contract_document_instances SET status = 'viewed', updated_at = NOW() WHERE id = $1`,
          [docId],
        )
        doc.status = 'viewed'
      }
      const pdfTid = doc.pdf_template_id
      let pdfTemplate = null
      let fields = []
      if (pdfTid != null) {
        const tpl = await getTemplateById(pool, Number(pdfTid))
        if (tpl) {
          pdfTemplate = {
            id: tpl.id,
            code: tpl.code,
            title: tpl.title,
            description: tpl.description ?? '',
            pageCount: tpl.page_count,
            isActive: tpl.is_active,
          }
          const rawFields = await listFields(pool, Number(pdfTid))
          fields = rawFields.map(fieldRowToPublicDto)
        }
      }
      const pdfPreviewPath = `/api/contracts/public/${encodeURIComponent(linkCode)}/documents/${encodeURIComponent(docId)}/pdf`
      res.status(200).json({
        success: true,
        data: {
          document: {
            id: String(doc.id),
            templateId: String(doc.template_id),
            title: String(doc.title_snapshot ?? ''),
            status: String(doc.status ?? ''),
            required: doc.required === 1 || doc.required === true,
            sortOrder: Number(doc.sort_order ?? 0),
            pdfTemplateId: pdfTid != null ? Number(pdfTid) : null,
            templateVersion: doc.template_version != null ? Number(doc.template_version) : null,
            originalPdfHash: doc.original_pdf_hash ? String(doc.original_pdf_hash) : null,
          },
          pdfTemplate,
          fields,
          pdfPreviewUrl: pdfPreviewPath,
          notice: '서명·작성 저장은 다음 단계에서 연결됩니다.',
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/contracts/public/:linkCode/documents', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const row = await loadSendSessionRow(pool, linkCode)
      if (!row) {
        res.status(404).json({ success: false, message: '유효하지 않은 링크입니다.' })
        return
      }
      const sendStatus = String(row.status ?? '')
      const idStatus = await loadLatestIdentityStatus(pool, row.id)
      if (!allowsDocumentDetail(sendStatus, idStatus)) {
        res.status(403).json({ success: false, message: '계약서 수신번호 인증이 필요합니다.' })
        return
      }
      const docs = await pool.query(
        `
        SELECT id, title_snapshot, required, sort_order, status
        FROM contract_document_instances
        WHERE send_session_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [row.id],
      )
      res.status(200).json({
        success: true,
        data: {
          documents: docs.rows.map((d) => ({
            id: String(d.id),
            title: String(d.title_snapshot ?? ''),
            required: d.required === 1 || d.required === true,
            sortOrder: Number(d.sort_order ?? 0),
            status: String(d.status ?? ''),
          })),
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/contracts/public/:linkCode/open', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const row = await loadSendSessionRow(pool, linkCode)
      if (!row) {
        res.status(404).json({ success: false, message: '유효하지 않은 링크입니다.' })
        return
      }
      const sendStatus = String(row.status ?? '')
      if (TERMINAL_SESSION.has(sendStatus)) {
        res.status(409).json({ success: false, message: '만료되었거나 취소된 링크입니다.' })
        return
      }
      await pool.query(
        `
        UPDATE contract_send_sessions
        SET
          opened_at = COALESCE(opened_at, NOW()),
          status = CASE WHEN status = 'pending' THEN 'opened' ELSE status END,
          updated_at = NOW()
        WHERE id = $1 AND status NOT IN ('expired', 'cancelled')
        `,
        [row.id],
      )
      res.status(200).json({
        success: true,
        data: {
          opened: true,
          metaRecorded: true,
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/contracts/public/:linkCode', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const row = await loadSendSessionRow(pool, linkCode)
      if (!row) {
        res.status(404).json({ success: false, message: '유효하지 않은 링크입니다.' })
        return
      }
      const sendStatus = String(row.status ?? '')
      const idStatus = await loadLatestIdentityStatus(pool, row.id)
      const maskedPhone = computeMaskedPhone(row)
      const customerDisplayName = maskCustomerDisplayName(row.customer_name)
      const verified = isIdentityVerified(sendStatus, idStatus)
      const authenticationRequired = !verified && !TERMINAL_SESSION.has(sendStatus) && !COMPLETED_SESSION.has(sendStatus)

      const docs = await pool.query(
        `
        SELECT id, title_snapshot, required, sort_order, status
        FROM contract_document_instances
        WHERE send_session_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [row.id],
      )
      const docRows = docs.rows
      const documentCount = docRows.length
      const completedDocumentCount = docRows.filter((d) => String(d.status ?? '') === 'completed').length
      const requiredRows = docRows.filter((d) => d.required === 1 || d.required === true)
      const allRequiredCompleted =
        requiredRows.length === 0 ||
        requiredRows.every((d) => String(d.status ?? '') === 'completed')

      const documentsPublic = docRows.map((d) => ({
        id: String(d.id),
        title: String(d.title_snapshot ?? ''),
        required: d.required === 1 || d.required === true,
        sortOrder: Number(d.sort_order ?? 0),
        status: String(d.status ?? ''),
      }))

      res.status(200).json({
        success: true,
        data: {
          sendSession: {
            id: String(row.id),
            status: sendStatus,
            maskedPhone,
            customerDisplayName,
            identityVerified: verified,
            identityStatus: idStatus,
            authenticationRequired,
            openedAt: row.opened_at ? new Date(row.opened_at).toISOString() : null,
          },
          blocked: TERMINAL_SESSION.has(sendStatus),
          completed: COMPLETED_SESSION.has(sendStatus),
          documentCount,
          completedDocumentCount,
          allRequiredCompleted,
          documents: documentsPublic,
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
