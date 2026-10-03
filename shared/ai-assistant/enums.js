/** @readonly */
export const AI_TOOL_IMPLEMENTATION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  IMPLEMENTED: 'IMPLEMENTED',
  BLOCKED: 'BLOCKED',
})

/** @readonly */
export const AI_TOOL_QA_STATUS = Object.freeze({
  NOT_TESTED: 'NOT_TESTED',
  TESTING: 'TESTING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
})

/** @readonly */
export const AI_TOOL_BASE_FEATURE_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  PARTIAL: 'PARTIAL',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
})

/** @readonly */
export const AI_TOOL_ACTION_TYPE = Object.freeze({
  READ: 'READ',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SEND: 'SEND',
  EXTERNAL_ACTION: 'EXTERNAL_ACTION',
})

/** @readonly */
export const AI_TOOL_RISK_LEVEL = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
})

export const AI_TOOL_IMPLEMENTATION_STATUSES = Object.freeze(Object.values(AI_TOOL_IMPLEMENTATION_STATUS))
export const AI_TOOL_QA_STATUSES = Object.freeze(Object.values(AI_TOOL_QA_STATUS))
export const AI_TOOL_BASE_FEATURE_STATUSES = Object.freeze(Object.values(AI_TOOL_BASE_FEATURE_STATUS))
export const AI_TOOL_ACTION_TYPES = Object.freeze(Object.values(AI_TOOL_ACTION_TYPE))
export const AI_TOOL_RISK_LEVELS = Object.freeze(Object.values(AI_TOOL_RISK_LEVEL))
