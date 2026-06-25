/**
 * 보험청구 전용 보험회사 설정 API — 일반 pdf_templates 와 분리.
 */

import multer from 'multer'
import {
  fieldSpecWithDbMapping,
  normalizeFieldSpec,
  normalizeFieldSpecList,
} from './pdf-engine/schema/fieldSpec.js'
import { inputRoleFromPdfFieldRow } from './pdf-engine/schema/inputRole.js'
import { mergePdfFieldCustomerMappings } from './pdf-engine/schema/fieldDataMapping.js'
import { mergePdfUploadBuffers } from './pdf-engine/pdf/mergePdfBuffers.js'
import {
  buildClaimDocumentStorageKey,
  deleteClaimDocumentObject,
  getClaimDocumentObject,
  putClaimDocumentObject,
} from './insurance-claim/storage/claimDocumentStorage.js'
import {
  buildClaimRequestAttachmentStorageKey,
  buildClaimRequestSignatureStorageKey,
  getClaimRequestAttachmentObject,
  isGeneratedClaimDocumentKey,
  putClaimRequestAttachmentObject,
} from './insurance-claim/storage/claimRequestAttachmentStorage.js'
import { buildInsuranceClaimDownloadFiles } from './insurance-claim/buildInsuranceClaimDownloadFiles.js'
import {
  createInsuranceCompany,
  getActiveDocumentForCompany,
  getDocumentById,
  getInsuranceCompanyById,
  listActiveCompaniesForClaimFlow,
  listCompanyDocuments,
  listDocumentFieldMappings,
  listDocumentFields,
  listInsuranceCompanies,
  normalizeCompanyType,
  normalizeDocumentType,
  replaceDocumentFields,
  updateInsuranceCompany,
  upsertCompanyDocument,
} from './insurance-claim/repository/insuranceClaimCompanyRepo.js'
import {
  createDraft,
  duplicateAsDraft,
  getById as getClaimRequestById,
  list as listClaimRequests,
  listByCustomerId,
  markGenerated,
  markDownloaded,
  updateDraft,
} from './insurance-claim/repository/insuranceClaimRequestRepo.js'
import { stampPdf } from './pdf-engine/renderer/stampPdf.js'
import { buildInsuranceClaimStampPayload } from './insurance-claim/buildInsuranceClaimStampPayload.js'
import { buildClaimBundleDownloadName, buildContentDisposition } from './lib/claimRequestFileBundle.js'

const MAX_PDF_UPLOAD_FILES = 20
const MAX_PDF_UPLOAD_BYTES_PER_FILE = 25 * 1024 * 1024
const MAX_PDF_UPLOAD_BYTES_TOTAL = 50 * 1024 * 1024

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_UPLOAD_BYTES_PER_FILE },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname ?? '').toLowerCase()
    if (file.mimetype !== 'application/pdf' && !name.endsWith('.pdf')) {
      cb(new Error('PDF 파일만 업로드할 수 있습니다.'))
      return
    }
    cb(null, true)
  },
})

const MAX_CLAIM_ATTACHMENT_BYTES = 25 * 1024 * 1024

const uploadClaimAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CLAIM_ATTACHMENT_BYTES },
})

const uploadClaimSignature = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname ?? '').toLowerCase()
    const mime = String(file.mimetype ?? '').toLowerCase()
    const ok =
      mime.startsWith('image/') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.webp')
    if (!ok) {
      cb(new Error('서명 파일은 이미지(PNG/JPG/WEBP)만 업로드할 수 있습니다.'))
      return
    }
    cb(null, true)
  },
})

