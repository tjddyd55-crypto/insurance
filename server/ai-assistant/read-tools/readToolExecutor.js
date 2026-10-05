import { listClaimsForAssistant } from './claimReadService.js'
import { listRecentConsultationsForAssistant } from './consultationReadService.js'
import { listCustomerFilesForAssistant } from './customerFilesReadService.js'
import { listCustomersForAssistant } from './customerListReadService.js'
import { getCustomerForAssistant, searchCustomersForAssistant } from './customerReadService.js'
import { listScheduleForAssistant } from './scheduleReadService.js'
import { listTodosForAssistant } from './todoReadService.js'
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
    case 'customer.files.list': {
      const result = await listCustomerFilesForAssistant(pool, req, params.customerId)
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    case 'task.list': {
      const result = await listTodosForAssistant(pool, req, { due: params.due ?? 'today' })
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    case 'schedule.list': {
      const result = await listScheduleForAssistant(pool, req, { day: params.day ?? 'today' })
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    case 'claim.list': {
      const result = await listClaimsForAssistant(pool, req, {
        pending: params.pending ?? false,
        customerId: params.customerId,
        limit: params.limit ?? 15,
      })
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    case 'customer.list': {
      const result = await listCustomersForAssistant(pool, req, {
        limit: params.limit ?? 20,
        countOnly: params.countOnly ?? false,
      })
      return { toolKey: input.toolKey, ...result, durationMs: Date.now() - started }
    }
    default:
      throw Object.assign(new Error('AI_TOOL_NOT_AVAILABLE'), { code: 'AI_TOOL_NOT_AVAILABLE', status: 503 })
  }
}
