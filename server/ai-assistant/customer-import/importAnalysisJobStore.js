import { randomUUID } from 'node:crypto'

import { CUSTOMER_IMPORT_FILE_LIMITS } from '../../../shared/ai-assistant/customer-import/constants.js'
import { IMPORT_ANALYSIS_JOB_STATUS } from '../../../shared/ai-assistant/customer-import/importAnalysisJobConstants.js'

/** @type {Map<string, object>} */
const jobsById = new Map()

/** @type {Map<string, string>} fingerprint -> jobId */
const jobIdByFingerprint = new Map()

function purgeExpired() {
  const now = Date.now()
  for (const [id, job] of jobsById) {
    if (job.expiresAt <= now) {
      jobsById.delete(id)
      if (job.analysisFingerprint) {
        jobIdByFingerprint.delete(job.analysisFingerprint)
      }
    }
  }
}

/**
 * @param {object} input
 */
export function createImportAnalysisJob(input) {
  purgeExpired()
  const jobId = randomUUID()
  const now = Date.now()
  const job = {
    jobId,
    importSessionId: input.importSessionId,
    userId: input.userId,
    gaId: input.gaId,
    conversationId: input.conversationId ?? null,
    duplicatePolicy: input.duplicatePolicy,
    analysisFingerprint: input.analysisFingerprint,
    status: IMPORT_ANALYSIS_JOB_STATUS.QUEUED,
    progress: input.progress ?? {},
    stats: input.stats ?? {},
    warning: null,
    error: null,
    preview: null,
    previewCard: null,
    startedAt: new Date(now).toISOString(),
    completedAt: null,
    expiresAt: now + CUSTOMER_IMPORT_FILE_LIMITS.sessionTtlMs,
  }
  jobsById.set(jobId, job)
  jobIdByFingerprint.set(input.analysisFingerprint, jobId)
  return job
}

export function getImportAnalysisJob(jobId, userId, gaId) {
  purgeExpired()
  const job = jobsById.get(jobId)
  if (!job) {
    throw Object.assign(new Error('IMPORT_ANALYSIS_JOB_NOT_FOUND'), {
      code: 'IMPORT_ANALYSIS_JOB_NOT_FOUND',
      status: 404,
    })
  }
  if (job.userId !== userId || job.gaId !== gaId) {
    throw Object.assign(new Error('IMPORT_ANALYSIS_JOB_FORBIDDEN'), {
      code: 'IMPORT_ANALYSIS_JOB_FORBIDDEN',
      status: 403,
    })
  }
  return job
}

export function updateImportAnalysisJob(jobId, patch) {
  const job = jobsById.get(jobId)
  if (!job) {
    return null
  }
  const next = { ...job, ...patch, jobId }
  jobsById.set(jobId, next)
  return next
}

export function findImportAnalysisJobByFingerprint(analysisFingerprint) {
  purgeExpired()
  const jobId = jobIdByFingerprint.get(analysisFingerprint)
  if (!jobId) {
    return null
  }
  return jobsById.get(jobId) ?? null
}

/** 테스트용 */
export function clearImportAnalysisJobs() {
  jobsById.clear()
  jobIdByFingerprint.clear()
}
