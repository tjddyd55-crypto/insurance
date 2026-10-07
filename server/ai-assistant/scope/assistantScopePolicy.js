function parseEnvBool(value, defaultValue = false) {
  if (value == null || String(value).trim() === '') {
    return defaultValue
  }
  const s = String(value).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export const AI_ASSISTANT_SCOPE = Object.freeze({
  READ_ONLY_BUSINESS: 'READ_ONLY_BUSINESS',
  FULL: 'FULL',
})

const SCOPE_LIMIT_MESSAGE =
  '현재 AI 비서는 ONE FC 고객·상담·일정·청구 조회 기능 중심으로 제공됩니다. 조회나 업무 관련 요청을 말씀해 주세요.'

const WRITE_BLOCKED_MESSAGE =
  '현재 AI 비서는 조회 기능부터 제공 중이며, 해당 변경 작업은 아직 연결되지 않았습니다.'

/**
 * DEV-first read-only assistant scope (Production unchanged unless explicitly set).
 * @param {object} [env]
 */
export function getAssistantScopePolicy(env = process.env) {
  const raw = String(env.AI_ASSISTANT_SCOPE ?? '').trim()
  const readOnlyBusinessEnabled =
    raw === AI_ASSISTANT_SCOPE.READ_ONLY_BUSINESS ||
    (raw === '' && parseEnvBool(env.AI_ASSISTANT_READ_ONLY_DEFAULT, true))

  return {
    scope: readOnlyBusinessEnabled ? AI_ASSISTANT_SCOPE.READ_ONLY_BUSINESS : AI_ASSISTANT_SCOPE.FULL,
    readOnlyBusinessEnabled,
    scopeLimitMessage: SCOPE_LIMIT_MESSAGE,
    writeBlockedMessage: WRITE_BLOCKED_MESSAGE,
    allowFreeGeneralChat: !readOnlyBusinessEnabled,
  }
}

export function isOutOfScopeGeneralQuestion(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  if (/수도|뉴스|소설|영어 공부|주가|삼성전자/.test(t)) {
    return true
  }
  return false
}
