/** @type {Map<string, object>} */
const lastByConversation = new Map()

/**
 * @param {object} entry
 */
export function logIntentDecision(entry) {
  const safe = {
    conversationId: entry.conversationId,
    classifierSource: entry.classified?.source,
    domain: entry.classified?.domain,
    stage: entry.decision?.stage ?? entry.classified?.stage,
    requestedAction: entry.decision?.requestedAction ?? entry.classified?.requestedAction,
    requiresTool: entry.decision?.requiresTool ?? entry.classified?.requiresTool ?? false,
    selectedTool: entry.decision?.selectedTool ?? entry.classified?.requiredToolKey ?? null,
    confidence: entry.classified?.confidence,
    policyOutcome: entry.decision?.policy,
    action: entry.decision?.action,
    contextFlags: entry.snapshot?.flags,
    durationMs: entry.durationMs,
    classifierUsage: entry.classified?.classifierUsage ?? null,
    answerUsage: entry.answerUsage ?? null,
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
