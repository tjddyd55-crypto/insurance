import { INTENT_DOMAIN } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import {
  buildCustomerSearchQuery,
  isCustomerSearchMissingTarget,
} from './customerSearchQuery.js'
import { resolveCustomerIdFromContext } from './resolveCustomerReference.js'
import { extractCustomerQueryFromIntent } from '../customer-query/resolveCustomerQueryFromIntent.js'
import { isReadToolCallable } from '../read-tools/readToolAllowlist.js'

export const READ_ORCHESTRATION_ACTION = Object.freeze({
  EXECUTE_READ_TOOL: 'EXECUTE_READ_TOOL',
  WRITE_BLOCKED: 'WRITE_BLOCKED',
  SCOPE_LIMIT: 'SCOPE_LIMIT',
  NO_READ_INTENT: 'NO_READ_INTENT',
  CAPABILITIES: 'CAPABILITIES',
})

const WRITE_INTENTS = new Set(['CREATE', 'UPDATE', 'DELETE', 'SEND', 'COMMIT', 'WRITE'])
const WRITE_ACTIONS = /^(customer\.(create|update|delete)|sms\.|schedule\.(create|update|cancel)|claim\.(create|send))/i

function resolveStructuredReadToolKey(classified, bizIntent) {
  const domain = classified?.domain
  const hasCustomerQuery =
    Boolean(classified?.customerQuery) ||
    Array.isArray(classified?.filters)

  if (
    (domain === INTENT_DOMAIN.CUSTOMER || domain === 'CUSTOMER' || domain === INTENT_DOMAIN.ONE_FC_QUERY) &&
    (hasCustomerQuery || bizIntent === 'LIST' || bizIntent === 'COUNT')
  ) {
    return 'customer.list'
  }

  if (domain === INTENT_DOMAIN.CUSTOMER || domain === 'CUSTOMER') {
    if (bizIntent === 'SEARCH') return 'customer.search'
    if (bizIntent === 'GET' || bizIntent === 'NAVIGATE') return 'customer.get'
  }

  return null
}

/**
 * @param {object} classified
 * @param {object} conversation
 * @param {string} text
 */
export function resolveReadOrchestrationAction(classified, conversation, text) {
  const domain = classified.domain
  const bizIntent = String(classified.intent ?? classified.requestedAction ?? '').toUpperCase()
  const toolKey =
    classified.requiredToolKey ??
    resolveStructuredReadToolKey(classified, bizIntent)

  if (domain === INTENT_DOMAIN.ASSISTANT || bizIntent === 'CAPABILITIES') {
    return { action: READ_ORCHESTRATION_ACTION.CAPABILITIES, policy: 'ALLOW' }
  }

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

  const target = classified.target ?? {}
  let customerId = resolveCustomerIdFromContext(target, conversation, text)
  if (
    !customerId &&
    (toolKey === 'consultation.recent' || toolKey === 'customer.files.list') &&
    conversation?.resolvedEntities?.customer?.customerId
  ) {
    customerId = Number(conversation.resolvedEntities.customer.customerId)
  }

  const params = { ...(classified.filters ?? {}) }
  if (toolKey === 'customer.search') {
    const built = buildCustomerSearchQuery({ text, target, classified })
    if (built.reason === 'REFERENCE_ONLY' && !customerId) {
      return {
        action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
        policy: 'NEED_CUSTOMER',
      }
    }
    params.query = built.query
    params.limit = classified.limit ?? 10
    if (isCustomerSearchMissingTarget(params.query, text)) {
      return {
        action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
        policy: 'SEARCH_NEED_TARGET',
      }
    }
  }
  if (toolKey === 'customer.get') {
    params.customerId = customerId
  }
  if (toolKey === 'consultation.recent') {
    params.customerId = customerId
    params.limit = classified.limit ?? extractLimitHint(text) ?? 3
  }
  if (toolKey === 'customer.files.list') {
    params.customerId = customerId
  }
  if (toolKey === 'task.list') {
    params.due = classified.filters?.due ?? inferTodoDue(text)
  }
  if (toolKey === 'schedule.list') {
    params.day = classified.filters?.day ?? inferScheduleDay(text)
  }
  if (toolKey === 'claim.list') {
    params.pending = classified.filters?.pending ?? /미처리|확인할|대기/.test(text)
    params.customerId = customerId ?? classified.filters?.customerId ?? null
    params.limit = classified.limit ?? 15
  }
  if (toolKey === 'customer.list') {
    const queryResolved = extractCustomerQueryFromIntent(classified)
    if (!queryResolved.ok) {
      return {
        action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
        policy: 'INVALID_CUSTOMER_QUERY',
        queryError: queryResolved,
      }
    }
    params.customerQueryAst = queryResolved.ast
    params.limit = queryResolved.ast.limit ?? classified.limit ?? 20
    params.countOnly =
      classified.intent === 'COUNT' ||
      String(classified.requestedAction ?? '').toUpperCase() === 'COUNT' ||
      /몇\s*명/.test(text)
  }

  const navigate =
    bizIntent === 'NAVIGATE' ||
    classified.requestedAction === 'NAVIGATE' ||
    (/페이지|상세/.test(text) && /열|보여|이동/.test(text))

  if (navigate && customerId && toolKey !== 'customer.search') {
    return {
      action: READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL,
      toolKey: 'customer.get',
      params: { customerId },
      policy: 'ALLOW',
      navigate: true,
    }
  }

  const needsCustomer = new Set(['customer.get', 'consultation.recent', 'customer.files.list'])
  if (needsCustomer.has(toolKey) && !params.customerId) {
    if (target.name) {
      if (isCustomerSearchMissingTarget(target.name, text)) {
        return {
          action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
          policy: 'SEARCH_NEED_TARGET',
        }
      }
      return {
        action: READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL,
        toolKey: 'customer.search',
        params: { query: target.name, limit: 5 },
        policy: 'ALLOW',
        navigate,
        followUpTool: toolKey,
        followUpParams: { limit: params.limit },
      }
    }
    if (navigate && customerId == null) {
      return {
        action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
        policy: 'NEED_CUSTOMER',
      }
    }
    if (needsCustomer.has(toolKey)) {
      return {
        action: READ_ORCHESTRATION_ACTION.NO_READ_INTENT,
        policy: 'NEED_CUSTOMER',
      }
    }
  }

  if (navigate && toolKey === 'customer.search' && target.name) {
    return {
      action: READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL,
      toolKey: 'customer.search',
      params: { query: target.name, limit: 5 },
      policy: 'ALLOW',
      navigate: true,
      followUpTool: 'customer.get',
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

function extractLimitHint(text) {
  const m = String(text ?? '').match(/(\d+)\s*개/)
  if (!m) {
    return null
  }
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : null
}

function inferTodoDue(text) {
  const t = String(text ?? '')
  if (/내일/.test(t)) {
    return 'tomorrow'
  }
  if (/이번\s*주|주간/.test(t)) {
    return 'week'
  }
  return 'today'
}

function inferScheduleDay(text) {
  const t = String(text ?? '')
  if (/내일/.test(t)) {
    return 'tomorrow'
  }
  return 'today'
}

