import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CUSTOMER_IMPORT_SOURCE_MODE } from '../../../../shared/ai-assistant/customer-import/importSourceMode.js'
import { runImportPipeline } from '../pipeline.js'

const BLOCK = `강지영
주민번호: 840210-1234567
핸드폰번호: 010-2902-7177
주소: 창원시 마산합포구 교방서1길 39`

describe('unstructured import field quality', () => {
  it('auto-eligible rows never store raw block in mapped.name', () => {
    const session = {
      importSourceMode: CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS,
      selectedSheetName: 'S',
      sheets: [{ name: 'S', matrix: [[BLOCK]] }],
      rows: [],
      unstructuredExtractDone: false,
    }
    const pipeline = runImportPipeline(session, { byPhone: new Map(), byName: new Map() })
    const auto = pipeline.rows.filter((r) => r.eligibleForCommit)
    for (const row of auto) {
      assert.ok(row.mapped.name)
      assert.ok(!row.mapped.name.includes('주민번호'))
      assert.ok(!row.mapped.name.includes('핸드폰'))
      const source = row.unstructuredMeta?.sourceCellText ?? ''
      if (source) {
        assert.notEqual(row.mapped.name.trim(), source.trim())
      }
    }
    assert.ok(pipeline.rows.some((r) => r.mapped.name === '강지영'))
  })
})
