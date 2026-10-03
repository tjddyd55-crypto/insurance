import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../../shared/ai-assistant/customer-import/constants.js'
import { insertCustomerForImport } from '../../customers/insertCustomerForImport.js'
import { loadCrmDuplicateIndex } from './crmDuplicateIndex.js'
import { runImportPipeline } from './pipeline.js'
import { mapRowToCustomerBody } from './mapRowToCustomerBody.js'

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {import('./sessionTypes.js').CustomerImportSession} session
 * @param {{ confirmed: boolean, idempotencyKey?: string, duplicatePolicy?: string }} options
 */
export async function commitCustomerImportSession(pool, req, session, options) {
  if (!options.confirmed) {
    throw Object.assign(new Error('CONFIRMATION_REQUIRED'), { code: 'CONFIRMATION_REQUIRED', status: 400 })
  }
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const crmIndex = await loadCrmDuplicateIndex(pool, req, userId, gaId)
  const pipeline = runImportPipeline(session, crmIndex, {
    duplicatePolicy: options.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP,
  })
  if (pipeline.previewVersionHash !== session.previewVersionHash) {
    throw Object.assign(new Error('STALE_PREVIEW'), { code: 'STALE_PREVIEW', status: 409 })
  }

  const toCreate = pipeline.rows.filter((r) => r.eligibleForCommit)
  const client = await pool.connect()
  const created = []
  const skipped = []
  const failures = []
  try {
    await client.query('BEGIN')
    for (const row of toCreate) {
      try {
        const body = mapRowToCustomerBody(row.mapped)
        const inserted = await insertCustomerForImport(client, {
          userId,
          gaId,
          authUser: req.user,
          data: body,
        })
        created.push({ rowId: row.rowId, sourceRowNumber: row.sourceRowNumber, customerId: inserted.id })
      } catch (error) {
        failures.push({
          rowId: row.rowId,
          sourceRowNumber: row.sourceRowNumber,
          reasonCode: 'COMMIT_FAILED',
          message: error instanceof Error ? error.message : '등록 실패',
        })
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    return {
      summary: {
        requested: toCreate.length,
        created: 0,
        skipped: pipeline.rows.length - toCreate.length,
        failed: toCreate.length,
      },
      created,
      skipped: pipeline.rows
        .filter((r) => !r.eligibleForCommit)
        .map((r) => ({ rowId: r.rowId, sourceRowNumber: r.sourceRowNumber, reasons: r.reasons })),
      failures: failures.length
        ? failures
        : [{ reasonCode: 'TRANSACTION_ROLLBACK', message: error instanceof Error ? error.message : 'rollback' }],
      previewVersionHash: pipeline.previewVersionHash,
    }
  } finally {
    client.release()
  }

  for (const row of pipeline.rows.filter((r) => !r.eligibleForCommit)) {
    skipped.push({ rowId: row.rowId, sourceRowNumber: row.sourceRowNumber, reasons: row.reasons })
  }

  return {
    summary: {
      requested: toCreate.length,
      created: created.length,
      skipped: skipped.length,
      failed: failures.length,
    },
    created,
    skipped,
    failures,
    previewVersionHash: pipeline.previewVersionHash,
  }
}
