import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getOpenAiConfig, getOpenAiDiagnostics } from './openaiConfig.js'

describe('openai config', () => {
  it('disabled when OPENAI_ENABLED false', () => {
    const cfg = getOpenAiConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-6.1-sol',
      OPENAI_ENABLED: 'false',
      RAILWAY_ENVIRONMENT: 'development',
    })
    assert.equal(cfg.enabled, false)
  })

  it('diagnostics never exposes key value', () => {
    const diag = getOpenAiDiagnostics({
      OPENAI_API_KEY: 'sk-secret',
      OPENAI_MODEL: 'gpt-6.1-sol',
      OPENAI_ENABLED: 'true',
      RAILWAY_ENVIRONMENT: 'development',
    })
    assert.equal(diag.OPENAI_API_KEY, 'PRESENT')
    assert.equal(diag.OPENAI_MODEL, 'gpt-6.1-sol')
  })

  it('disabled on production without explicit allow', () => {
    const cfg = getOpenAiConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-6.1-sol',
      OPENAI_ENABLED: 'true',
      RAILWAY_ENVIRONMENT: 'production',
    })
    assert.equal(cfg.enabled, false)
  })
})
