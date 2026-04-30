import { createHash, randomUUID } from 'node:crypto'
import { decryptContractTargetPhoneBlob } from '../lib/contractStoredPhone.js'
import { consentPutObject } from '../lib/consentStorage.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import { maskKrMobileForDisplay } from '../utils/maskKrMobile.js'
import { getTemplateById, listFields } from '../pdf-engine/repository/pdfTemplateRepo.js'
import { getTemplateObject } from '../pdf-engine/storage/pdfTemplateStorage.js'
import { insertSignatureEvidenceRow, loadVerifiedIdentitySession } from '../services/contractEvidenceService.js'

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

function allowsDocumentMutation(sendStatus, identityStatus) {
  if (TERMINAL_SESSION.has(sendStatus)) {
    return false
  }
  if (sendStatus === 'completed') {
    return false
  }
  return isIdentityVerified(sendStatus, identityStatus)
}

/**
 * @param {{ evidence_hash?: string, signed_at?: Date | string } | null | undefined} ev
 * @param {{ completedAt?: string | null }} [opts]
 */
function buildPublicEvidenceFromRow(ev, opts = {}) {
  if (!ev || ev.evidence_hash == null || String(ev.evidence_hash).trim() === '') {
    return null
  }
  const out = {
    authenticationLabel: '지정 휴대폰 인증',
    evidenceHashPrefix: String(ev.evidence_hash).slice(0, 12),
    signedAt: ev.signed_at ? new Date(ev.signed_at).toISOString() : null,
  }
  if (opts.completedAt) {
    out.completedAt = opts.completedAt
  }
  return out
}

/** @param {import('express').Response} res @param {{ status: number, message: string, evidence?: unknown }} err */
function respondPublicMutationError(res, err) {
  const body = { success: false, message: err.message }
  if ('evidence' in err) {
    body.data = { evidence: err.evidence }
  }
  res.status(err.status).json(body)
}

const MAX_PUBLIC_TEXT_LEN = 8000
const MAX_PUBLIC_SIGNATURE_BYTES = 2 * 1024 * 1024

function parsePublicSignatureDataUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return null
  }
  const trimmed = input.trim()
  const marker = 'base64,'
  const index = trimmed.indexOf(marker)
  if (!trimmed.startsWith('data:image/png') || index < 0) {
    return null
  }
  try {
    const buf = Buffer.from(trimmed.slice(index + marker.length), 'base64')
    if (!buf || buf.length < 32) {
      return null
    }
    return buf
  } catch {
    return null
  }
}

function formatBirthDateIso(dateVal) {
  if (!dateVal) {
    return null
  }
  const dt = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (Number.isNaN(dt.getTime())) {
    return null
  }
  return dt.toISOString().slice(0, 10)
}

function buildSuggestedDefault(fieldRow, sessionRow, maskedPhone) {
  const m = fieldRow.customer_mapping ? String(fieldRow.customer_mapping) : ''
  if (m === 'phone') {
    return maskedPhone ?? ''
  }
  if (m === 'name') {
    const n = String(sessionRow.customer_name ?? '').trim()
    return n || null
  }
  if (m === 'dob') {
    return formatBirthDateIso(sessionRow.customer_birth_date)
  }
  if (m === 'address') {
    const a = String(sessionRow.customer_address ?? '').trim()
    return a || null
  }
  return null
}

function checkboxStorageFromBoolean(fieldRow, boolVal) {
  const opts = fieldRow.options
  const arr = Array.isArray(opts) && opts.length > 0 ? opts : null
  if (boolVal === true) {
    if (arr) {
      return JSON.stringify([String(arr[0])])
    }
    return 'true'
  }
  if (arr) {
    return '[]'
  }
  return 'false'
}

