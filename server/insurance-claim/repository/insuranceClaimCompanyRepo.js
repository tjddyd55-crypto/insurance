import { serializeFieldDataMapping } from '../../pdf-engine/schema/fieldDataMapping.js'

const COMPANY_TYPES = new Set(['life', 'non_life', 'mutual', 'other'])
const DOCUMENT_TYPES = new Set(['claim_form', 'consent_form', 'extra_form'])

export function normalizeCompanyType(raw) {
  const t = String(raw ?? '').trim().toLowerCase()
  return COMPANY_TYPES.has(t) ? t : null
}

export function normalizeDocumentType(raw) {
  const t = String(raw ?? '').trim().toLowerCase()
  return DOCUMENT_TYPES.has(t) ? t : null
}

function companyRowToDto(row, docSummary = null) {
  return {
    id: row.id,
    companyName: row.company_name,
    companyType: row.company_type,
    faxNumber: row.fax_number ?? '',
    displayOrder: row.display_order,
    isActive: row.is_active,
    memo: row.memo ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    claimFormConfigured: docSummary?.claimFormConfigured ?? false,
    consentFormConfigured: docSummary?.consentFormConfigured ?? false,
    coordinatesConfigured: docSummary?.coordinatesConfigured ?? false,
  }
}

function documentRowToDto(row, fieldCount = 0) {
  return {
    id: row.id,
    insuranceCompanyId: row.insurance_company_id,
    documentType: row.document_type,
    title: row.title ?? '',
    fileName: row.file_name ?? '',
    storageKey: row.storage_key ?? '',
    pageCount: row.page_count,
    sourcePdfMetadata: Array.isArray(row.source_pdf_metadata) ? row.source_pdf_metadata : null,
    isActive: row.is_active,
    fieldCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadDocumentSummary(pool, companyId) {
  const { rows } = await pool.query(
    `
    SELECT d.document_type,
           (d.storage_key IS NOT NULL AND d.storage_key <> '' AND d.page_count > 0) AS pdf_ok,
           EXISTS (
             SELECT 1 FROM insurance_company_claim_document_fields f
             WHERE f.document_id = d.id
           ) AS has_fields
    FROM insurance_company_claim_documents d
    WHERE d.insurance_company_id = $1 AND d.is_active = true
    `,
    [companyId],
  )
  let claimFormConfigured = false
  let consentFormConfigured = false
  let coordinatesConfigured = false
  for (const row of rows) {
    if (row.document_type === 'claim_form' && row.pdf_ok) claimFormConfigured = true
    if (row.document_type === 'consent_form' && row.pdf_ok) consentFormConfigured = true
    if (row.has_fields) coordinatesConfigured = true
  }
  return { claimFormConfigured, consentFormConfigured, coordinatesConfigured }
}

export async function listInsuranceCompanies(pool, { includeInactive = true } = {}) {
  const where = includeInactive ? '' : 'WHERE is_active = true'
  const { rows } = await pool.query(
    `
    SELECT c.*
    FROM insurance_companies c
    ${where}
    ORDER BY c.company_type ASC, c.display_order ASC, c.company_name ASC
    `,
  )
  const out = []
  for (const row of rows) {
    const summary = await loadDocumentSummary(pool, row.id)
    out.push(companyRowToDto(row, summary))
  }
  return out
}

export async function getInsuranceCompanyById(pool, id) {
  const { rows } = await pool.query(`SELECT * FROM insurance_companies WHERE id = $1 LIMIT 1`, [id])
  const row = rows[0]
  if (!row) return null
  const summary = await loadDocumentSummary(pool, id)
  return companyRowToDto(row, summary)
}

export async function createInsuranceCompany(pool, input) {
  const { rows } = await pool.query(
    `
    INSERT INTO insurance_companies
      (company_name, company_type, fax_number, display_order, is_active, memo)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      input.companyName,
      input.companyType,
      input.faxNumber ?? '',
      input.displayOrder ?? 0,
      input.isActive !== false,
      input.memo ?? '',
    ],
  )
  return companyRowToDto(rows[0])
}

export async function updateInsuranceCompany(pool, id, patch) {
  const sets = []
  const params = []
  if (patch.companyName !== undefined) {
    params.push(patch.companyName)
    sets.push(`company_name = $${params.length}`)
  }
  if (patch.companyType !== undefined) {
    params.push(patch.companyType)
    sets.push(`company_type = $${params.length}`)
  }
  if (patch.faxNumber !== undefined) {
    params.push(patch.faxNumber)
    sets.push(`fax_number = $${params.length}`)
  }
  if (patch.displayOrder !== undefined) {
    params.push(patch.displayOrder)
    sets.push(`display_order = $${params.length}`)
  }
  if (patch.isActive !== undefined) {
    params.push(Boolean(patch.isActive))
    sets.push(`is_active = $${params.length}`)
  }
  if (patch.memo !== undefined) {
    params.push(patch.memo)
    sets.push(`memo = $${params.length}`)
  }
  if (sets.length === 0) return getInsuranceCompanyById(pool, id)
  sets.push('updated_at = NOW()')
  params.push(id)
  await pool.query(`UPDATE insurance_companies SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
  return getInsuranceCompanyById(pool, id)
}

export async function listCompanyDocuments(pool, companyId) {
  const { rows } = await pool.query(
    `
    SELECT d.*,
           (SELECT COUNT(*)::int FROM insurance_company_claim_document_fields f WHERE f.document_id = d.id) AS field_count
    FROM insurance_company_claim_documents d
    WHERE d.insurance_company_id = $1
    ORDER BY d.document_type ASC
    `,
    [companyId],
  )
  return rows.map((row) => documentRowToDto(row, Number(row.field_count ?? 0)))
}

export async function getDocumentById(pool, documentId) {
  const { rows } = await pool.query(
    `
    SELECT d.*,
           (SELECT COUNT(*)::int FROM insurance_company_claim_document_fields f WHERE f.document_id = d.id) AS field_count
    FROM insurance_company_claim_documents d
    WHERE d.id = $1
    LIMIT 1
    `,
    [documentId],
  )
  const row = rows[0]
  if (!row) return null
  return documentRowToDto(row, Number(row.field_count ?? 0))
}

export async function upsertCompanyDocument(pool, input) {
  const metadataJson =
    Array.isArray(input.sourcePdfMetadata) && input.sourcePdfMetadata.length > 0
      ? JSON.stringify(input.sourcePdfMetadata)
      : null
  const { rows } = await pool.query(
    `
    INSERT INTO insurance_company_claim_documents
      (insurance_company_id, document_type, title, file_name, storage_key, page_count, source_pdf_metadata, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS jsonb), true)
    ON CONFLICT (insurance_company_id, document_type)
    DO UPDATE SET
      title = EXCLUDED.title,
      file_name = EXCLUDED.file_name,
      storage_key = EXCLUDED.storage_key,
      page_count = EXCLUDED.page_count,
      source_pdf_metadata = EXCLUDED.source_pdf_metadata,
      is_active = true,
      updated_at = NOW()
    RETURNING *
    `,
    [
      input.insuranceCompanyId,
      input.documentType,
      input.title ?? '',
      input.fileName ?? '',
      input.storageKey,
      input.pageCount,
      metadataJson,
    ],
  )
  return documentRowToDto(rows[0], 0)
}

export async function listDocumentFields(pool, documentId) {
  const { rows } = await pool.query(
    `
    SELECT id, document_id, field_key, label, field_type, required, order_index,
           input_order, data_mapping, options, placements, created_at, updated_at
    FROM insurance_company_claim_document_fields
    WHERE document_id = $1
    ORDER BY COALESCE(input_order, order_index) ASC, order_index ASC, id ASC
    `,
    [documentId],
  )
  return rows
}

export async function listDocumentFieldMappings(pool, documentId) {
  const { rows } = await pool.query(
    `SELECT field_key, data_mapping FROM insurance_company_claim_document_fields WHERE document_id = $1`,
    [documentId],
  )
  return rows
}

export async function replaceDocumentFields(pool, documentId, fields) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM insurance_company_claim_document_fields WHERE document_id = $1`, [documentId])
    for (let i = 0; i < fields.length; i += 1) {
      const f = fields[i]
      const optionsJson =
        (f.fieldType === 'radio' || f.fieldType === 'checkbox') && Array.isArray(f.options)
          ? JSON.stringify(f.options)
          : null
      const mappingSerialized = serializeFieldDataMapping(f.dataMapping)
      await client.query(
        `
        INSERT INTO insurance_company_claim_document_fields
          (document_id, field_key, label, field_type, required, order_index, input_order,
           data_mapping, options, placements)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS jsonb), CAST($9 AS jsonb), CAST($10 AS jsonb))
        `,
        [
          documentId,
          f.fieldKey,
          f.label,
          f.fieldType,
          f.required,
          f.orderIndex ?? i,
          f.inputOrder ?? null,
          mappingSerialized,
          optionsJson,
          JSON.stringify(f.placements ?? []),
        ],
      )
    }
    await client.query(
      `UPDATE insurance_company_claim_documents SET updated_at = NOW() WHERE id = $1`,
      [documentId],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** 청구 작성 화면 연동용 — 활성 회사 + 문서 메타 */
export async function listActiveCompaniesForClaimFlow(pool) {
  const { rows } = await pool.query(
    `
    SELECT id, company_name, company_type, fax_number, display_order
    FROM insurance_companies
    WHERE is_active = true
    ORDER BY company_type ASC, display_order ASC, company_name ASC
    `,
  )
  return rows.map((row) => ({
    id: row.id,
    companyName: row.company_name,
    companyType: row.company_type,
    faxNumber: row.fax_number ?? '',
    displayOrder: row.display_order,
  }))
}

export async function getActiveDocumentForCompany(pool, companyId, documentType) {
  const { rows } = await pool.query(
    `
    SELECT *
    FROM insurance_company_claim_documents
    WHERE insurance_company_id = $1 AND document_type = $2 AND is_active = true
      AND storage_key IS NOT NULL AND storage_key <> '' AND page_count > 0
    LIMIT 1
    `,
    [companyId, documentType],
  )
  const row = rows[0]
  if (!row) return null
  return documentRowToDto(row)
}