function parsePositiveInt(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

function normalizeClaimRequestInput(body) {
  const insuredSnapshot = body?.insuredSnapshot ?? body?.insured_snapshot
  if (!insuredSnapshot || typeof insuredSnapshot !== 'object' || Array.isArray(insuredSnapshot)) {
    const error = new Error('피보험자 정보(insured_snapshot)가 필요합니다.')
    error.httpStatus = 400
    throw error
  }
  const insuranceCompanyId = parsePositiveInt(body?.insuranceCompanyId ?? body?.insurance_company_id)
  if (insuranceCompanyId == null) {
    const error = new Error('보험회사를 선택해 주세요.')
    error.httpStatus = 400
    throw error
  }
  const contractorSameAsInsured = body?.contractorSameAsInsured ?? body?.contractor_same_as_insured
  return {
    customerId: parsePositiveInt(body?.customerId ?? body?.customer_id),
    insuranceCompanyId,
    insuredSnapshot,
    contractorSnapshot: body?.contractorSnapshot ?? body?.contractor_snapshot ?? null,
    contractorSameAsInsured: contractorSameAsInsured !== false,
    claimData: body?.claimData ?? body?.claim_data ?? {},
    paymentData: body?.paymentData ?? body?.payment_data ?? {},
    signatureData: body?.signatureData ?? body?.signature_data ?? {},
    selectedCustomerAttachmentIds: body?.selectedCustomerAttachmentIds ?? body?.selected_customer_attachment_ids ?? [],
    additionalAttachmentMetadata: body?.additionalAttachmentMetadata ?? body?.additional_attachment_metadata ?? [],
  }
}

function parseSourcePdfMetadataBody(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const fileName = typeof item.fileName === 'string' ? item.fileName.trim() : ''
    const startPage = Number(item.startPage)
    const endPage = Number(item.endPage)
    const pageCount = Number(item.pageCount)
    if (!fileName || !Number.isInteger(startPage) || !Number.isInteger(endPage) || !Number.isInteger(pageCount)) {
      continue
    }
    out.push({ fileName, startPage, endPage, pageCount })
  }
  return out.length > 0 ? out : null
}

function isInsuranceClaimAdminRole(role) {
  const r = String(role ?? '')
  return r === 'SUPER_ADMIN' || r === 'GA_ADMIN' || r === 'GA_STAFF'
}

function requireInsuranceClaimAdmin(req, res) {
  if (!req.user || !isInsuranceClaimAdminRole(req.user.role)) {
    res.status(403).json({ message: '보험청구 관리 권한이 필요합니다.' })
    return false
  }
  return true
}

async function assertCustomerInGa(pool, gaId, customerId) {
  const { rows } = await pool.query(
    `SELECT id FROM customers WHERE id = $1 AND ga_id = $2 LIMIT 1`,
    [customerId, gaId],
  )
  if (!rows[0]) {
    const error = new Error('고객을 찾을 수 없습니다.')
    error.httpStatus = 404
    throw error
  }
}

async function readInsuranceClaimDownloadBuffer(storageKey) {
  const key = String(storageKey ?? '').trim()
  if (!key) {
    throw new Error('storage key missing')
  }
  if (isGeneratedClaimDocumentKey(key)) {
    return getClaimDocumentObject(key)
  }
  return getClaimRequestAttachmentObject(key)
}

function claimFieldRowToDto(row) {
  const base = normalizeFieldSpec(
    {
      fieldKey: row.field_key,
      label: row.label,
      fieldType: row.field_type,
      required: row.required,
      orderIndex: row.order_index,
      inputOrder: row.input_order != null ? Number(row.input_order) : null,
      inputRole: 'customer',
      options: Array.isArray(row.options) ? row.options : null,
      placements: Array.isArray(row.placements) ? row.placements : [],
    },
    row.order_index,
  )
  const withMapping = fieldSpecWithDbMapping(base, row.data_mapping)
  return {
    id: row.id,
    ...withMapping,
    inputRole: inputRoleFromPdfFieldRow({ ...row, input_role: 'customer' }),
  }
}