function normalizeIncomingValueForField(fieldRow, raw) {
  const ft = fieldRow.field_type
  if (ft === 'signature') {
    return {
      ok: false,
      status: 400,
      message: '서명 필드는 sign API 로만 저장할 수 있습니다.',
    }
  }
  if (ft === 'text' || ft === 'textarea') {
    if (raw == null) {
      return { ok: true, valueText: '' }
    }
    const s = String(raw).trim().slice(0, MAX_PUBLIC_TEXT_LEN)
    return { ok: true, valueText: s }
  }
  if (ft === 'radio') {
    if (raw == null || raw === '') {
      return { ok: true, valueText: '' }
    }
    const s = String(raw).trim()
    const allowed = new Set((Array.isArray(fieldRow.options) ? fieldRow.options : []).map((x) => String(x)))
    if (!allowed.has(s)) {
      return { ok: false, status: 400, message: `선택할 수 없는 옵션입니다: ${fieldRow.field_key}` }
    }
    return { ok: true, valueText: s }
  }
  if (ft === 'checkbox') {
    if (typeof raw === 'boolean') {
      return { ok: true, valueText: checkboxStorageFromBoolean(fieldRow, raw) }
    }
    if (raw == null) {
      return { ok: true, valueText: checkboxStorageFromBoolean(fieldRow, false) }
    }
    return { ok: false, status: 400, message: `checkbox 필드는 boolean 만 허용합니다: ${fieldRow.field_key}` }
  }
  return { ok: false, status: 400, message: `지원하지 않는 필드 타입입니다: ${ft}` }
}

function publicValueShape(fieldRow, valueRow) {
  if (!valueRow) {
    return null
  }
  const ft = fieldRow.field_type
  if (ft === 'signature') {
    return {
      kind: 'signature',
      signed: Boolean(valueRow.value_file_id || valueRow.value_hash),
    }
  }
  if (ft === 'checkbox') {
    const t = valueRow.value_text ?? ''
    try {
      const p = JSON.parse(t)
      return { kind: 'checkbox', checked: Array.isArray(p) && p.length > 0 }
    } catch {
      return { kind: 'checkbox', checked: t === 'true' }
    }
  }
  if (ft === 'radio') {
    return { kind: 'radio', value: valueRow.value_text ?? '' }
  }
  const raw = valueRow.value_text ?? ''
  if (fieldRow.customer_mapping === 'phone' && raw) {
    const d = normalizeKrMobile(raw)
    if (validateKrMobileDigits(d) === null) {
      return { kind: 'text', value: maskKrMobileForDisplay(d) }
    }
  }
  return { kind: 'text', value: raw }
}

function requiredFieldSatisfied(fieldRow, valueRow) {
  if (!fieldRow.required) {
    return true
  }
  const ft = fieldRow.field_type
  if (ft === 'signature') {
    return Boolean(valueRow?.value_file_id || valueRow?.value_hash)
  }
  if (!valueRow) {
    return false
  }
  if (ft === 'checkbox') {
    const t = valueRow.value_text ?? ''
    try {
      const p = JSON.parse(t)
      return Array.isArray(p) && p.length > 0
    } catch {
      return t === 'true'
    }
  }
  return String(valueRow.value_text ?? '').trim().length > 0
}

async function loadValueRows(db, documentInstanceId) {
  const r = await db.query(
    `
    SELECT field_id, field_key, field_type, value_text, value_file_id, value_hash
    FROM contract_document_values
    WHERE document_instance_id = $1
    `,
    [documentInstanceId],
  )
  return r.rows
}

function fieldMapsFromRows(rawFields) {
  const byId = new Map()
  const byKey = new Map()
  for (const row of rawFields) {
    byId.set(String(row.id), row)
    byKey.set(String(row.field_key), row)
  }
  return { byId, byKey }
}

