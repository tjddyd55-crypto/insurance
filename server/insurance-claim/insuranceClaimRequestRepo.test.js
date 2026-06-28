import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDraft,
  createDraftsBatch,
  duplicateAsDraft,
  isClaimRequestStatus,
  updateDraft,
} from './repository/insuranceClaimRequestRepo.js'

const OPEN_SCOPE = { clause: '(TRUE)', params: [] }

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
  const updated = await updateDraft(draftPool, 3, 7, { insuredSnapshot: { name: '수정' } }, OPEN_SCOPE)
  assert.deepEqual(updated.insuredSnapshot, { name: '수동 입력' })

  const generatedPool = { query: async () => ({ rows: [row({ status: 'generated' })] }) }
  await assert.rejects(
    () => updateDraft(generatedPool, 3, 7, { insuredSnapshot: { name: '수정' } }, OPEN_SCOPE),
    { code: 'CLAIM_REQUEST_NOT_DRAFT' },
  )
})

test('updateDraft preserves contractor snapshot when patch sends empty contractor with same=false', async () => {
  const existing = row({
    contractor_same_as_insured: false,
    contractor_snapshot: { name: '계약자', ssn: '800202-2345678', phone: '010-3333-4444' },
  })
  let updateParams = null
  const pool = {
    query: async (sql, params) => {
      if (sql.includes('SELECT')) return { rows: [existing] }
      updateParams = params
      return {
        rows: [
          row({
            contractor_same_as_insured: false,
            contractor_snapshot: { name: '계약자', ssn: '800202-2345678', phone: '010-3333-4444' },
          }),
        ],
      }
    },
  }
  await updateDraft(pool, 3, 7, {
    insuranceCompanyId: 4,
    insuredSnapshot: existing.insured_snapshot,
    contractorSameAsInsured: false,
    contractorSnapshot: { name: '', ssn: '', phone: '', address: '', job: '' },
  }, OPEN_SCOPE)
  assert.equal(JSON.parse(updateParams[5]).name, '계약자')
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
  const duplicate = await duplicateAsDraft(pool, 3, 11, 9, OPEN_SCOPE)
  assert.equal(duplicate.id, 12)
  assert.equal(duplicate.sourceClaimRequestId, 11)
  assert.equal(insertParams[12], 11)
})

test('createDraftsBatch creates one draft per insurance company in a transaction', async () => {
  const calls = []
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] }
      }
      return { rows: [row({ id: calls.length, insurance_company_id: params[2] })] }
    },
    release: () => {},
  }
  const pool = {
    connect: async () => client,
  }
  const results = await createDraftsBatch(
    pool,
    {
      gaId: 3,
      customerId: null,
      insuredSnapshot: { name: '수동 입력' },
      createdBy: 9,
    },
    [4, 5],
  )
  assert.equal(results.length, 2)
  assert.equal(results[0].insuranceCompanyId, 4)
  assert.equal(results[1].insuranceCompanyId, 5)
  assert.equal(calls.some((call) => call.sql === 'BEGIN'), true)
  assert.equal(calls.some((call) => call.sql === 'COMMIT'), true)
})

test('claim request status allowlist includes lifecycle values', () => {
  assert.equal(isClaimRequestStatus('draft'), true)
  assert.equal(isClaimRequestStatus('fax_sent'), true)
  assert.equal(isClaimRequestStatus('unknown'), false)
})
