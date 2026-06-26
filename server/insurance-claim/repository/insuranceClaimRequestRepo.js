const CLAIM_STATUSES = new Set(['draft', 'generated', 'downloaded', 'fax_ready', 'fax_sent', 'failed', 'cancelled'])

/** @typedef {{ clause: string, params: unknown[] }} ClaimRequestScope */

function json(value, fallback) {
  return JSON.stringify(value ?? fallback)
}

function isEmptyPersonSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return true
  }
  return !String(snapshot.name ?? '').trim()
}

function mergeContractorSnapshotForUpdate(current, patch) {
  const next = { ...current, ...patch }
  if (next.contractorSameAsInsured === false && isEmptyPersonSnapshot(next.contractorSnapshot)) {
    if (!isEmptyPersonSnapshot(current.contractorSnapshot)) {
      next.contractorSnapshot = current.contractorSnapshot
    }
  }
  if (next.contractorSameAsInsured !== false) {
    next.contractorSnapshot = null
  }
  return next
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

function scopedWhere(scope, gaId, extraClause = '', extraParams = []) {
  const params = [...scope.params, ...extraParams, gaId]
  const gaPh = `$${scope.params.length + extraParams.length + 1}`
  const scopeSql = scope.clause
  const notDeleted = 'r.deleted_at IS NULL'
  if (extraClause) {
    return { sql: `r.ga_id = ${gaPh} AND ${notDeleted} AND (${scopeSql}) AND (${extraClause})`, params }
  }
  return { sql: `r.ga_id = ${gaPh} AND ${notDeleted} AND (${scopeSql})`, params }
}

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

export async function getById(pool, gaId, id, scope) {
  const p = scope.params.length
  const idPh = `$${p + 1}`
  const { sql, params } = scopedWhere(scope, gaId, `r.id = ${idPh}`, [id])
  const { rows } = await pool.query(`${SELECT_REQUEST} WHERE ${sql} LIMIT 1`, params)
  return rowToDto(rows[0])
}

export async function list(pool, gaId, scope) {
  const { sql, params } = scopedWhere(scope, gaId)
  const { rows } = await pool.query(
    `${SELECT_REQUEST} WHERE ${sql} ORDER BY r.created_at DESC, r.id DESC`,
    params,
  )
  return rows.map(rowToDto)
}

export async function listByCustomerId(pool, gaId, customerId, scope) {
  const p = scope.params.length
  const custPh = `$${p + 1}`
  const { sql, params } = scopedWhere(scope, gaId, `r.customer_id = ${custPh}`, [customerId])
  const { rows } = await pool.query(
    `${SELECT_REQUEST} WHERE ${sql} ORDER BY r.created_at DESC, r.id DESC`,
    params,
  )
  return rows.map(rowToDto)
}

export async function updateDraft(pool, gaId, id, patch, scope) {
  const current = await getById(pool, gaId, id, scope)
  if (!current) return null
  if (current.status !== 'draft') {
    const error = new Error('draft 상태의 청구만 수정할 수 있습니다.')
    error.code = 'CLAIM_REQUEST_NOT_DRAFT'
    throw error
  }
  const next = mergeContractorSnapshotForUpdate(current, patch)
  const updateValues = [
    next.customerId ?? null, next.insuranceCompanyId, json(next.insuredSnapshot, {}),
    next.contractorSnapshot ? json(next.contractorSnapshot, {}) : null, next.contractorSameAsInsured !== false,
    json(next.claimData, {}), json(next.paymentData, {}), json(next.signatureData, {}),
    json(next.selectedCustomerAttachmentIds, []), json(next.additionalAttachmentMetadata, []),
  ]
  const p = scope.params.length
  const idPh = `$${p + 1}`
  const gaPh = `$${p + 2}`
  const start = p + 3
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests r SET
       customer_id = $${start}, insurance_company_id = $${start + 1}, insured_snapshot = CAST($${start + 2} AS jsonb),
       contractor_snapshot = CAST($${start + 3} AS jsonb), contractor_same_as_insured = $${start + 4},
       claim_data = CAST($${start + 5} AS jsonb), payment_data = CAST($${start + 6} AS jsonb), signature_data = CAST($${start + 7} AS jsonb),
       selected_customer_attachment_ids = CAST($${start + 8} AS jsonb), additional_attachment_metadata = CAST($${start + 9} AS jsonb),
       updated_at = NOW()
     WHERE r.id = ${idPh} AND r.ga_id = ${gaPh} AND r.deleted_at IS NULL AND r.status = 'draft' AND (${scope.clause})
     RETURNING *`,
    [...scope.params, id, gaId, ...updateValues],
  )
  return rowToDto(rows[0])
}

export async function markGenerated(pool, gaId, id, metadata, scope) {
  const p = scope.params.length
  const idPh = `$${p + 1}`
  const metaPh = `$${p + 2}`
  const gaPh = `$${p + 3}`
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests r SET status = 'generated', generated_document_metadata = CAST(${metaPh} AS jsonb), updated_at = NOW()
     WHERE r.id = ${idPh} AND r.ga_id = ${gaPh} AND r.deleted_at IS NULL AND r.status = 'draft' AND (${scope.clause})
     RETURNING *`,
    [...scope.params, id, json(metadata, {}), gaId],
  )
  return rowToDto(rows[0])
}

export async function markDownloaded(pool, gaId, id, scope) {
  const p = scope.params.length
  const idPh = `$${p + 1}`
  const gaPh = `$${p + 2}`
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests r SET status = 'downloaded', updated_at = NOW()
     WHERE r.id = ${idPh} AND r.ga_id = ${gaPh} AND r.deleted_at IS NULL AND r.status IN ('generated', 'downloaded') AND (${scope.clause})
     RETURNING *`,
    [...scope.params, id, gaId],
  )
  return rowToDto(rows[0])
}

export async function softDelete(pool, gaId, id, deletedBy, scope) {
  const p = scope.params.length
  const idPh = `$${p + 1}`
  const gaPh = `$${p + 2}`
  const deletedByPh = `$${p + 3}`
  const { rows } = await pool.query(
    `UPDATE insurance_claim_requests r SET deleted_at = NOW(), deleted_by = ${deletedByPh}, updated_at = NOW()
     WHERE r.id = ${idPh} AND r.ga_id = ${gaPh} AND r.deleted_at IS NULL AND (${scope.clause})
     RETURNING r.id`,
    [...scope.params, id, gaId, deletedBy ?? null],
  )
  return rows[0] ? { id: rows[0].id } : null
}

export async function duplicateAsDraft(pool, gaId, id, createdBy, scope) {
  const source = await getById(pool, gaId, id, scope)
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
