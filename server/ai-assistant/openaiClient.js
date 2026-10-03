import OpenAI from 'openai'

import { assertOpenAiReady, getOpenAiConfig } from './openaiConfig.js'

function mapOpenAiError(error) {
  const status = Number(error?.status) || 0
  const code = String(error?.code ?? error?.error?.code ?? '').toLowerCase()
  if (status === 401 || code.includes('invalid_api_key')) {
    return Object.assign(new Error('OPENAI_AUTH_FAILED'), { code: 'OPENAI_AUTH_FAILED', status: 502 })
  }
  if (status === 429) {
    return Object.assign(new Error('OPENAI_RATE_LIMIT'), { code: 'OPENAI_RATE_LIMIT', status: 429 })
  }
  if (status === 404 || code.includes('model_not_found')) {
    return Object.assign(new Error('OPENAI_MODEL_UNAVAILABLE'), { code: 'OPENAI_MODEL_UNAVAILABLE', status: 502 })
  }
  if (error?.name === 'AbortError') {
    return Object.assign(new Error('OPENAI_TIMEOUT'), { code: 'OPENAI_TIMEOUT', status: 504 })
  }
  return Object.assign(new Error('OPENAI_REQUEST_FAILED'), {
    code: 'OPENAI_REQUEST_FAILED',
    status: status >= 400 && status < 600 ? status : 502,
    causeCode: code || undefined,
  })
}

/**
 * @param {object} params
 * @param {string} params.developerInstructions
 * @param {string} params.userInput
 * @param {object} [params.jsonSchema]
 */
export async function callOpenAiResponses({ developerInstructions, userInput, jsonSchema }, env = process.env) {
  const cfg = assertOpenAiReady(env)
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: cfg.timeoutMs })
  const started = Date.now()

  const body = {
    model: cfg.model,
    input: [
      { role: 'developer', content: developerInstructions },
      { role: 'user', content: userInput },
    ],
    reasoning: { effort: cfg.reasoningEffort },
  }
  if (jsonSchema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: jsonSchema.name,
        schema: jsonSchema.schema,
        strict: true,
      },
    }
  }

  try {
    const response = await client.responses.create(body)
    const outputText =
      response.output_text ??
      response.output
        ?.flatMap((item) => item.content ?? [])
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text)
        .join('') ??
      ''

    const usage = response.usage ?? {}
    return {
      outputText,
      usage: {
        model: cfg.model,
        inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? null,
        outputTokens: usage.output_tokens ?? usage.completion_tokens ?? null,
        cachedTokens: usage.input_tokens_details?.cached_tokens ?? null,
        durationMs: Date.now() - started,
        requestId: response.id ?? null,
      },
    }
  } catch (error) {
    throw mapOpenAiError(error)
  }
}

/** Development connectivity smoke — 비개인정보 synthetic prompt only */
export async function runOpenAiConnectivitySmoke(env = process.env) {
  const result = await callOpenAiResponses(
    {
      developerInstructions: 'Reply with exactly the user phrase and nothing else.',
      userInput: 'Return exactly: ONEFC_OPENAI_OK',
    },
    env,
  )
  const ok = String(result.outputText ?? '').includes('ONEFC_OPENAI_OK')
  return { pass: ok, usage: result.usage }
}
