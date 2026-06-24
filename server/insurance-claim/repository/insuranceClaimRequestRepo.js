const CLAIM_STATUSES = new Set(['draft', 'generated', 'downloaded', 'fax_ready', 'fax_sent', 'failed', 'cancelled'])

function json(value, fallback) {
  return JSON.stringify(value ?? fallback)
}

function rowToDto(row) {
  if (!row) return null
  return {
    id: row.id,
    gaId: row.ga_id,
    customerId: row.customer_id,
    insuranceCompanyId: row.insurance_company_id,
    insuranceCompanyName: row.insurance_company_name ?? null,
    status: row.status,
    insuredSnapshot: row.insured_snapshot,
    contractorSnapshot: row.contractor_snapshot,
    contractorSameAsInsured: row.contractor_same_as_insured,
    claimData: row.claim_data ?? {},
    paymentData: row.payment_data ?? {},
    signatureData: row.signature_data ?? {},
    selectedCustomerAttachmentIds: row.selected_customer_attachment_ids ?? [],
    additionalAttachmentMetadata: row.additional_attachment_metadata ?? [],
    generatedDocumentMetadata: row.generated_document_metadata ?? {},
    sourceClaimRequestId: row.source_claim_request_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const SELECT_REQUEST = `
  SELECT r.*, c.company_name AS insurance_company_name
  FROM insurance_claim_requests r
  JOIN insurance_companies c ON c.id = r.insurance_company_id
`

export function isClaimRequestStatus(value) {
  return CLAIM_STATUSES.has(String(value ?? '').trim())
}

export async function createDraft(pool, input) {
  const { rows } = await pool.query(
    `
    INSERT INTO insurance_claim_requests
      (ga_id, customer_id, insurance_company_id, status, insured_snapshot, contractor_snapshot,
       contractor_same_as_insured, claim_data, payment_data, signature_data,
       selected_customer_attachment_ids, additional_attachment_metadata, generated_document_metadata,
       source_claim_request_id, created_by)
    VALUES ($1, $2, $3, 'draft', CAST($4 AS jsonb), CAST($5 AS jsonb), $6,
            CAST($7 AS jsonb), CAST($8 AS jsonb), CAST($9 AS jsonb), CAST($10 AS jsonb),
            CAST($11 AS jsonb), CAST($12 AS jsonb), $13, $14)
    RETURNING *
    `,
    [
      input.gaId, input.customerId ?? null, input.insuranceCompanyId, json(input.insuredSnapshot, {}),
      input.contractorSnapshot ? json(input.contractorSnapshot, {}) : null,
      input.contractorSameAsInsured !== false, json(input.claimData, {}), json(input.paymentData, {}),
      json(input.signatureData, {}), json(input.selectedCustomerAttachmentIds, []),
      json(input.additionalAttachmentMetadata, []), json(input.generatedDocumentMetadata, {}),
      input.sourceClaimRequestId ?? null, input.createdBy ?? null,
    ],
  )
  return rowToDto(rows[0])
}

export async function getById(pool, gaId, id) {
  const { rows } = await pool.query(`${SELECT_REQUEST} WHERE r.id = $1 AND r.ga_id = $2 LIMIT 1`, [id, gaId])
  return rowToDto(rows[0])
}

export async function list(pool, gaId) {
  const { rows } = await pool.query(`${SELECT_REQUEST} WHERE r.ga_id = $1 ORDER BY r.created_at DESC, r.id DESC`, [gaId])
  return rows.map(rowToDto)
}

export async function listByCustomerId(pool, gaId, customerId) {
  const { rows } = await pool.query(
    `${SELECT_REQUEST} WHERE r.ga_id = $1 AND r.customer_id = $2 ORDER BY r.created_at DESC, r.id DESC`,
    [gaId, customerId],
  )
  return rows.map(rowToDto)
}

export async function updateDraft(pool, gaId, id, patch) {
  const current = await getById(pool, gaId, id)
  if (!current) return null
  if (current.status !== 'draft') {
    const error = new Error('draft 상태의 청구만 수정할 수 있습니다.')
    error.code = 'CLAIM_REQUEST_NOT_DRAFT'
    throw error
  }
  const next = { ...current, ...patch }
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests SET
       customer_id = $1, insurance_company_id = $2, insured_snapshot = CAST($3 AS jsonb),
       contractor_snapshot = CAST($4 AS jsonb), contractor_same_as_insured = $5,
       claim_data = CAST($6 AS jsonb), payment_data = CAST($7 AS jsonb), signature_data = CAST($8 AS jsonb),
       selected_customer_attachment_ids = CAST($9 AS jsonb), additional_attachment_metadata = CAST($10 AS jsonb),
       updated_at = NOW()
     WHERE id = $11 AND ga_id = $12 RETURNING *`,
    [
      next.customerId ?? null, next.insuranceCompanyId, json(next.insuredSnapshot, {}),
      next.contractorSnapshot ? json(next.contractorSnapshot, {}) : null, next.contractorSameAsInsured !== false,
      json(next.claimData, {}), json(next.paymentData, {}), json(next.signatureData, {}),
      json(next.selectedCustomerAttachmentIds, []), json(next.additionalAttachmentMetadata, []), id, gaId,
    ],
  )
  return rowToDto(rows[0])
}

export async function markGenerated(pool, gaId, id, metadata) {
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests SET status = 'generated', generated_document_metadata = CAST($1 AS jsonb), updated_at = NOW()
     WHERE id = $2 AND ga_id = $3 AND status = 'draft' RETURNING *`,
    [json(metadata, {}), id, gaId],
  )
  return rowToDto(rows[0])
}

export async function markDownloaded(pool, gaId, id) {
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests SET status = 'downloaded', updated_at = NOW()
     WHERE id = $1 AND ga_id = $2 AND status IN ('generated', 'downloaded') RETURNING *`, [id, gaId],
  )
  return rowToDto(rows[0])
}

export async function duplicateAsDraft(pool, gaId, id, createdBy) {
  const source = await getById(pool, gaId, id)
  if (!source) return null
  return createDraft(pool, {
    gaId, customerId: source.customerId, insuranceCompanyId: source.insuranceCompanyId,
    insuredSnapshot: source.insuredSnapshot, contractorSnapshot: source.contractorSnapshot,
    contractorSameAsInsured: source.contractorSameAsInsured, claimData: source.claimData,
    paymentData: source.paymentData, signatureData: source.signatureData,
    selectedCustomerAttachmentIds: source.selectedCustomerAttachmentIds,
    additionalAttachmentMetadata: source.additionalAttachmentMetadata,
    generatedDocumentMetadata: {}, sourceClaimRequestId: source.id, createdBy,
  })
}
