import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDraft,
  duplicateAsDraft,
  isClaimRequestStatus,
  updateDraft,
} from './repository/insuranceClaimRequestRepo.js'

function row(overrides = {}) {
  return {
    id: 7, ga_id: 3, customer_id: null, insurance_company_id: 4, status: 'draft',
    insured_snapshot: { name: '수동 입력' }, contractor_snapshot: null, contractor_same_as_insured: true,
    claim_data: {}, payment_data: {}, signature_data: {}, selected_customer_attachment_ids: [],
    additional_attachment_metadata: [], generated_document_metadata: {}, source_claim_request_id: null,
    created_by: 9, created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
  }
}

test('claim request draft allows null customer_id and requires snapshot payload at API layer', async () => {
  const calls = []
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [row()] } } }
  const result = await createDraft(pool, {
    gaId: 3, customerId: null, insuranceCompanyId: 4, insuredSnapshot: { name: '수동 입력' }, createdBy: 9,
  })
  assert.equal(result.customerId, null)
  assert.deepEqual(result.insuredSnapshot, { name: '수동 입력' })
  assert.equal(calls[0].params[1], null)
})

test('draft update is allowed but generated request is immutable', async () => {
  const draftPool = { query: async (sql) => ({ rows: [row()] }) }
  const updated = await updateDraft(draftPool, 3, 7, { insuredSnapshot: { name: '수정' } })
  assert.deepEqual(updated.insuredSnapshot, { name: '수동 입력' })

  const generatedPool = { query: async () => ({ rows: [row({ status: 'generated' })] }) }
  await assert.rejects(
    () => updateDraft(generatedPool, 3, 7, { insuredSnapshot: { name: '수정' } }),
    { code: 'CLAIM_REQUEST_NOT_DRAFT' },
  )
})

test('duplicate creates a separate draft and preserves the source request id', async () => {
  let insertParams = null
  const pool = {
    query: async (sql, params) => {
      if (sql.includes('SELECT r.*')) return { rows: [row({ id: 11, customer_id: 42 })] }
      insertParams = params
      return { rows: [row({ id: 12, customer_id: 42, source_claim_request_id: 11 })] }
    },
  }
  const duplicate = await duplicateAsDraft(pool, 3, 11, 9)
  assert.equal(duplicate.id, 12)
  assert.equal(duplicate.sourceClaimRequestId, 11)
  assert.equal(insertParams[12], 11)
})

test('claim request status allowlist includes lifecycle values', () => {
  assert.equal(isClaimRequestStatus('draft'), true)
  assert.equal(isClaimRequestStatus('fax_sent'), true)
  assert.equal(isClaimRequestStatus('unknown'), false)
})
