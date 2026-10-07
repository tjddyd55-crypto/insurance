import { AI_TOOL_ACTION_TYPE, AI_TOOL_RISK_LEVEL } from './enums.js'

/**
 * actionType 기반 기본 확인·위험도 정책 (Registry SSOT).
 * 개별 Tool 에서 명시적으로 override 가능.
 */
export function defaultRequiresConfirmation(actionType) {
  switch (actionType) {
    case AI_TOOL_ACTION_TYPE.READ:
      return false
    case AI_TOOL_ACTION_TYPE.CREATE:
    case AI_TOOL_ACTION_TYPE.UPDATE:
    case AI_TOOL_ACTION_TYPE.DELETE:
    case AI_TOOL_ACTION_TYPE.SEND:
    case AI_TOOL_ACTION_TYPE.EXTERNAL_ACTION:
      return true
    default:
      return true
  }
}

export function defaultRiskLevel(actionType) {
  switch (actionType) {
    case AI_TOOL_ACTION_TYPE.READ:
      return AI_TOOL_RISK_LEVEL.LOW
    case AI_TOOL_ACTION_TYPE.CREATE:
    case AI_TOOL_ACTION_TYPE.UPDATE:
      return AI_TOOL_RISK_LEVEL.MEDIUM
    case AI_TOOL_ACTION_TYPE.DELETE:
    case AI_TOOL_ACTION_TYPE.SEND:
    case AI_TOOL_ACTION_TYPE.EXTERNAL_ACTION:
      return AI_TOOL_RISK_LEVEL.HIGH
    default:
      return AI_TOOL_RISK_LEVEL.MEDIUM
  }
}
