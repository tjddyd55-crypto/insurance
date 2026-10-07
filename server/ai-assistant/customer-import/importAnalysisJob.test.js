import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IMPORT_ANALYSIS_JOB_STATUS } from '../../../shared/ai-assistant/customer-import/importAnalysisJobConstants.js'
import { runBoundedConcurrency } from '../../../shared/ai-assistant/customer-import/runBoundedConcurrency.js'
import { buildImportAnalysisFingerprint, startImportAnalysisJob } from './importAnalysisJobService.js'
import { clearImportAnalysisJobs, getImportAnalysisJob } from './importAnalysisJobStore.js'
import { clearCustomerImportSessions, createCustomerImportSession } from './sessionStore.js'
import { CUSTOMER_IMPORT_SOURCE_MODE } from '../../../shared/ai-assistant/customer-import/importSourceMode.js'

describe('import analysis job', () => {
  it('bounded concurrency respects limit', async () => {
    let active = 0
    let maxActive = 0
    await runBoundedConcurrency([1, 2, 3, 4, 5, 6], 3, async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 20))
      active -= 1
    })
    assert.ok(maxActive <= 3)
  })

  it('idempotent start returns same running job', () => {
    clearImportAnalysisJobs()
    clearCustomerImportSessions()
    const session = createCustomerImportSession({
      userId: 'u1',
      gaId: 1,
      originalFileName: 't.xlsx',
      fileType: 'xlsx',
      fileBuffer: Buffer.from('abc'),
      sheets: [{ name: '고객정보', matrix: [['a']] }],
      selectedSheetName: '고객정보',
      importSourceMode: CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS,
      headers: [],
      columnMapping: {},
      rows: [],
      previewVersionHash: null,
      commitStatus: 'idle',
      commitResult: null,
    })
    const req = { user: { id: 'u1', gaId: 1 } }
    const first = startImportAnalysisJob(null, req, { importSessionId: session.importSessionId })
    const second = startImportAnalysisJob(null, req, { importSessionId: session.importSessionId })
    assert.equal(first.created, true)
    assert.equal(second.created, false)
    assert.equal(first.job.jobId, second.job.jobId)
    const job = getImportAnalysisJob(first.job.jobId, 'u1', 1)
    assert.ok([IMPORT_ANALYSIS_JOB_STATUS.QUEUED, IMPORT_ANALYSIS_JOB_STATUS.ANALYZING].includes(job.status))
  })

  it('fingerprint changes when duplicate policy changes', () => {
    const session = {
      importSessionId: 's1',
      importSourceMode: CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS,
      selectedSheetName: '고객정보',
      originalFileName: 't.xlsx',
      fileBuffer: Buffer.from('same'),
    }
    const a = buildImportAnalysisFingerprint(session, 'SKIP')
    const b = buildImportAnalysisFingerprint(session, 'INCLUDE')
    assert.notEqual(a, b)
  })
})
