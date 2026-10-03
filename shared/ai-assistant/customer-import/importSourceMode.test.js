import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CUSTOMER_IMPORT_SOURCE_MODE,
  detectWorkbookImportSourceMode,
} from './importSourceMode.js'

describe('import source mode detection', () => {
  it('detects unstructured legacy-like workbook shape', () => {
    const matrix = Array.from({ length: 8 }, () =>
      Array.from({ length: 120 }, (_, i) => (i === 0 ? '홍길동\n010-1234-5678\n서울' : '')),
    )
    const mode = detectWorkbookImportSourceMode([{ name: '고객정보', matrix }])
    assert.equal(mode, CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS)
  })

  it('keeps tabular workbook as TABULAR', () => {
    const matrix = [
      ['이름', '휴대폰'],
      ['홍길동', '01012345678'],
    ]
    const mode = detectWorkbookImportSourceMode([{ name: 'Sheet1', matrix }])
    assert.equal(mode, CUSTOMER_IMPORT_SOURCE_MODE.TABULAR)
  })
})
