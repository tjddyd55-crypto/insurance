import { randomUUID } from 'node:crypto'

const TTL_MS = 24 * 60 * 60 * 1000

/** @type {Map<string, object>} */
const conversations = new Map()

function purgeExpired() {
  const now = Date.now()
  for (const [id, conv] of conversations) {
    if (conv.expiresAt <= now) {
      conversations.delete(id)
    }
  }
}

/**
 * @param {{ userId: string, gaId: number, importSessionId?: string|null }} input
 */
export function createAiConversation(input) {
  purgeExpired()
  const conversationId = randomUUID()
  const now = Date.now()
  const conv = {
    conversationId,
    userId: input.userId,
    gaId: input.gaId,
    importSessionId: input.importSessionId ?? null,
    importContext: null,
    pageContext: null,
    status: 'active',
    messages: [],
    pendingAction: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt: now + TTL_MS,
  }
  conversations.set(conversationId, conv)
  return conv
}

export function getAiConversation(conversationId, userId, gaId) {
  purgeExpired()
  const conv = conversations.get(conversationId)
  if (!conv) {
    throw Object.assign(new Error('CONVERSATION_NOT_FOUND'), { code: 'CONVERSATION_NOT_FOUND', status: 404 })
  }
  if (conv.userId !== userId || conv.gaId !== gaId) {
    throw Object.assign(new Error('CONVERSATION_FORBIDDEN'), { code: 'CONVERSATION_FORBIDDEN', status: 403 })
  }
  if (conv.expiresAt <= Date.now()) {
    conversations.delete(conversationId)
    throw Object.assign(new Error('CONVERSATION_EXPIRED'), { code: 'CONVERSATION_EXPIRED', status: 410 })
  }
  return conv
}

export function updateAiConversation(conversationId, userId, gaId, patch) {
  const conv = getAiConversation(conversationId, userId, gaId)
  const next = {
    ...conv,
    ...patch,
    conversationId,
    userId,
    gaId,
    updatedAt: new Date().toISOString(),
  }
  conversations.set(conversationId, next)
  return next
}

export function appendAiConversationMessage(conversationId, userId, gaId, message) {
  const conv = getAiConversation(conversationId, userId, gaId)
  const messages = [...conv.messages, { ...message, at: new Date().toISOString() }]
  return updateAiConversation(conversationId, userId, gaId, { messages })
}

export function getLatestAiConversationForUser(userId, gaId) {
  purgeExpired()
  let latest = null
  for (const conv of conversations.values()) {
    if (conv.userId === userId && conv.gaId === gaId) {
      if (!latest || conv.updatedAt > latest.updatedAt) {
        latest = conv
      }
    }
  }
  return latest
}

export function clearAiConversations() {
  conversations.clear()
}
