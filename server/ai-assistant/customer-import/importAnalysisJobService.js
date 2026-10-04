import { createHash } from 'node:crypto'

import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../../shared/ai-assistant/customer-import/constants.js'
import {
  IMPORT_ANALYSIS_JOB_DISPLAY,
  IMPORT_ANALYSIS_JOB_STATUS,
  IMPORT_ANALYSIS_SEMANTIC_CONFIG_VERSION,
} from '../../../shared/ai-assistant/customer-import/importAnalysisJobConstants.js'
import { CUSTOMER_IMPORT_SOURCE_MODE } from '../../../shared/ai-assistant/customer-import/importSourceMode.js'
import { getAiConversation, updateAiConversation } from '../conversation/conversationStore.js'
import { createPendingImportCommit, invalidatePendingForImportSession } from '../confirmation/confirmationService.js'
import {
  buildPreviewCardPayload,
  buildPreviewIssueRows,
  buildMappingRowsForUi,
  runImportPreviewPipeline,
} from '../importPreviewRunner.js'
import {
  createImportAnalysisJob,
  findImportAnalysisJobByFingerprint,
  getImportAnalysisJob,
  updateImportAnalysisJob,
} from './importAnalysisJobStore.js'
import { getCustomerImportSession, updateCustomerImportSession } from './sessionStore.js'
import { runUnstructuredCellExtract } from './unstructured/unstructuredExtractService.js'

const RUNNING_STATUSES = new Set([
  IMPORT_ANALYSIS_JOB_STATUS.QUEUED,
  IMPORT_ANALYSIS_JOB_STATUS.ANALYZING,
  IMPORT_ANALYSIS_JOB_STATUS.SEMANTIC_ENRICHING,
  IMPORT_ANALYSIS_JOB_STATUS.PIPELINE_RUNNING,
])

/**
 * @param {import('./sessionTypes.js').CustomerImportSession} session
 * @param {string} duplicatePolicy
 */