async function resolveMutationBase(pool, linkCode, documentInstanceId) {
  const row = await loadSendSessionRow(pool, linkCode)
  if (!row) {
    return { error: { status: 404, message: '유효하지 않은 링크입니다.' } }
  }
  const sendStatus = String(row.status ?? '')
  const idStatus = await loadLatestIdentityStatus(pool, row.id)
  if (!allowsDocumentMutation(sendStatus, idStatus)) {
    return { error: { status: 403, message: '계약서 수신번호 인증이 필요합니다.' } }
  }
  const docR = await pool.query(
    `SELECT * FROM contract_document_instances WHERE id = $1 AND send_session_id = $2 LIMIT 1`,
    [documentInstanceId, row.id],
  )
  if (!docR.rowCount) {
    return { error: { status: 404, message: '문서를 찾을 수 없습니다.' } }
  }
  const doc = docR.rows[0]
  if (String(doc.status ?? '') === 'completed') {
    const evR = await pool.query(
      `
      SELECT evidence_hash, signed_at
      FROM signature_evidences
      WHERE document_instance_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [documentInstanceId],
    )
    return {
      error: {
        status: 409,
        message: '이미 완료된 문서입니다.',
        evidence: buildPublicEvidenceFromRow(evR.rows[0]),
      },
    }
  }
  return { session: row, sendStatus, idStatus, doc }
}

async function upsertDocumentValue(client, documentInstanceId, fieldRow, valueText, valueFileId, valueHash) {
  const fk = String(fieldRow.field_key)
  const ex = await client.query(
    `SELECT id FROM contract_document_values WHERE document_instance_id = $1 AND field_key = $2 LIMIT 1`,
    [documentInstanceId, fk],
  )
  if (ex.rowCount > 0) {
    await client.query(
      `
      UPDATE contract_document_values
      SET
        field_id = $1,
        field_type = $2,
        value_text = $3,
        value_file_id = $4,
        value_hash = $5,
        updated_at = NOW()
      WHERE id = $6
      `,
      [
        String(fieldRow.id),
        String(fieldRow.field_type),
        valueText,
        valueFileId ?? null,
        valueHash ?? null,
        ex.rows[0].id,
      ],
    )
  } else {
    const id = `cdv_${randomUUID()}`
    await client.query(
      `
      INSERT INTO contract_document_values (
        id, document_instance_id, field_id, field_key, field_type,
        value_text, value_file_id, value_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        id,
        documentInstanceId,
        String(fieldRow.id),
        fk,
        String(fieldRow.field_type),
        valueText,
        valueFileId ?? null,
        valueHash ?? null,
      ],
    )
  }
}

async function syncDocStatusAfterSign(pool, client, pdfTemplateId, documentInstanceId) {
  if (pdfTemplateId == null) {
    return
  }
  const fields = await listFields(pool, Number(pdfTemplateId))
  const sigFields = fields.filter((f) => String(f.field_type) === 'signature')
  if (sigFields.length === 0) {
    await client.query(`UPDATE contract_document_instances SET status = 'signing', updated_at = NOW() WHERE id = $1`, [
      documentInstanceId,
    ])
    return
  }
  const vals = await client.query(
    `SELECT field_id, value_file_id FROM contract_document_values WHERE document_instance_id = $1`,
    [documentInstanceId],
  )
  const byFid = new Map(vals.rows.map((r) => [String(r.field_id), r]))
  const allSigned = sigFields.every((f) => {
    const v = byFid.get(String(f.id))
    return v && v.value_file_id
  })
  await client.query(
    `UPDATE contract_document_instances SET status = $1, updated_at = NOW() WHERE id = $2`,
    [allSigned ? 'signed' : 'signing', documentInstanceId],
  )
}

