import { INTENT_DOMAIN } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { isReadToolCallable } from '../read-tools/readToolAllowlist.js'

export const READ_ORCHESTRATION_ACTION = Object.freeze({
  EXECUTE_READ_TOOL: 'EXECUTE_READ_TOOL',
  WRITE_BLOCKED: 'WRITE_BLOCKED',
  SCOPE_LIMIT: 'SCOPE_LIMIT',
  NO_READ_INTENT: 'NO_READ_INTENT',
})

const WRITE_INTENTS = new Set(['CREATE', 'UPDATE', 'DELETE', 'SEND', 'COMMIT', 'WRITE'])
const WRITE_ACTIONS = /^(customer\.(create|update|delete)|sms\.|schedule\.(create|update|cancel)|claim\.(create|send))/i

/**
 * @param {object} classified
 * @param {object} conversation
 * @param {string} text
 */
export function resolveReadOrchestrationAction(classified, conversation, text) {
  const domain = classified.domain
  const bizIntent = String(classified.intent ?? classified.requestedAction ?? '').toUpperCase()
  const toolKey = classified.requiredToolKey ?? null

  if (
    domain === INTENT_DOMAIN.ONE_FC_ACTION ||
    WRITE_INTENTS.has(bizIntent) ||
    (toolKey && WRITE_ACTIONS.test(toolKey)) ||
    classified.commitRequested
  ) {
    if (domain !== INTENT_DOMAIN.CUSTOMER_IMPORT) {
      return { action: READ_ORCHESTRATION_ACTION.WRITE_BLOCKED, policy: 'DENY_WRITE' }
    }
  }

  if (domain === INTENT_DOMAIN.GENERAL_CHAT) {
    return { action: READ_ORCHESTRATION_ACTION.SCOPE_LIMIT, policy: 'LIMIT_GENERAL' }
  }

  const readDomains = new Set([
    INTENT_DOMAIN.ONE_FC_QUERY,
    INTENT_DOMAIN.CUSTOMER,
    'CUSTOMER',
  ])
  if (!readDomains.has(domain) && !classified.requiresTool) {
    return { action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT, policy: 'SKIP' }
  }

  if (!toolKey) {
    return { action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT, policy: 'SKIP' }
  }

  const gate = isReadToolCallable(toolKey)
  if (!gate.ok) {
    return {
      action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
      policy: 'TOOL_UNAVAILABLE',
      toolKey,
    }
  }

  const resolved = conversation.resolvedEntities?.customer ?? null
  const target = classified.target ?? {}
  let customerId = target.customerId ?? null
  const reference = String(target.reference ?? '').toLowerCase()
  if (!customerId && (reference === 'previous_customer' || reference === 'current_customer' || /그\s*(사람|고객)/.test(text))) {
    customerId = resolved?.customerId ?? null
  }

  const params = { ...(classified.filters ?? {}) }
  if (toolKey === 'customer.search') {
    params.query = target.name ?? classified.filters?.name ?? extractNameHint(text)
    params.limit = classified.limit ?? 10
  }
  if (toolKey === 'customer.get') {
    params.customerId = customerId
  }
  if (toolKey === 'consultation.recent') {
    params.customerId = customerId
    params.limit = classified.limit ?? 3
  }

  const navigate =
    bizIntent === 'NAVIGATE' ||
    classified.requestedAction === 'NAVIGATE' ||
    /페이지\s*열|상세\s*페이지|열어줘/.test(text)

  if ((toolKey === 'customer.get' || toolKey === 'consultation.recent') && !params.customerId) {
    if (target.name) {
      return {
        action: READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL,
        toolKey: 'customer.search',
        params: { query: target.name, limit: 5 },
        policy: 'ALLOW',
        navigate,
        followUpTool: toolKey,
      }
    }
    return {
      action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
      policy: 'NEED_CUSTOMER',
    }
  }

  return {
    action: READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL,
    toolKey,
    params,
    policy: 'ALLOW',
    navigate,
  }
}

function extractNameHint(text) {
  const t = String(text ?? '').trim()
  const m = t.match(/([가-힣]{2,4})\s*(찾|보여|알려|정보|페이지)/)
  return m?.[1] ?? t.slice(0, 24)
}
