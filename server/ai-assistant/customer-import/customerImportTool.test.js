import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import * as XLSX from 'xlsx'

import { clearCustomerImportSessions } from './sessionStore.js'
import { CUSTOMER_IMPORT_TOOL_KEYS, executeCustomerImportTool } from './toolExecutor.js'

function makeReq(user = { id: 'user-1', userId: 'user-1', gaId: 1, role: 'USER', customerAccess: 'own' }) {
  return { user }
}

function buildXlsxBuffer(rows, sheetName = 'Sheet1') {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

const mockPool = {
  connect: async () => ({
    query: async (sql) => {
      if (String(sql).includes('BEGIN') || String(sql).includes('COMMIT') || String(sql).includes('ROLLBACK')) {
        return { rows: [] }
      }
      if (String(sql).includes('FROM customers')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [{ id: 99, name: 'created' }], rowCount: 1 }
    },
    release() {},
  }),
  query: async () => ({ rows: [], rowCount: 0 }),
}

describe('customer import tool executor', () => {
  beforeEach(() => {
    clearCustomerImportSessions()
  })

  it('file-analyze creates session without DB write', async () => {
    const buffer = buildXlsxBuffer([
      ['이름', '휴대폰번호'],
      ['홍길동', '01099998888'],
    ])
    const result = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: buffer,
      originalFileName: 'customers.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    assert.ok(result.importSessionId)
    assert.equal(result.fileType, 'xlsx')
    assert.ok(result.headers.length >= 1)
  })

  it('preview does not commit customers', async () => {
    const buffer = buildXlsxBuffer([
      ['이름', '휴대폰번호'],
      ['홍길동', '01099998888'],
    ])
    const analyzed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: buffer,
      originalFileName: 'customers.xlsx',
    })
    const preview = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW, {
      importSessionId: analyzed.importSessionId,
    })
    assert.ok(preview.previewVersionHash)
    assert.equal(preview.summary.plannedCreate, 1)
  })

  it('commit requires confirmation', async () => {
    const buffer = buildXlsxBuffer([
      ['이름', '휴대폰번호'],
      ['홍길동', '01099998888'],
    ])
    const analyzed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: buffer,
      originalFileName: 'customers.xlsx',
    })
    await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW, {
      importSessionId: analyzed.importSessionId,
    })
    await assert.rejects(
      () =>
        executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, {
          importSessionId: analyzed.importSessionId,
          previewVersionHash: analyzed.previewVersionHash,
        }),
      (e) => e.code === 'CONFIRMATION_REQUIRED' || e.code === 'PREVIEW_REQUIRED',
    )
  })

  it('supports multi-sheet workbook and explicit sheet-select', async () => {
    const buffer = buildXlsxBuffer([['이름'], ['A']], 'SheetA')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['이름'], ['B']]), 'SheetB')
    const multi = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const analyzed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: multi,
      originalFileName: 'multi.xlsx',
    })
    assert.equal(analyzed.sheets.length, 2)
    const selected = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.SHEET_SELECT, {
      importSessionId: analyzed.importSessionId,
      sheetName: 'SheetB',
    })
    assert.equal(selected.selectedSheetName, 'SheetB')
  })

  it('analyzes UTF-8 CSV', async () => {
    const csv = Buffer.from('이름,휴대폰번호\n김철수,010-1111-2222\n', 'utf8')
    const result = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: csv,
      originalFileName: 'list.csv',
      mimeType: 'text/csv',
    })
    assert.equal(result.fileType, 'csv')
    assert.ok(result.headers.some((h) => h.includes('이름')))
  })

  it('replays commit idempotently after success', async () => {
    const buffer = buildXlsxBuffer([
      ['이름', '휴대폰번호'],
      ['홍길동', '01099998888'],
    ])
    const analyzed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: buffer,
      originalFileName: 'customers.xlsx',
    })
    const preview = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW, {
      importSessionId: analyzed.importSessionId,
    })
    const committed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, {
      importSessionId: analyzed.importSessionId,
      previewVersionHash: preview.previewVersionHash,
      confirmed: true,
      idempotencyKey: 'test-commit-1',
    })
    assert.equal(committed.summary.created, 1)
    const replay = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, {
      importSessionId: analyzed.importSessionId,
      confirmed: true,
      idempotencyKey: 'test-commit-1',
    })
    assert.equal(replay.idempotentReplay, true)
    assert.equal(replay.summary.created, 1)
  })

  it('blocks cross-GA session access', async () => {
    const buffer = buildXlsxBuffer([['이름'], ['A']])
    const analyzed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: buffer,
      originalFileName: 'a.xlsx',
    })
    await assert.rejects(
      () =>
        executeCustomerImportTool(
          mockPool,
          makeReq({ id: 'user-1', userId: 'user-1', gaId: 99, role: 'USER', customerAccess: 'own' }),
          CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW,
          { importSessionId: analyzed.importSessionId },
        ),
      (e) => e.code === 'SESSION_FORBIDDEN',
    )
  })

  it('blocks cross-user session access', async () => {
    const buffer = buildXlsxBuffer([['이름'], ['A']])
    const analyzed = await executeCustomerImportTool(mockPool, makeReq(), CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
      fileBuffer: buffer,
      originalFileName: 'a.xlsx',
    })
    await assert.rejects(
      () =>
        executeCustomerImportTool(
          mockPool,
          makeReq({ id: 'other', userId: 'other', gaId: 1, role: 'USER', customerAccess: 'own' }),
          CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW,
          { importSessionId: analyzed.importSessionId },
        ),
      (e) => e.code === 'SESSION_FORBIDDEN',
    )
  })
})
