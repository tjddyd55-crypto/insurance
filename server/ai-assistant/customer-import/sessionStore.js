import { randomUUID } from 'node:crypto'

import { CUSTOMER_IMPORT_FILE_LIMITS } from '../../../shared/ai-assistant/customer-import/constants.js'

/** @type {Map<string, import('./sessionTypes.js').CustomerImportSession>} */
const sessions = new Map()

function purgeExpired() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(id)
    }
  }
}

/**
 * @param {Omit<import('./sessionTypes.js').CustomerImportSession, 'importSessionId'|'createdAt'|'expiresAt'>} input
 */
export function createCustomerImportSession(input) {
  purgeExpired()
  const importSessionId = randomUUID()
  const createdAt = new Date().toISOString()
  const expiresAt = Date.now() + CUSTOMER_IMPORT_FILE_LIMITS.sessionTtlMs
  const session = {
    importSessionId,
    createdAt,
    expiresAt,
    ...input,
  }
  sessions.set(importSessionId, session)
  return session
}

export function getCustomerImportSession(importSessionId, userId, gaId) {
  purgeExpired()
  const session = sessions.get(importSessionId)
  if (!session) {
    throw Object.assign(new Error('SESSION_NOT_FOUND'), { code: 'SESSION_NOT_FOUND', status: 404 })
  }
  if (session.userId !== userId || session.gaId !== gaId) {
    throw Object.assign(new Error('SESSION_FORBIDDEN'), { code: 'SESSION_FORBIDDEN', status: 403 })
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(importSessionId)
    throw Object.assign(new Error('SESSION_EXPIRED'), { code: 'SESSION_EXPIRED', status: 410 })
  }
  return session
}

export function updateCustomerImportSession(importSessionId, userId, gaId, patch) {
  const session = getCustomerImportSession(importSessionId, userId, gaId)
  const next = { ...session, ...patch, importSessionId, userId, gaId }
  sessions.set(importSessionId, next)
  return next
}

/** 테스트용 */
export function clearCustomerImportSessions() {
  sessions.clear()
}
