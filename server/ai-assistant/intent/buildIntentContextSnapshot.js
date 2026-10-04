import { IMPORT_ANALYSIS_JOB_STATUS } from '../../../shared/ai-assistant/customer-import/importAnalysisJobConstants.js'
import { getImportAnalysisJob } from '../customer-import/importAnalysisJobStore.js'

const RUNNING_JOB_STATUSES = new Set([
  IMPORT_ANALYSIS_JOB_STATUS.QUEUED,
  IMPORT_ANALYSIS_JOB_STATUS.ANALYZING,
  IMPORT_ANALYSIS_JOB_STATUS.SEMANTIC_ENRICHING,
  IMPORT_ANALYSIS_JOB_STATUS.PIPELINE_RUNNING,
])

/**
 * @param {object} params
 * @param {object} params.conversation
 * @param {import('../customer-import/sessionTypes.js').CustomerImportSession} params.session
 * @param {string} params.userId
 * @param {number} params.gaId
 */
export function buildIntentContextSnapshot({ conversation, session, userId, gaId }) {
  const importContext = conversation.importContext ?? {}
  const activeJobId = importContext.activeAnalysisJobId ?? null
  let analysisStatus = null
  if (activeJobId) {
    try {
      const job = getImportAnalysisJob(activeJobId, userId, gaId)
      analysisStatus = job.status
    } catch {
      analysisStatus = null
    }
  }

  const previewExists =
    session.commitStatus === 'preview_ready' ||
    Boolean(session.previewVersionHash) ||
    (conversation.messages ?? []).some((m) => m.kind === 'import_preview_card')

  const messages = conversation.messages ?? []
  const lastPreviewCard = messages.filter((m) => m.kind === 'import_preview_card').pop()
  const plannedCreate = lastPreviewCard?.preview?.summary?.plannedCreate ?? null

  return {
    currentScreen: conversation.pageContext?.currentRoute ?? null,
    conversationId: conversation.conversationId,
    attachments: session.originalFileName
      ? [
          {
            type: 'import_file',
            filename: session.originalFileName,
            sourceMode: session.importSourceMode ?? null,
          },
        ]
      : [],
    customerImport: {
      importSessionId: session.importSessionId,
      sourceMode: session.importSourceMode ?? null,
      analysisJobId: activeJobId,
      analysisStatus,
      analysisRunning: analysisStatus ? RUNNING_JOB_STATUSES.has(analysisStatus) : false,
      previewExists,
      previewVersionHash: session.previewVersionHash ?? importContext.previewVersionHash ?? null,
      plannedCreate,
      confirmationExists: Boolean(conversation.pendingAction?.confirmationId),
      committed: session.commitStatus === 'committed',
    },
    flags: {
      attachmentExists: Boolean(session.originalFileName || session.importSessionId),
      previewExists,
      analysisRunning: analysisStatus ? RUNNING_JOB_STATUSES.has(analysisStatus) : false,
    },
  }
}
