import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../shared/ai-assistant/customer-import/constants.js'
import { CUSTOMER_IMPORT_FIELD_LABELS_KO } from '../../shared/ai-assistant/customer-import/mappingEdit.js'
import { runCustomerImportColumnMap } from './column-map/columnMapService.js'
import { CUSTOMER_IMPORT_TOOL_KEYS, executeCustomerImportTool } from './customer-import/toolExecutor.js'
import { getCustomerImportSession, updateCustomerImportSession } from './customer-import/sessionStore.js'
import { isToolCallableByOrchestrator } from './toolRegistryAdapter.js'

export const IMPORT_STAGE_USER_LABELS = Object.freeze({
  analyze: '파일을 분석하고 있어요',
  sheet: '시트를 확인하고 있어요',
  mapping: '고객 항목을 확인하고 있어요',
  normalize: '고객 데이터를 정리하고 있어요',
  duplicate: '중복 고객을 확인하고 있어요',
  validation: '등록 가능 여부를 확인하고 있어요',
  preview: '등록 전 내용을 정리했어요',
})

/**
 * @param {import('./sessionTypes.js').CustomerImportSession} session
 */
export function buildMappingRowsForUi(session) {
  const headers = session.headers ?? []
  const mapping = session.columnMapping ?? {}
  const metaBySource = new Map(
    (session.columnMapMeta?.mappings ?? []).map((m) => [m.sourceColumn, m]),
  )
  return headers.map((header, index) => {
    const sourceColumn = String(header ?? '').trim() || `열 ${index + 1}`
    const colKey = `col_${index}`
    const destinationField = mapping[colKey] ?? null
    const meta = metaBySource.get(sourceColumn)
    let status = 'unmapped'
    if (destinationField) {
      if (meta?.needsReview || (meta?.confidence != null && meta.confidence < 0.9)) {
        status = 'review'
      } else {
        status = 'confirmed'
      }
    } else if (meta?.blocked) {
      status = 'ignored'
    }
    return {
      columnIndex: index,
      colKey,
      sourceColumn,
      destinationField,
      destinationLabel: destinationField ? CUSTOMER_IMPORT_FIELD_LABELS_KO[destinationField] ?? destinationField : null,
      status,
      confidence: meta?.confidence ?? null,
    }
  })
}

function maskPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) {
    return '***'
  }
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

/**
 * @param {import('./customer-import/pipeline.js').ImportPipelineRow[]} rows
 */
export function buildPreviewIssueRows(rows) {
  return rows
    .filter((r) => !r.eligibleForCommit || r.status !== 'VALID')
    .slice(0, 200)
    .map((r) => ({
      rowId: r.rowId,
      sourceRowNumber: r.sourceRowNumber,
      status: r.status,
      reasons: r.reasons,
      identifier: r.mapped?.name ? String(r.mapped.name).slice(0, 40) : `행 ${r.sourceRowNumber}`,
      phoneMasked: r.mapped?.phone ? maskPhone(r.mapped.phone) : null,
      eligibleForCommit: r.eligibleForCommit,
    }))
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} importSessionId
 * @param {{ runGptColumnMap?: boolean, duplicatePolicy?: string }} [options]
 */
export async function runImportPreviewPipeline(pool, req, importSessionId, options = {}) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  let session = getCustomerImportSession(importSessionId, userId, gaId)
  const duplicatePolicy =
    options.duplicatePolicy ?? session.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP

  const stages = []

  if (options.runGptColumnMap !== false) {
    const columnMapGate = isToolCallableByOrchestrator(CUSTOMER_IMPORT_TOOL_KEYS.COLUMN_MAP)
    if (columnMapGate.ok) {
      stages.push({ stage: 'mapping', label: IMPORT_STAGE_USER_LABELS.mapping, status: 'ok' })
      const mapped = await runCustomerImportColumnMap(session)
      session = updateCustomerImportSession(importSessionId, userId, gaId, {
        columnMapping: mapped.columnMapping,
        columnMapMeta: {
          gptUsed: mapped.gptUsed,
          mappings: mapped.mappings ?? [],
          warnings: mapped.warnings ?? [],
        },
        previewVersionHash: null,
        commitStatus: 'idle',
        commitResult: null,
        duplicatePolicy,
      })
    }
  } else {
    session = updateCustomerImportSession(importSessionId, userId, gaId, {
      previewVersionHash: null,
      commitStatus: 'idle',
      duplicatePolicy,
    })
  }

  stages.push({ stage: 'normalize', label: IMPORT_STAGE_USER_LABELS.normalize, status: 'ok' })
  await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.NORMALIZE, {
    importSessionId,
    duplicatePolicy,
  })
  stages.push({ stage: 'duplicate', label: IMPORT_STAGE_USER_LABELS.duplicate, status: 'ok' })
  await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.DUPLICATE_CHECK, {
    importSessionId,
    duplicatePolicy,
  })
  stages.push({ stage: 'validation', label: IMPORT_STAGE_USER_LABELS.validation, status: 'ok' })
  await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.VALIDATION, {
    importSessionId,
    duplicatePolicy,
  })
  stages.push({ stage: 'preview', label: IMPORT_STAGE_USER_LABELS.preview, status: 'ok' })
  const preview = await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW, {
    importSessionId,
    duplicatePolicy,
  })

  session = getCustomerImportSession(importSessionId, userId, gaId)
  return {
    session,
    preview,
    stages,
    mappingRows: buildMappingRowsForUi(session),
    issueRows: buildPreviewIssueRows(preview.rows ?? []),
    duplicatePolicy,
  }
}

export function buildPreviewCardPayload(session, preview, pending, duplicatePolicy) {
  const summary = preview.summary ?? {}
  const duplicateTotal =
    (summary.duplicateInFile ?? 0) + (summary.duplicateExisting ?? 0) + (summary.duplicatePossible ?? 0)
  const needsReview = (summary.warning ?? 0) + (summary.duplicatePossible ?? 0)
  return {
    role: 'assistant',
    kind: 'import_preview_card',
    text: '고객 가져오기 준비가 완료되었습니다.',
    preview: {
      fileName: session.originalFileName,
      summary: {
        ...summary,
        duplicateTotal,
        needsReview,
      },
      previewVersionHash: preview.previewVersionHash,
      confirmationId: pending.confirmationId,
      duplicatePolicy,
    },
  }
}