async function maybeCompleteSendSession(client, sendSessionId) {
  const q = await client.query(
    `SELECT required, status FROM contract_document_instances WHERE send_session_id = $1`,
    [sendSessionId],
  )
  const requiredRows = q.rows.filter((r) => r.required === 1 || r.required === true)
  const ok =
    requiredRows.length === 0 || requiredRows.every((r) => String(r.status ?? '') === 'completed')
  if (ok) {
    await client.query(
      `
      UPDATE contract_send_sessions
      SET
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND status <> 'expired'
        AND status <> 'cancelled'
      `,
      [sendSessionId],
    )
  }
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
    customerMapping: row.customer_mapping ?? null,
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
    SELECT
      css.*,
      c.name AS customer_name,
      c.phone AS customer_phone_raw,
      c.user_id AS customer_user_id,
      c.ga_id AS customer_ga_id,
      c.birth_date AS customer_birth_date,
      c.address AS customer_address
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

  apiRouter.post('/contracts/public/:linkCode/documents/:documentInstanceId/complete', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const docId = String(req.params.documentInstanceId ?? '').trim()
      const base = await resolveMutationBase(pool, linkCode, docId)
      if (base.error) {
        respondPublicMutationError(res, base.error)
        return
      }
      if (req.body?.acknowledgeElectronicContract !== true) {
        res.status(400).json({ success: false, message: '전자계약 확인 진술에 동의해야 합니다.' })
        return
      }
      const { session } = base
      const docMeta = await pool.query(
        `
        SELECT cdi.*, ct.pdf_template_id, ct.pdf_hash AS contract_template_pdf_hash
        FROM contract_document_instances cdi
        INNER JOIN contract_templates ct ON ct.id = cdi.template_id
        WHERE cdi.id = $1 AND cdi.send_session_id = $2
        LIMIT 1
        `,
        [docId, session.id],
      )
      if (!docMeta.rowCount) {
        res.status(404).json({ success: false, message: '문서를 찾을 수 없습니다.' })
        return
      }
      const dm0 = docMeta.rows[0]
      const pdfTid = dm0.pdf_template_id
      const contractTemplatePdfHash = dm0.contract_template_pdf_hash ?? null
      if (pdfTid == null) {
        res.status(400).json({ success: false, message: 'PDF 템플릿이 연결되어 있지 않습니다.' })
        return
      }
      const rawFields = await listFields(pool, Number(pdfTid))
      const valRowsPre = await loadValueRows(pool, docId)
      const valueByKeyPre = new Map(valRowsPre.map((r) => [String(r.field_key), r]))
      const valueByFieldIdPre = new Map(valRowsPre.map((r) => [String(r.field_id), r]))
      const missingPre = []
      for (const f of rawFields) {
        if (!f.required) {
          continue
        }
        const vr = valueByKeyPre.get(String(f.field_key)) ?? valueByFieldIdPre.get(String(f.id))
        if (!requiredFieldSatisfied(f, vr)) {
          missingPre.push(String(f.field_key))
        }
      }
      if (missingPre.length > 0) {
        res.status(400).json({
          success: false,
          message: '필수 항목을 모두 입력·서명해야 합니다.',
          data: { missingFieldKeys: missingPre },
        })
        return
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const lockR = await client.query(
          `SELECT * FROM contract_document_instances WHERE id = $1 AND send_session_id = $2 FOR UPDATE`,
          [docId, session.id],
        )
        if (!lockR.rowCount) {
          await client.query('ROLLBACK')
          res.status(404).json({ success: false, message: '문서를 찾을 수 없습니다.' })
          return
        }
        const docLocked = lockR.rows[0]
        if (String(docLocked.status ?? '') === 'completed') {
          const evR0 = await client.query(
            `
            SELECT evidence_hash, signed_at
            FROM signature_evidences
            WHERE document_instance_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [docId],
          )
          await client.query('ROLLBACK')
          respondPublicMutationError(res, {
            status: 409,
            message: '이미 완료된 문서입니다.',
            evidence: buildPublicEvidenceFromRow(evR0.rows[0]),
          })
          return
        }
        const valRows = await loadValueRows(client, docId)
        const valueByKey = new Map(valRows.map((r) => [String(r.field_key), r]))
        const valueByFieldId = new Map(valRows.map((r) => [String(r.field_id), r]))
        const missing = []
        for (const f of rawFields) {
          if (!f.required) {
            continue
          }
          const vr = valueByKey.get(String(f.field_key)) ?? valueByFieldId.get(String(f.id))
          if (!requiredFieldSatisfied(f, vr)) {
            missing.push(String(f.field_key))
          }
        }
        if (missing.length > 0) {
          await client.query('ROLLBACK')
          res.status(400).json({
            success: false,
            message: '필수 항목을 모두 입력·서명해야 합니다.',
            data: { missingFieldKeys: missing },
          })
          return
        }
        const identityRow = await loadVerifiedIdentitySession(client, String(session.id), session.identity_session_id ?? null)
        if (!identityRow) {
          await client.query('ROLLBACK')
          res.status(403).json({ success: false, message: '계약서 수신번호 인증이 필요합니다.' })
          return
        }
        try {
          await insertSignatureEvidenceRow(client, req, {
            sendSession: session,
            documentInstance: docLocked,
            contractTemplate: { pdf_hash: contractTemplatePdfHash },
            pdfTemplateId: Number(pdfTid),
            valueRows: valRows,
            identityRow,
          })
        } catch (insErr) {
          if (insErr && insErr.code === '23505') {
            const evDup = await client.query(
              `
              SELECT evidence_hash, signed_at
              FROM signature_evidences
              WHERE document_instance_id = $1
              ORDER BY created_at DESC
              LIMIT 1
              `,
              [docId],
            )
            await client.query('ROLLBACK')
            respondPublicMutationError(res, {
              status: 409,
              message: '이미 완료된 문서입니다.',
              evidence: buildPublicEvidenceFromRow(evDup.rows[0]),
            })
            return
          }
          throw insErr
        }
        const completedRes = await client.query(
          `
          UPDATE contract_document_instances
          SET status = 'completed', completed_at = NOW(), updated_at = NOW()
          WHERE id = $1
          RETURNING completed_at
          `,
          [docId],
        )
        const completedAtIso = completedRes.rows[0]?.completed_at
          ? new Date(completedRes.rows[0].completed_at).toISOString()
          : null
        await client.query(
          `
          UPDATE contract_send_sessions
          SET
            status = CASE WHEN status = 'identity_verified' THEN 'signing' ELSE status END,
            updated_at = NOW()
          WHERE id = $1
          `,
          [session.id],
        )
        await maybeCompleteSendSession(client, session.id)
        const evRow = await client.query(
          `
          SELECT evidence_hash, signed_at
          FROM signature_evidences
          WHERE document_instance_id = $1
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [docId],
        )
        const evidenceSummary = buildPublicEvidenceFromRow(evRow.rows[0], {
          completedAt: completedAtIso,
        })
        await client.query('COMMIT')
        res.status(200).json({
          success: true,
          data: {
            completed: true,
            evidenceSummary: evidenceSummary ?? undefined,
          },
        })
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        handleDbError(e, req, res)
        return
      } finally {
        client.release()
      }
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/contracts/public/:linkCode/documents/:documentInstanceId/sign', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const docId = String(req.params.documentInstanceId ?? '').trim()
      const base = await resolveMutationBase(pool, linkCode, docId)
      if (base.error) {
        respondPublicMutationError(res, base.error)
        return
      }
      if (req.body?.electronicSignAcknowledged !== true) {
        res.status(400).json({ success: false, message: '전자서명 진술에 동의해야 합니다.' })
        return
      }
      const buf = parsePublicSignatureDataUrl(req.body?.signatureImageData ?? req.body?.signatureDataUrl)
      if (!buf) {
        res.status(400).json({ success: false, message: '유효한 PNG 서명 이미지가 필요합니다.' })
        return
      }
      if (buf.length > MAX_PUBLIC_SIGNATURE_BYTES) {
        res.status(400).json({ success: false, message: '서명 이미지 용량이 너무 큽니다.' })
        return
      }
      const { session } = base
      const docMeta = await pool.query(
        `
        SELECT cdi.*, ct.pdf_template_id
        FROM contract_document_instances cdi
        INNER JOIN contract_templates ct ON ct.id = cdi.template_id
        WHERE cdi.id = $1
        LIMIT 1
        `,
        [docId],
      )
      const pdfTid = docMeta.rows[0]?.pdf_template_id
      if (pdfTid == null) {
        res.status(400).json({ success: false, message: 'PDF 템플릿이 연결되어 있지 않습니다.' })
        return
      }
      const rawFields = await listFields(pool, Number(pdfTid))
      const sigFields = rawFields.filter((f) => String(f.field_type) === 'signature')
      if (sigFields.length === 0) {
        res.status(400).json({ success: false, message: '이 문서에 서명 필드가 없습니다.' })
        return
      }
      let targetField = null
      const rawFid = req.body?.fieldId
      if (rawFid != null && String(rawFid).trim() !== '') {
        targetField = sigFields.find((f) => String(f.id) === String(rawFid))
        if (!targetField) {
          res.status(400).json({ success: false, message: '유효하지 않은 서명 필드입니다.' })
          return
        }
      } else if (sigFields.length === 1) {
        targetField = sigFields[0]
      } else {
        res.status(400).json({ success: false, message: '서명 필드가 여러 개일 때 fieldId 가 필요합니다.' })
        return
      }
      const fileUserId = session.sent_by_user_id || session.customer_user_id
      const gaId = session.customer_ga_id
      if (!fileUserId || gaId == null) {
        res.status(503).json({ success: false, message: '파일 저장에 필요한 담당·GA 정보가 없습니다.' })
        return
      }
      const storageKey = `contracts/${session.id}/documents/${docId}/signature/${targetField.id}.png`
      const hashHex = createHash('sha256').update(buf).digest('hex')
      try {
        await consentPutObject(storageKey, buf, 'image/png')
      } catch (e) {
        handleDbError(e, req, res)
        return
      }
      let outFileId = ''
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const ins = await client.query(
          `
          INSERT INTO files (user_id, ga_id, customer_id, folder_id, original_name, display_name, file_path, file_size, mime_type)
          VALUES ($1, $2, $3, NULL, $4, $4, $5, $6, 'image/png')
          RETURNING id
          `,
          [
            fileUserId,
            gaId,
            session.customer_id,
            `contract-signature-${targetField.id}.png`,
            `contract-signature-${targetField.id}.png`,
            storageKey,
            buf.length,
          ],
        )
        outFileId = String(ins.rows[0].id)
        await upsertDocumentValue(client, docId, targetField, null, outFileId, hashHex)
        await syncDocStatusAfterSign(pool, client, pdfTid, docId)
        await client.query(
          `
          UPDATE contract_send_sessions
          SET
            status = CASE WHEN status = 'identity_verified' THEN 'signing' ELSE status END,
            updated_at = NOW()
          WHERE id = $1
            AND status = 'identity_verified'
          `,
          [session.id],
        )
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        handleDbError(e, req, res)
        return
      } finally {
        client.release()
      }
      res.status(200).json({
        success: true,
        data: {
          fieldId: String(targetField.id),
          valueHash: hashHex,
          fileId: outFileId,
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/contracts/public/:linkCode/documents/:documentInstanceId/values', async (req, res) => {
    try {
      const linkCode = String(req.params.linkCode ?? '').trim()
      const docId = String(req.params.documentInstanceId ?? '').trim()
      const base = await resolveMutationBase(pool, linkCode, docId)
      if (base.error) {
        respondPublicMutationError(res, base.error)
        return
      }
      const { session } = base
      const bodyVals = req.body?.values
      if (!Array.isArray(bodyVals)) {
        res.status(400).json({ success: false, message: 'values 배열이 필요합니다.' })
        return
      }
      const docMeta = await pool.query(
        `
        SELECT cdi.*, ct.pdf_template_id
        FROM contract_document_instances cdi
        INNER JOIN contract_templates ct ON ct.id = cdi.template_id
        WHERE cdi.id = $1
        LIMIT 1
        `,
        [docId],
      )
      const pdfTid = docMeta.rows[0]?.pdf_template_id
      if (pdfTid == null) {
        res.status(400).json({ success: false, message: 'PDF 템플릿이 없어 값을 저장할 수 없습니다.' })
        return
      }
      const rawFields = await listFields(pool, Number(pdfTid))
      const { byId } = fieldMapsFromRows(rawFields)
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const item of bodyVals) {
          const fid = item?.fieldId != null ? String(item.fieldId) : ''
          const fkey = item?.fieldKey != null ? String(item.fieldKey).trim() : ''
          const fieldRow = byId.get(fid)
          if (!fieldRow) {
            throw Object.assign(new Error('템플릿에 없는 fieldId 입니다.'), { statusCode: 400 })
          }
          if (!fkey || String(fieldRow.field_key) !== fkey) {
            throw Object.assign(new Error('fieldKey가 해당 필드와 일치하지 않습니다.'), { statusCode: 400 })
          }
          const normalized = normalizeIncomingValueForField(fieldRow, item?.value)
          if (!normalized.ok) {
            throw Object.assign(new Error(normalized.message), { statusCode: normalized.status })
          }
          await upsertDocumentValue(client, docId, fieldRow, normalized.valueText, null, null)
        }
        await client.query(
          `
          UPDATE contract_document_instances
          SET
            status = CASE WHEN status IN ('pending', 'viewed') THEN 'signing' ELSE status END,
            updated_at = NOW()
          WHERE id = $1
          `,
          [docId],
        )
        await client.query(
          `
          UPDATE contract_send_sessions
          SET
            status = CASE WHEN status = 'identity_verified' THEN 'signing' ELSE status END,
            updated_at = NOW()
          WHERE id = $1
            AND status = 'identity_verified'
          `,
          [session.id],
        )
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        const code = err.statusCode
        if (code >= 400 && code < 500) {
          res.status(code).json({ success: false, message: err.message || '요청이 올바르지 않습니다.' })
          return
        }
        handleDbError(err, req, res)
        return
      } finally {
        client.release()
      }
      res.status(200).json({ success: true, data: { saved: true } })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

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
      const maskedPhone = computeMaskedPhone(row)
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
          const valRows = await loadValueRows(pool, docId)
          const valueByKey = new Map(valRows.map((r) => [String(r.field_key), r]))
          const valueByFieldId = new Map(valRows.map((r) => [String(r.field_id), r]))
          fields = rawFields.map((rf) => {
            const dto = fieldRowToPublicDto(rf)
            const vr = valueByKey.get(String(rf.field_key)) ?? valueByFieldId.get(String(rf.id))
            dto.suggestedDefault = buildSuggestedDefault(rf, row, maskedPhone)
            dto.publicValue = publicValueShape(rf, vr)
            return dto
          })
        }
      }
      const pdfPreviewPath = `/api/contracts/public/${encodeURIComponent(linkCode)}/documents/${encodeURIComponent(docId)}/pdf`
      const canEdit =
        allowsDocumentMutation(sendStatus, idStatus) && String(doc.status ?? '') !== 'completed'
      let evidenceSummary = null
      if (String(doc.status ?? '') === 'completed') {
        const evR = await pool.query(
          `
          SELECT evidence_hash, signed_at
          FROM signature_evidences
          WHERE document_instance_id = $1
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [docId],
        )
        const completedAtIso = doc.completed_at ? new Date(doc.completed_at).toISOString() : null
        evidenceSummary = buildPublicEvidenceFromRow(evR.rows[0], { completedAt: completedAtIso })
      }
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
          canEdit,
          evidenceSummary: evidenceSummary ?? undefined,
          notice:
            '휴대폰 인증 완료 후 문서 작성 및 전자서명을 진행합니다. 본 화면에서 입력·임시저장·전자서명·문서 완료까지 이어집니다.',
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
