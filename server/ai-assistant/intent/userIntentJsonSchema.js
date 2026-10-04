import { INTENT_DOMAIN, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'

export const USER_INTENT_JSON_SCHEMA = {
  name: 'onefc_user_intent',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      domain: { type: 'string', enum: [...Object.values(INTENT_DOMAIN)] },
      stage: { type: 'string', enum: [...Object.values(INTENT_STAGE)] },
      goal: { type: 'string' },
      requestedAction: { type: 'string' },
      targetReference: { type: ['string', 'null'] },
      commitRequested: { type: 'boolean' },
      requiresClarification: { type: 'boolean' },
      clarificationQuestion: { type: ['string', 'null'] },
      confidence: { type: 'number' },
    },
    required: [
      'domain',
      'stage',
      'goal',
      'requestedAction',
      'targetReference',
      'commitRequested',
      'requiresClarification',
      'clarificationQuestion',
      'confidence',
    ],
  },
}
