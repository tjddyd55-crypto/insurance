import { isProductionRuntime } from '../lib/crmUserBulkSmsConfig.js'

function parseEnvBool(value, defaultValue = false) {
  if (value == null || String(value).trim() === '') {
    return defaultValue
  }
  const s = String(value).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/**
 * OpenAI 설정 SSOT (server-only).
 * Production에서는 OPENAI_ENABLED 기본 false — 명시적 활성화 없으면 호출 차단.
 */
export function getOpenAiConfig(env = process.env) {
  const apiKey = String(env.OPENAI_API_KEY ?? '').trim()
  const model = String(env.OPENAI_MODEL ?? '').trim()
  const enabledFlag = parseEnvBool(env.OPENAI_ENABLED, false)
  const isProd = isProductionRuntime(env)
  const enabled = enabledFlag && apiKey.length > 0 && (!isProd || parseEnvBool(env.OPENAI_ALLOW_PRODUCTION, false))

  return {
    enabled,
    apiKeyPresent: apiKey.length > 0,
    model: model || null,
    reasoningEffort: String(env.OPENAI_REASONING_EFFORT ?? 'medium').trim() || 'medium',
    timeoutMs: Number(env.OPENAI_TIMEOUT_MS) > 0 ? Number(env.OPENAI_TIMEOUT_MS) : 60_000,
    isProductionRuntime: isProd,
  }
}

export function getOpenAiDiagnostics(env = process.env) {
  const cfg = getOpenAiConfig(env)
  const enabledFlagParsed = parseEnvBool(env.OPENAI_ENABLED, false)
  return {
    enabledFlagParsed,
    runtimeEnabled: cfg.enabled,
    OPENAI_ENABLED: cfg.enabled,
    OPENAI_API_KEY: cfg.apiKeyPresent ? 'PRESENT' : 'MISSING',
    OPENAI_MODEL: cfg.model ?? 'MISSING',
    reasoningEffort: cfg.reasoningEffort,
    isProductionRuntime: cfg.isProductionRuntime,
  }
}

export function assertOpenAiReady(env = process.env) {
  const cfg = getOpenAiConfig(env)
  if (!cfg.enabled) {
    throw Object.assign(new Error('OPENAI_DISABLED'), { code: 'OPENAI_DISABLED', status: 503 })
  }
  if (!cfg.apiKeyPresent) {
    throw Object.assign(new Error('OPENAI_CONFIG_MISSING'), { code: 'OPENAI_CONFIG_MISSING', status: 503 })
  }
  if (!cfg.model) {
    throw Object.assign(new Error('OPENAI_CONFIG_MISSING'), { code: 'OPENAI_MODEL_MISSING', status: 503 })
  }
  return cfg
}
