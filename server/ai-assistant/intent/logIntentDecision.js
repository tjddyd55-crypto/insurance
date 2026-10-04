/** @type {Map<string, object>} */
const lastByConversation = new Map()

/**
 * @param {object} entry
 */
export function logIntentDecision(entry) {
  const safe = {
    conversationId: entry.conversationId,
    domain: entry.classified?.domain,
    stage: entry.decision?.stage ?? entry.classified?.stage,
    requestedAction: entry.decision?.requestedAction ?? entry.classified?.requestedAction,
    confidence: entry.classified?.confidence,
    source: entry.classified?.source,
    policy: entry.decision?.policy,
    action: entry.decision?.action,
    contextFlags: entry.snapshot?.flags,
    durationMs: entry.durationMs,
    requestId: entry.requestId ?? null,
  }
  if (entry.conversationId) {
    lastByConversation.set(entry.conversationId, safe)
  }
  console.info('[ai-intent]', JSON.stringify(safe))
  return safe
}

export function getLastIntentDecision(conversationId) {
  return lastByConversation.get(conversationId) ?? null
}

export function clearIntentDecisionLog() {
  lastByConversation.clear()
}
