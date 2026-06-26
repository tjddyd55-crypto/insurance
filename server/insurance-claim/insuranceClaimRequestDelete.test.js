import assert from 'node:assert/strict'
import test from 'node:test'

import { collectClaimRequestStorageKeys } from './collectClaimRequestStorageKeys.js'
import { deleteClaimRequestStoredFiles } from './deleteClaimRequestStoredFiles.js'
import {
  getById,
  list,
  softDelete,
} from './repository/insuranceClaimRequestRepo.js'

const OPEN_SCOPE = { clause: '(TRUE)', params: [] }
const BLOCKED_SCOPE = { clause: '(FALSE)', params: [] }

function row(overrides = {}) {
  return {
    id: 7,
    ga_id: 3,
    customer_id: 42,
    insurance_company_id: 4,
    insurance_company_name: '삼성화재',
    status: 'generated',
    insured_snapshot: { name: '홍길동' },
    contractor_snapshot: null,
    contractor_same_as_insured: true,
    claim_data: {},
    payment_data: {},
    signature_data: {
      insuredSignature: { storageKey: 'insurance-claim-requests/7/signatures/insured.png' },
    },
    selected_customer_attachment_ids: [901],
    additional_attachment_metadata: [{ storageKey: 'insurance-claim-requests/7/attachments/extra.pdf' }],
    generated_document_metadata: {
      documents: [
        { storageKey: 'insurance-claim-documents/company-4/generated-7-claim_form.pdf' },
        { storageKey: 'insurance-claim-documents/company-4/generated-7-consent_form-insured.pdf' },
      ],
    },
    source_claim_request_id: null,
    created_by: 9,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

test('softDelete marks deleted_at and hides row from list/getById', async () => {
  const state = row()
  const pool = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE insurance_claim_requests r SET deleted_at')) {
        state.deleted_at = '2026-06-26T00:00:00.000Z'
        state.deleted_by = params.at(-1)
        return { rows: [{ id: state.id }] }
      }
      if (sql.includes('SELECT r.*') && sql.includes('deleted_at IS NULL')) {
        return { rows: state.deleted_at ? [] : [state] }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
  }

  const deleted = await softDelete(pool, 3, 7, 9, OPEN_SCOPE)
  assert.deepEqual(deleted, { id: 7 })
  assert.equal(state.deleted_by, 9)

  assert.equal(await getById(pool, 3, 7, OPEN_SCOPE), null)
  assert.deepEqual(await list(pool, 3, OPEN_SCOPE), [])
})

test('softDelete returns null when scope blocks access', async () => {
  let updateCalled = false
  const pool = {
    query: async (sql) => {
      if (sql.includes('UPDATE insurance_claim_requests')) {
        updateCalled = true
      }
      return { rows: [] }
    },
  }

  const deleted = await softDelete(pool, 3, 7, 9, BLOCKED_SCOPE)
  assert.equal(deleted, null)
  assert.equal(updateCalled, true)
})

test('collectClaimRequestStorageKeys excludes customer app attachment ids', () => {
  const keys = collectClaimRequestStorageKeys(row())
  assert.equal(keys.includes('customer-claim-request-files/901'), false)
  assert.match(keys.join(' '), /generated-7-claim_form/)
  assert.match(keys.join(' '), /attachments\/extra.pdf/)
  assert.match(keys.join(' '), /signatures\/insured.png/)
})

test('deleteClaimRequestStoredFiles continues after individual delete failure', async () => {
  const deletedKeys = []
  const result = await deleteClaimRequestStoredFiles(
    ['ok-key', 'fail-key', 'missing-key'],
    { warn() {} },
    async (key) => {
      if (key === 'fail-key') {
        throw new Error('network down')
      }
      deletedKeys.push(key)
    },
  )

  assert.deepEqual(deletedKeys, ['ok-key', 'missing-key'])
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].key, 'fail-key')
})
