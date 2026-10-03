import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CUSTOMER_IMPORT_ROW_STATUS } from '../../../shared/ai-assistant/customer-import/constants.js'
import { validateMappedCustomerRow } from '../../../shared/ai-assistant/customer-import/validate.js'
import { runImportPipeline } from './pipeline.js'
import { canAutoCommitCandidate, toCustomerCandidateView } from './customerCandidate.js'
import { CUSTOMER_IMPORT_SOURCE_MODE } from '../../../shared/ai-assistant/customer-import/importSourceMode.js'

function tabularSession(matrix, headers, headerRowIndex = 0) {
  return {
    importSourceMode: CUSTOMER_IMPORT_SOURCE_MODE.TABULAR,
    selectedSheetName: 'S',
    sheets: [{ name: 'S', matrix }],
    headerRowIndex,
    headers,
    columnMapping: { col_0: 'name', col_1: 'phone' },
    rows: [],
    unstructuredExtractDone: false,
  }
}

describe('CustomerCandidate contract', () => {
  it('TABULAR source produces candidates through shared pipeline', () => {
    const matrix = [['이름', '휴대폰'], ['홍길동', '01012345678']]
    const crmIndex = { byPhone: new Map(), byName: new Map() }
    const pipeline = runImportPipeline(tabularSession(matrix, ['이름', '휴대폰']), crmIndex)
    assert.equal(pipeline.rows.length, 1)
    const view = toCustomerCandidateView(pipeline.rows[0])
    assert.equal(view.mapped.name, '홍길동')
    assert.equal(view.mapped.phone, '01012345678')
    assert.equal(canAutoCommitCandidate(pipeline.rows[0]), pipeline.rows[0].eligibleForCommit)
  })

  it('REVIEW_REQUIRED cannot auto-commit', () => {
    const row = {
      rowId: 'x',
      sourceRowNumber: 1,
      mapped: { name: 'A', phone: '01011112222' },
      status: CUSTOMER_IMPORT_ROW_STATUS.WARNING,
      reasons: ['REVIEW_REQUIRED'],
      eligibleForCommit: false,
    }
    assert.equal(canAutoCommitCandidate(row), false)
  })

  it('invalid candidate cannot auto-commit', () => {
    const validated = validateMappedCustomerRow({ phone: '01012345678' })
    const row = {
      rowId: 'y',
      mapped: validated.mapped,
      status: validated.status,
      reasons: validated.reasons,
      eligibleForCommit: false,
    }
    assert.equal(canAutoCommitCandidate(row), false)
  })
})
