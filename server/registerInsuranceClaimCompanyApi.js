/**
 * 보험청구 전용 보험회사 설정 API — 일반 pdf_templates 와 분리.
 */

import multer from 'multer'
import {
  fieldSpecWithDbMapping,
  normalizeFieldSpec,
  normalizeFieldSpecList,
} from '../pdf-engine/schema/fieldSpec.js'
import { inputRoleFromPdfFieldRow } from '../pdf-engine/schema/inputRole.js'
import { mergePdfFieldCustomerMappings } from '../pdf-engine/schema/fieldDataMapping.js'
import { mergePdfUploadBuffers } from '../pdf-engine/pdf/mergePdfBuffers.js'
import {
  buildClaimDocumentStorageKey,
  deleteClaimDocumentObject,
  getClaimDocumentObject,
  putClaimDocumentObject,
} from './insurance-claim/storage/claimDocumentStorage.js'
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

function parsePositiveInt(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return null
  return n
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

export function registerInsuranceClaimCompanyApi(apiRouter, { pool, requireAuth, handleDbError }) {
  const adminMw = [requireAuth, (req, res, next) => {
    if (!requireInsuranceClaimAdmin(req, res)) return
    next()
  }]

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
        const merged = await mergePdfUploadBuffers(files.map((f) => f.buffer))
        const storageKey = buildClaimDocumentStorageKey({ companyId, documentType })
        await putClaimDocumentObject(storageKey, merged.buffer)
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