export function buildImportAnalysisFingerprint(session, duplicatePolicy) {
  const buffer = session.fileBuffer
  const fileDigest = buffer
    ? createHash('sha256').update(buffer).digest('hex')
    : String(session.originalFileName ?? '')
  const payload = {
    importSessionId: session.importSessionId,
    importSourceMode: session.importSourceMode,
    selectedSheetName: session.selectedSheetName,
    duplicatePolicy,
    fileDigest,
    semanticConfigVersion: IMPORT_ANALYSIS_SEMANTIC_CONFIG_VERSION,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function isRunningJob(job) {
  return job && RUNNING_STATUSES.has(job.status)
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ importSessionId: string, conversationId?: string, duplicatePolicy?: string }} input
 */
export function startImportAnalysisJob(pool, req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const importSessionId = String(input.importSessionId ?? '').trim()
  const session = getCustomerImportSession(importSessionId, userId, gaId)
  const duplicatePolicy =
    input.duplicatePolicy ?? session.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
  const analysisFingerprint = buildImportAnalysisFingerprint(session, duplicatePolicy)

  const existing = findImportAnalysisJobByFingerprint(analysisFingerprint)
  if (existing && existing.userId === userId && existing.gaId === gaId) {
    if (isRunningJob(existing) || existing.status === IMPORT_ANALYSIS_JOB_STATUS.PREVIEW_READY) {
      return { job: existing, created: false }
    }
  }

  const job = createImportAnalysisJob({
    importSessionId,
    userId,
    gaId,
    conversationId: input.conversationId ?? null,
    duplicatePolicy,
    analysisFingerprint,
    progress: {},
    stats: {},
  })

  updateCustomerImportSession(importSessionId, userId, gaId, {
    activeAnalysisJobId: job.jobId,
    analysisFingerprint,
  })

  if (input.conversationId) {
    try {
      const conv = getAiConversation(input.conversationId, userId, gaId)
      updateAiConversation(input.conversationId, userId, gaId, {
        importContext: {
          ...(conv.importContext ?? {}),
          activeAnalysisJobId: job.jobId,
          analysisFingerprint,
        },
      })
    } catch {
      /* ignore */
    }
  }

  setImmediate(() => {
    void executeImportAnalysisJob(pool, req, job.jobId).catch((error) => {
      updateImportAnalysisJob(job.jobId, {
        status: IMPORT_ANALYSIS_JOB_STATUS.FAILED,
        error: { code: error?.code ?? 'IMPORT_ANALYSIS_FAILED', message: 'Analysis failed' },
        completedAt: new Date().toISOString(),
      })
    })
  })

  return { job, created: true }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} jobId
 */
export async function executeImportAnalysisJob(pool, req, jobId) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  let job = getImportAnalysisJob(jobId, userId, gaId)
  const importSessionId = job.importSessionId

  updateImportAnalysisJob(jobId, { status: IMPORT_ANALYSIS_JOB_STATUS.ANALYZING })
  let session = getCustomerImportSession(importSessionId, userId, gaId)

  if (session.importSourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS) {
    updateImportAnalysisJob(jobId, { status: IMPORT_ANALYSIS_JOB_STATUS.SEMANTIC_ENRICHING })
    const extracted = await runUnstructuredCellExtract(session, process.env, {
      onProgress: (progress) => {
        updateImportAnalysisJob(jobId, {
          progress,
          stats: { unstructured: progress },
        })
      },
    })
    updateCustomerImportSession(importSessionId, userId, gaId, {
      rows: extracted.pipelineRows,
      unstructuredExtractDone: true,
      unstructuredExtractStats: extracted.stats,
      previewVersionHash: null,
      commitStatus: 'idle',
    })
    job = updateImportAnalysisJob(jobId, {
      progress: {
        totalBlocks: extracted.stats.blocksTotal,
        blocksProcessed: extracted.stats.blocksTotal,
        semanticGptEligible: extracted.stats.semanticGptEligible,
        semanticGptPlanned: extracted.stats.semanticGptPlanned,
        semanticGptAttempts: extracted.stats.semanticGptAttempts,
        semanticGptSucceeded: extracted.stats.semanticGptSucceeded,
        semanticGptFailed: extracted.stats.semanticGptFailed,
        semanticGptResolved: extracted.stats.semanticGptResolved,
        semanticGptLowConfidence: extracted.stats.semanticGptLowConfidence,
        semanticGptSkippedByLimit: extracted.stats.semanticGptSkippedByLimit,
        semanticGptTimeout: extracted.stats.semanticGptTimeout,
      },
      stats: { unstructured: extracted.stats },
      warning:
        extracted.stats.semanticGptFailed > 0 && extracted.stats.semanticGptSucceeded === 0
          ? 'AI_SEMANTIC_ALL_FAILED'
          : extracted.stats.semanticGptFailed > 0
            ? 'AI_SEMANTIC_PARTIAL_FAILED'
            : null,
    })
  }

  updateImportAnalysisJob(jobId, { status: IMPORT_ANALYSIS_JOB_STATUS.PIPELINE_RUNNING })
  const { session: finalSession, preview, stages, mappingRows, issueRows, duplicatePolicy } =
    await runImportPreviewPipeline(pool, req, importSessionId, {
      runGptColumnMap: false,
      duplicatePolicy: job.duplicatePolicy,
      skipUnstructuredExtract: true,
    })

  invalidatePendingForImportSession(importSessionId)
  const pending = createPendingImportCommit({
    userId,
    gaId,
    importSessionId,
    previewVersionHash: preview.previewVersionHash,
    summary: preview.summary,
  })

  const previewCard = {
    ...buildPreviewCardPayload(finalSession, preview, pending, duplicatePolicy),
    mappingRows,
    issueRows,
    statusLabel: stages[stages.length - 1]?.label ?? '등록 전 내용을 정리했어요',
  }

  if (job.conversationId) {
    const conv = getAiConversation(job.conversationId, userId, gaId)
    const keptMessages = (conv.messages ?? []).filter(
      (m) => m.kind !== 'import_preview_card' && m.kind !== 'import_analysis_progress',
    )
    updateAiConversation(job.conversationId, userId, gaId, {
      importSessionId,
      messages: [...keptMessages, previewCard],
      importContext: {
        activeImportSessionId: importSessionId,
        selectedSheet: finalSession?.selectedSheetName ?? null,
        duplicatePolicy,
        previewVersionHash: preview.previewVersionHash,
        mappingVersion: finalSession?.columnMapping ? JSON.stringify(finalSession.columnMapping) : null,
        pendingActionId: pending.confirmationId,
        activeAnalysisJobId: null,
      },
      pendingAction: {
        type: 'customer.import.commit',
        confirmationId: pending.confirmationId,
        importSessionId,
        previewVersionHash: preview.previewVersionHash,
      },
    })
  }

  return updateImportAnalysisJob(jobId, {
    status: IMPORT_ANALYSIS_JOB_STATUS.PREVIEW_READY,
    completedAt: new Date().toISOString(),
    preview: {
      summary: preview.summary,
      previewVersionHash: preview.previewVersionHash,
      confirmationId: pending.confirmationId,
      duplicatePolicy,
    },
    previewCard,
    stats: {
      ...(job.stats ?? {}),
      preview: preview.summary,
      unstructured: job.stats?.unstructured ?? finalSession.unstructuredExtractStats ?? {},
    },
  })
}

export function serializeImportAnalysisJob(job) {
  return {
    jobId: job.jobId,
    importSessionId: job.importSessionId,
    status: job.status,
    displayPhase: IMPORT_ANALYSIS_JOB_DISPLAY[job.status] ?? job.status,
    progress: job.progress ?? {},
    stats: job.stats ?? {},
    warning: job.warning ?? null,
    error: job.error ?? null,
    preview: job.preview ?? null,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  }
}
