import { INTENT_DOMAIN, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'

/**
 * @param {object} classified
 */
export function normalizeClassifiedIntent(classified) {
  const domain = classified.domain
  let next = { ...classified }

  if (domain === INTENT_DOMAIN.UNKNOWN || domain === INTENT_DOMAIN.OTHER) {
    next = {
      ...next,
      domain: INTENT_DOMAIN.GENERAL_CHAT,
      stage: INTENT_STAGE.ANSWER,
      requestedAction: 'NONE',
      requiresTool: false,
      requiredToolKey: null,
    }
  }

  if (next.requiresTool === undefined) {
    next.requiresTool = Boolean(next.requiredToolKey)
  }
  if (next.requiredToolKey === undefined) {
    next.requiredToolKey = null
  }

  return next
}
