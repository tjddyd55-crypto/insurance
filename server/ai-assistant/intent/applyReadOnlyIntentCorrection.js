import { INTENT_DOMAIN, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import {
  detectBusinessToolKeyHint,
  isExplainOrGeneralKnowledgeQuestion,
  isLikelyGeneralConversation,
} from './detectBusinessToolHint.js'
import { extractCustomerNameHint, isGenericCustomerNoun } from './customerSearchQuery.js'
import { normalizeClassifiedIntent } from './normalizeClassifiedIntent.js'

/**
 * When GPT (or baseline) mislabels a clear CRM read as GENERAL_CHAT, correct before orchestration.
 * Not a keyword router — only fixes obvious read-only mismatches.
 * @param {string} text
 * @param {object} classified
 * @param {{ readOnlyBusinessEnabled?: boolean }} scope
 */
export function applyReadOnlyIntentCorrection(text, classified, scope) {
  if (!scope?.readOnlyBusinessEnabled) {
    return classified
  }
  if (isLikelyGeneralConversation(text) || isExplainOrGeneralKnowledgeQuestion(text)) {
    return classified
  }
  const hint = detectBusinessToolKeyHint(text)
  if (!hint) {
    return classified
  }
  if (classified.requiredToolKey === hint) {
    return classified
  }
  if (
    classified.requiredToolKey &&
    classified.domain !== INTENT_DOMAIN.GENERAL_CHAT &&
    classified.domain !== INTENT_DOMAIN.UNKNOWN
  ) {
    return classified
  }
  if (
    classified.domain !== INTENT_DOMAIN.GENERAL_CHAT &&
    classified.domain !== INTENT_DOMAIN.ONE_FC_QUERY &&
    classified.domain !== 'CUSTOMER'
  ) {
    return classified
  }

  const target = buildTargetFromText(text, hint)
  return normalizeClassifiedIntent({
    ...classified,
    domain: INTENT_DOMAIN.ONE_FC_QUERY,
    stage: INTENT_STAGE.QUERY,
    intent:
      hint === 'customer.search'
        ? 'SEARCH'
        : hint === 'customer.get'
          ? 'GET'
          : hint === 'customer.list' && /몇\s*명/.test(text)
            ? 'COUNT'
            : 'LIST',
    requestedAction: 'INVOKE_TOOL',
    requiresTool: true,
    requiredToolKey: hint,
    requiresClarification: false,
    clarificationQuestion: null,
    target,
    source: `${classified.source ?? 'unknown'}+read_only_correction`,
  })
}

function buildTargetFromText(text, toolKey) {
  const t = String(text ?? '').trim()
  if (/그\s*(사람|고객)|이\s*고객|아까\s*(그\s*)?(사람|고객)|방금\s*(그\s*)?(사람|고객)/.test(t)) {
    return { reference: 'previous_customer', entityType: 'CUSTOMER' }
  }
  if (toolKey === 'customer.search' || toolKey === 'customer.get') {
    const hint = extractCustomerNameHint(t)
    if (hint && !isGenericCustomerNoun(hint)) {
      return { name: hint, entityType: 'CUSTOMER' }
    }
  }
  return null
}
