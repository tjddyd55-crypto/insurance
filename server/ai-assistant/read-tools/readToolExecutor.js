import { listRecentConsultationsForAssistant } from './consultationReadService.js'
import { getCustomerForAssistant, searchCustomersForAssistant } from './customerReadService.js'
import { isReadToolCallable } from './readToolAllowlist.js'

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ toolKey: string, params: object }} input
 */
export async function executeReadTool(pool, req, input) {
  const gate = isReadToolCallable(input.toolKey)
  if (!gate.ok) {
    throw Object.assign(new Error('AI_TOOL_NOT_AVAILABLE'), { code: 'AI_TOOL_NOT_AVAILABLE', status: 503 })
  }

  const params = input.params ?? {}
  const started = Date.now()

  switch (input.toolKey) {
    case 'customer.search': {
      const q = String(params.query ?? params.name ?? '').trim()
      const result = await searchCustomersForAssistant(pool, req, { q, limit: params.limit ?? 10 })
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    case 'customer.get': {
      const customer = await getCustomerForAssistant(pool, req, params.customerId)
      return { toolKey: input.toolKey, customer, durationMs: Date.now() - started }
    }
    case 'consultation.recent': {
      const result = await listRecentConsultationsForAssistant(pool, req, {
        customerId: params.customerId,
        limit: params.limit ?? 3,
      })
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    case 'task.list':
    case 'schedule.list':
    case 'claim.list':
    case 'customer.list':
      return {
        toolKey: input.toolKey,
        notWired: true,
        durationMs: Date.now() - started,
      }
    default:
      throw Object.assign(new Error('AI_TOOL_NOT_AVAILABLE'), { code: 'AI_TOOL_NOT_AVAILABLE', status: 503 })
  }
}