export function registerInsuranceClaimCompanyApi(apiRouter, { pool, requireAuth, handleDbError, resolveTenantGaIdForRequest }) {
  const adminMw = [requireAuth, (req, res, next) => {
    if (!requireInsuranceClaimAdmin(req, res)) return
    next()
  }]

  const claimRequestMw = [requireAuth, async (req, res, next) => {
    try {
      const gaId = await resolveTenantGaIdForRequest(pool, req)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      req.insuranceClaimGaId = gaId
      next()
    } catch (error) {
      handleDbError(error, req, res)
    }
  }]

  apiRouter.post('/insurance-claim/requests', ...claimRequestMw, async (req, res) => {
    try {
      const input = normalizeClaimRequestInput(req.body)
      const company = await getInsuranceCompanyById(pool, input.insuranceCompanyId)
      if (!company?.isActive) {
        res.status(400).json({ message: '사용 가능한 보험회사를 선택해 주세요.' })
        return
      }
      const request = await createDraft(pool, {
        ...input,
        gaId: req.insuranceClaimGaId,
        createdBy: parsePositiveInt(req.user?.id),
      })
      res.status(201).json({ request })
    } catch (error) {
      if (error?.httpStatus) {
        res.status(error.httpStatus).json({ message: error.message })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/insurance-claim/requests', ...claimRequestMw, async (req, res) => {
    try {
      res.json({ requests: await listClaimRequests(pool, req.insuranceClaimGaId) })
    } catch (error) { handleDbError(error, req, res) }
  })

  apiRouter.get('/insurance-claim/requests/:id', ...claimRequestMw, async (req, res) => {
    try {
      const request = await getClaimRequestById(pool, req.insuranceClaimGaId, parsePositiveInt(req.params.id))
      if (!request) return res.status(404).json({ message: '청구 내역을 찾을 수 없습니다.' })
      res.json({ request })
    } catch (error) { handleDbError(error, req, res) }
  })

  apiRouter.patch('/insurance-claim/requests/:id', ...claimRequestMw, async (req, res) => {
    try {
      const input = normalizeClaimRequestInput(req.body)
      const request = await updateDraft(pool, req.insuranceClaimGaId, parsePositiveInt(req.params.id), input)
      if (!request) return res.status(404).json({ message: '청구 내역을 찾을 수 없습니다.' })
      res.json({ request })
    } catch (error) {
      if (error?.code === 'CLAIM_REQUEST_NOT_DRAFT') return res.status(409).json({ message: error.message })
      if (error?.httpStatus) return res.status(error.httpStatus).json({ message: error.message })
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/insurance-claim/requests/:id/duplicate', ...claimRequestMw, async (req, res) => {
    try {
      const request = await duplicateAsDraft(pool, req.insuranceClaimGaId, parsePositiveInt(req.params.id), parsePositiveInt(req.user?.id))
      if (!request) return res.status(404).json({ message: '청구 내역을 찾을 수 없습니다.' })
      res.status(201).json({ request })
    } catch (error) { handleDbError(error, req, res) }
  })

  apiRouter.post('/insurance-claim/requests/:id/generate', ...claimRequestMw, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id)
      const request = await getClaimRequestById(pool, req.insuranceClaimGaId, id)
      if (!request) return res.status(404).json({ message: '청구 내역을 찾을 수 없습니다.' })
      if (request.status !== 'draft') return res.status(409).json({ message: 'draft 상태의 청구만 생성할 수 있습니다.' })
      const generated = []
      for (const type of ['claim_form', 'consent_form']) {
        const document = await getActiveDocumentForCompany(pool, request.insuranceCompanyId, type)
        if (!document) return res.status(400).json({ message: `${type === 'claim_form' ? '청구서' : '동의서'} PDF 설정이 필요합니다.` })
        const fields = (await listDocumentFields(pool, document.id)).map(claimFieldRowToDto)
        const { values, signaturePngByFieldKey } = await buildInsuranceClaimStampPayload(fields, request, type)
        const rendered = await stampPdf(
          await getClaimDocumentObject(document.storageKey),
          fields,
          values,
          signaturePngByFieldKey,
        )
        const storageKey = buildClaimDocumentStorageKey({ companyId: request.insuranceCompanyId, documentType: `generated-${id}-${type}` })
        await putClaimDocumentObject(storageKey, rendered)
        generated.push({ documentType: type, storageKey, fileName: `${type === 'claim_form' ? '청구서' : '동의서'}.pdf`, contentType: 'application/pdf' })
      }
      const updated = await markGenerated(pool, req.insuranceClaimGaId, id, { documents: generated, generatedAt: new Date().toISOString() })
      res.json({ request: updated })
    } catch (error) { handleDbError(error, req, res) }
  })

  apiRouter.get('/insurance-claim/requests/:id/download', ...claimRequestMw, async (req, res) => {
    try {
      const request = await getClaimRequestById(pool, req.insuranceClaimGaId, parsePositiveInt(req.params.id))
      const { files, skipped } = await buildInsuranceClaimDownloadFiles(pool, req.insuranceClaimGaId, request ?? {})
      if (!request || files.length === 0) {
        return res.status(404).json({ message: '생성된 청구 문서가 없습니다.' })
      }
      await markDownloaded(pool, req.insuranceClaimGaId, request.id)
      res.status(200).setHeader('Content-Type', 'application/zip')
      res.setHeader(
        'Content-Disposition',
        buildContentDisposition(buildClaimBundleDownloadName(request.insuredSnapshot?.name, request.createdAt, 'zip')),
      )
      const archive = (await import('archiver')).default('zip', { zlib: { level: 6 } })
      const archiveDone = new Promise((resolve, reject) => {
        archive.on('error', reject)
        archive.on('end', resolve)
      })
      archive.pipe(res)
      if (skipped.length > 0) {
        archive.append(
          `다음 파일은 포함하지 못했습니다.\n${skipped.map((name) => `- ${name}`).join('\n')}`,
          { name: '_누락파일.txt' },
        )
      }
      const missing = []
      for (const file of files) {
        try {
          const buffer = await readInsuranceClaimDownloadBuffer(file.storageKey)
          archive.append(buffer, { name: file.fileName })
        } catch {
          missing.push(file.fileName)
        }
      }
      if (missing.length > 0) {
        archive.append(
          `다음 파일을 읽지 못했습니다.\n${missing.map((name) => `- ${name}`).join('\n')}`,
          { name: '_읽기실패.txt' },
        )
      }
      await archive.finalize()
      await archiveDone
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post(
    '/insurance-claim/requests/:id/attachments/upload',
    ...claimRequestMw,
    uploadClaimAttachment.single('file'),
    async (req, res) => {
      try {
        const id = parsePositiveInt(req.params.id)
        const request = await getClaimRequestById(pool, req.insuranceClaimGaId, id)
        if (!request) return res.status(404).json({ message: '청구 내역을 찾을 수 없습니다.' })
        if (request.status !== 'draft') return res.status(409).json({ message: 'draft 상태의 청구만 첨부를 추가할 수 있습니다.' })
        const file = req.file
        if (!file?.buffer?.length) return res.status(400).json({ message: '파일을 선택해 주세요.' })
        const fileName = String(file.originalname ?? 'attachment').trim() || 'attachment'
        const storageKey = buildClaimRequestAttachmentStorageKey(id, fileName)
        const contentType = String(file.mimetype ?? 'application/octet-stream')
        await putClaimRequestAttachmentObject(storageKey, file.buffer, contentType)
        res.json({
          attachment: {
            storageKey,
            fileName,
            contentType,
            size: file.buffer.length,
            uploadedAt: new Date().toISOString(),
          },
        })
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.post(
    '/insurance-claim/requests/:id/signatures/upload',
    ...claimRequestMw,
    uploadClaimSignature.single('file'),
    async (req, res) => {
      try {
        const id = parsePositiveInt(req.params.id)
        const role = String(req.body?.role ?? '').trim() === 'contractor' ? 'contractor' : 'insured'
        const request = await getClaimRequestById(pool, req.insuranceClaimGaId, id)
        if (!request) return res.status(404).json({ message: '청구 내역을 찾을 수 없습니다.' })
        if (request.status !== 'draft') return res.status(409).json({ message: 'draft 상태의 청구만 서명을 변경할 수 있습니다.' })
        const file = req.file
        if (!file?.buffer?.length) return res.status(400).json({ message: '서명 이미지를 선택해 주세요.' })
        const fileName = String(file.originalname ?? `${role}-signature.png`).trim() || `${role}-signature.png`
        const storageKey = buildClaimRequestSignatureStorageKey(id, role, fileName)
        const contentType = String(file.mimetype ?? 'image/png')
        await putClaimRequestAttachmentObject(storageKey, file.buffer, contentType)
        res.json({
          signature: {
            storageKey,
            fileName,
            contentType,
            size: file.buffer.length,
            signedAt: new Date().toISOString(),
          },
          role,
        })
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.get('/insurance-claim/customers/:customerId/app-attachments', ...claimRequestMw, async (req, res) => {
    try {
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) return res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      await assertCustomerInGa(pool, req.insuranceClaimGaId, customerId)
      const { rows } = await pool.query(
        `
        SELECT
          f.id,
          f.file_name,
          f.content_type,
          f.file_size,
          f.uploaded_at,
          r.id AS request_id,
          COALESCE(NULLIF(TRIM(r.title), ''), CONCAT('청구 #', r.id::text)) AS request_title
        FROM customer_claim_request_files f
        INNER JOIN customer_claim_requests r ON r.id = f.request_id
        INNER JOIN customers c ON c.id = f.customer_id
        WHERE f.customer_id = $1 AND c.ga_id = $2
        ORDER BY f.uploaded_at DESC, f.id DESC
        LIMIT 200
        `,
        [customerId, req.insuranceClaimGaId],
      )
      res.json({
        attachments: rows.map((row) => ({
          id: Number(row.id),
          fileName: String(row.file_name ?? ''),
          contentType: String(row.content_type ?? ''),
          fileSize: Number(row.file_size ?? 0),
          uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : null,
          requestId: Number(row.request_id),
          requestTitle: String(row.request_title ?? ''),
        })),
      })
    } catch (error) {
      if (error?.httpStatus) return res.status(error.httpStatus).json({ message: error.message })
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/:customerId/insurance-claim/requests', ...claimRequestMw, async (req, res) => {
    try {
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) return res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      res.json({ requests: await listByCustomerId(pool, req.insuranceClaimGaId, customerId) })
    } catch (error) { handleDbError(error, req, res) }
  })

  apiRouter.get('/admin/insurance-claim/companies', ...adminMw, async (req, res) => {
    try {
      const includeInactive = String(req.query?.includeInactive ?? 'true').toLowerCase() !== 'false'
      const companies = await listInsuranceCompanies(pool, { includeInactive })
      res.json({ companies })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/insurance-claim/companies', ...adminMw, async (req, res) => {
    try {
      const companyName = String(req.body?.companyName ?? req.body?.company_name ?? '').trim()
      const companyType = normalizeCompanyType(req.body?.companyType ?? req.body?.company_type)
      if (!companyName) {
        res.status(400).json({ message: '보험회사명을 입력해 주세요.' })
        return
      }
      if (!companyType) {
        res.status(400).json({ message: '회사 구분이 올바르지 않습니다.' })
        return
      }
      const created = await createInsuranceCompany(pool, {
        companyName,
        companyType,
        faxNumber: String(req.body?.faxNumber ?? req.body?.fax_number ?? '').trim(),
        displayOrder: Number(req.body?.displayOrder ?? req.body?.display_order ?? 0) || 0,
        isActive: req.body?.isActive !== false && req.body?.is_active !== false,
        memo: String(req.body?.memo ?? '').trim(),
      })
      res.status(201).json({ company: created })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/insurance-claim/companies/:id', ...adminMw, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id)
      if (id == null) {
        res.status(400).json({ message: '잘못된 보험회사 ID입니다.' })
        return
      }
      const company = await getInsuranceCompanyById(pool, id)
      if (!company) {
        res.status(404).json({ message: '보험회사를 찾을 수 없습니다.' })
        return
      }
      const documents = await listCompanyDocuments(pool, id)
      res.json({ company, documents })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/admin/insurance-claim/companies/:id', ...adminMw, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id)
      if (id == null) {
        res.status(400).json({ message: '잘못된 보험회사 ID입니다.' })
        return
      }
      const existing = await getInsuranceCompanyById(pool, id)
      if (!existing) {
        res.status(404).json({ message: '보험회사를 찾을 수 없습니다.' })
        return
      }
      const patch = {}
      if (req.body?.companyName !== undefined || req.body?.company_name !== undefined) {
        patch.companyName = String(req.body?.companyName ?? req.body?.company_name ?? '').trim()
      }
      if (req.body?.companyType !== undefined || req.body?.company_type !== undefined) {
        const t = normalizeCompanyType(req.body?.companyType ?? req.body?.company_type)
        if (!t) {
          res.status(400).json({ message: '회사 구분이 올바르지 않습니다.' })
          return
        }
        patch.companyType = t
      }
      if (req.body?.faxNumber !== undefined || req.body?.fax_number !== undefined) {
        patch.faxNumber = String(req.body?.faxNumber ?? req.body?.fax_number ?? '').trim()
      }
      if (req.body?.displayOrder !== undefined || req.body?.display_order !== undefined) {
        patch.displayOrder = Number(req.body?.displayOrder ?? req.body?.display_order ?? 0) || 0
      }
      if (req.body?.isActive !== undefined || req.body?.is_active !== undefined) {
        patch.isActive = req.body?.isActive !== false && req.body?.is_active !== false
      }
      if (req.body?.memo !== undefined) {
        patch.memo = String(req.body?.memo ?? '').trim()
      }
      const updated = await updateInsuranceCompany(pool, id, patch)
      res.json({ company: updated })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post(
    '/admin/insurance-claim/companies/:id/documents/upload',
    ...adminMw,
    uploadPdf.array('pdf', MAX_PDF_UPLOAD_FILES),
    async (req, res) => {
      try {
        const companyId = parsePositiveInt(req.params.id)
        const documentType = normalizeDocumentType(req.body?.documentType ?? req.body?.document_type)
        if (companyId == null) {
          res.status(400).json({ message: '잘못된 보험회사 ID입니다.' })
          return
        }
        if (!documentType) {
          res.status(400).json({ message: '문서 유형이 올바르지 않습니다.' })
          return
        }
        const company = await getInsuranceCompanyById(pool, companyId)
        if (!company) {
          res.status(404).json({ message: '보험회사를 찾을 수 없습니다.' })
          return
        }
        const files = Array.isArray(req.files) ? req.files : []
        if (files.length === 0) {
          res.status(400).json({ message: 'PDF 파일을 선택해 주세요.' })
          return
        }
        const totalBytes = files.reduce((sum, f) => sum + (f.buffer?.length ?? 0), 0)
        if (totalBytes > MAX_PDF_UPLOAD_BYTES_TOTAL) {
          res.status(400).json({ message: '업로드 용량 합계가 너무 큽니다.' })
          return
        }
        const merged = await mergePdfUploadBuffers(
          files.map((f) => ({
            buffer: f.buffer,
            fileName: String(f.originalname ?? 'document.pdf').trim() || 'document.pdf',
          })),
        )
        const storageKey = buildClaimDocumentStorageKey({ companyId, documentType })
        await putClaimDocumentObject(storageKey, merged.mergedBuffer)
        const title =
          String(req.body?.title ?? '').trim() ||
          (documentType === 'claim_form' ? '청구서' : documentType === 'consent_form' ? '동의서' : '추가서류')
        const fileName = files.length === 1 ? files[0].originalname : `${title}.pdf`
        const document = await upsertCompanyDocument(pool, {
          insuranceCompanyId: companyId,
          documentType,
          title,
          fileName,
          storageKey,
          pageCount: merged.pageCount,
          sourcePdfMetadata: merged.sourcePdfMetadata,
        })
        res.json({
          storageKey,
          pageCount: merged.pageCount,
          sourcePdfMetadata: merged.sourcePdfMetadata,
          document,
        })
      } catch (e) {
        handleDbError(e, req, res)
      }
    },
  )

  apiRouter.get('/admin/insurance-claim/documents/:documentId', ...adminMw, async (req, res) => {
    try {
      const documentId = parsePositiveInt(req.params.documentId)
      if (documentId == null) {
        res.status(400).json({ message: '잘못된 문서 ID입니다.' })
        return
      }
      const document = await getDocumentById(pool, documentId)
      if (!document) {
        res.status(404).json({ message: '문서를 찾을 수 없습니다.' })
        return
      }
      const fieldRows = await listDocumentFields(pool, documentId)
      res.json({ document, fields: fieldRows.map(claimFieldRowToDto) })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.put('/admin/insurance-claim/documents/:documentId/fields', ...adminMw, async (req, res) => {
    try {
      const documentId = parsePositiveInt(req.params.documentId)
      if (documentId == null) {
        res.status(400).json({ message: '잘못된 문서 ID입니다.' })
        return
      }
      const document = await getDocumentById(pool, documentId)
      if (!document) {
        res.status(404).json({ message: '문서를 찾을 수 없습니다.' })
        return
      }
      const rawFields = req.body?.fields
      if (!Array.isArray(rawFields)) {
        res.status(400).json({ message: 'fields 배열이 필요합니다.' })
        return
      }
      const normalized = normalizeFieldSpecList(rawFields)
      const existingMappings = await listDocumentFieldMappings(pool, documentId)
      const { mergedFields } = mergePdfFieldCustomerMappings({
        existingRows: existingMappings.map((row) => ({
          field_key: row.field_key,
          customer_mapping: row.data_mapping,
        })),
        rawFields,
        normalizedFields: normalized,
      })
      await replaceDocumentFields(pool, documentId, mergedFields)
      const fieldRows = await listDocumentFields(pool, documentId)
      res.json({ fields: fieldRows.map(claimFieldRowToDto) })
    } catch (e) {
      if (e?.name === 'FieldSpecValidationError') {
        res.status(400).json({ message: e.message })
        return
      }
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/insurance-claim/documents/:documentId/file', ...adminMw, async (req, res) => {
    try {
      const documentId = parsePositiveInt(req.params.documentId)
      if (documentId == null) {
        res.status(400).json({ message: '잘못된 문서 ID입니다.' })
        return
      }
      const document = await getDocumentById(pool, documentId)
      if (!document?.storageKey) {
        res.status(404).json({ message: '문서를 찾을 수 없습니다.' })
        return
      }
      const buf = await getClaimDocumentObject(document.storageKey)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline')
      res.send(buf)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  /** 청구 작성 화면 연동 준비 — 인증 사용자 */
  apiRouter.get('/insurance-claim/companies', requireAuth, async (req, res) => {
    try {
      const companies = await listActiveCompaniesForClaimFlow(pool)
      res.json({ companies })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/insurance-claim/companies/:id/documents', requireAuth, async (req, res) => {
    try {
      const companyId = parsePositiveInt(req.params.id)
      if (companyId == null) {
        res.status(400).json({ message: '잘못된 보험회사 ID입니다.' })
        return
      }
      const documentType = normalizeDocumentType(req.query?.documentType ?? req.query?.document_type)
      if (documentType) {
        const doc = await getActiveDocumentForCompany(pool, companyId, documentType)
        if (!doc) {
          res.status(404).json({ message: '활성 문서가 없습니다.' })
          return
        }
        const fieldRows = await listDocumentFields(pool, doc.id)
        res.json({
          document: doc,
          fields: fieldRows.map(claimFieldRowToDto),
        })
        return
      }
      const claimForm = await getActiveDocumentForCompany(pool, companyId, 'claim_form')
      const consentForm = await getActiveDocumentForCompany(pool, companyId, 'consent_form')
      res.json({ claimForm, consentForm })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
