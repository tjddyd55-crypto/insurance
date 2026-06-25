/**
 * 보험청구 ZIP 다운로드에 포함할 파일 목록을 조립한다.
 * @param {import('pg').Pool} pool
 * @param {number} gaId
 * @param {import('./repository/insuranceClaimRequestRepo.js').InsuranceClaimRequestDto} request
 */

function generatedDocumentZipBaseName(doc) {
  const docType = doc?.type ?? doc?.documentType
  if (docType === 'claim_form') {
    return '청구서.pdf'
  }
  const label = String(doc?.label ?? '동의서').replace(/\s+/g, '_')
  return `${label}.pdf`
}

export async function buildInsuranceClaimDownloadFiles(pool, gaId, request) {
  /** @type {Array<{ storageKey: string, fileName: string, contentType?: string }>} */
  const files = []
  /** @type {string[]} */
  const skipped = []
  let order = 0

  const generated = Array.isArray(request.generatedDocumentMetadata?.documents)
    ? request.generatedDocumentMetadata.documents
    : []
  generated.forEach((doc) => {
    const storageKey = String(doc?.storageKey ?? '').trim()
    if (!storageKey) {
      return
    }
    order += 1
    files.push({
      storageKey,
      fileName: `${String(order).padStart(2, '0')}_${generatedDocumentZipBaseName(doc)}`,
      contentType: 'application/pdf',
      source: 'generated',
    })
  })

  for (const meta of request.additionalAttachmentMetadata ?? []) {
    const storageKey = String(meta?.storageKey ?? '').trim()
    if (!storageKey) {
      continue
    }
    order += 1
    const baseName = String(meta?.fileName ?? 'file').trim() || 'file'
    files.push({
      storageKey,
      fileName: `${String(order).padStart(2, '0')}_추가첨부_${baseName}`,
      contentType: String(meta?.contentType ?? 'application/octet-stream'),
      source: 'claim_attachment',
    })
  }

  const selectedIds = (request.selectedCustomerAttachmentIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (selectedIds.length > 0 && request.customerId != null) {
    const { rows } = await pool.query(
      `
      SELECT
        f.id,
        f.storage_key,
        f.file_name,
        f.content_type,
        f.agent_id,
        f.request_id,
        g.code AS ga_code
      FROM customer_claim_request_files f
      INNER JOIN customers c ON c.id = f.customer_id
      INNER JOIN ga_companies g ON g.id = c.ga_id
      WHERE f.id = ANY($1::bigint[])
        AND f.customer_id = $2
        AND c.ga_id = $3
      `,
      [selectedIds, request.customerId, gaId],
    )
    const byId = new Map(rows.map((row) => [Number(row.id), row]))
    for (const id of selectedIds) {
      const row = byId.get(id)
      if (!row) {
        skipped.push(`고객첨부 ID ${id}`)
        continue
      }
      files.push({
        storageKey: String(row.storage_key ?? ''),
        fileName: `${String(++order).padStart(2, '0')}_고객첨부_${String(row.file_name ?? 'file')}`,
        contentType: String(row.content_type ?? 'application/octet-stream'),
        source: 'customer_app_attachment',
        agentId: String(row.agent_id ?? ''),
        requestId: Number(row.request_id),
        customerId: request.customerId,
        gaCode: String(row.ga_code ?? ''),
      })
    }
  }

  return { files, skipped }
}
