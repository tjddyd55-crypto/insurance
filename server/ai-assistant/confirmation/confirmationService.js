import { randomUUID } from 'node:crypto'

const TTL_MS = 30 * 60 * 1000

/** @type {Map<string, object>} */
const pending = new Map()

function purgeExpired() {
  const now = Date.now()
  for (const [id, item] of pending) {
    if (item.expiresAt <= now) {
      pending.delete(id)
    }
  }
}

/**
 * @param {{ userId: string, gaId: number, importSessionId: string, previewVersionHash: string, summary?: object }} input
 */
export function createPendingImportCommit(input) {
  purgeExpired()
  const confirmationId = randomUUID()
  const now = Date.now()
  const record = {
    confirmationId,
    type: 'customer.import.commit',
    userId: input.userId,
    gaId: input.gaId,
    importSessionId: input.importSessionId,
    previewVersionHash: input.previewVersionHash,
    summary: input.summary ?? null,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + TTL_MS,
    consumed: false,
  }
  pending.set(confirmationId, record)
  return record
}

export function consumePendingImportCommit(confirmationId, userId, gaId, previewVersionHash) {
  purgeExpired()
  const record = pending.get(confirmationId)
  if (!record) {
    throw Object.assign(new Error('CONFIRMATION_NOT_FOUND'), { code: 'CONFIRMATION_NOT_FOUND', status: 404 })
  }
  if (record.userId !== userId || record.gaId !== gaId) {
    throw Object.assign(new Error('CONFIRMATION_FORBIDDEN'), { code: 'CONFIRMATION_FORBIDDEN', status: 403 })
  }
  if (record.expiresAt <= Date.now()) {
    pending.delete(confirmationId)
    throw Object.assign(new Error('CONFIRMATION_EXPIRED'), { code: 'CONFIRMATION_EXPIRED', status: 410 })
  }
  if (record.previewVersionHash !== previewVersionHash) {
    throw Object.assign(new Error('STALE_PREVIEW'), { code: 'STALE_PREVIEW', status: 409 })
  }
  if (record.consumed) {
    throw Object.assign(new Error('CONFIRMATION_ALREADY_USED'), { code: 'CONFIRMATION_ALREADY_USED', status: 409 })
  }
  record.consumed = true
  pending.set(confirmationId, record)
  return record
}

export function clearPendingConfirmations() {
  pending.clear()
}
