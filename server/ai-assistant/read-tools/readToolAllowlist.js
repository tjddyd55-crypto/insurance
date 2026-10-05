import { loadAiToolRegistry } from '../../../shared/ai-assistant/registry.js'

/** Read-only tools wired in Phase 1 assistant orchestrator */
export const READ_TOOL_ALLOWLIST = new Set([
  'customer.search',
  'customer.get',
  'customer.list',
  'consultation.recent',
  'task.list',
  'schedule.list',
  'claim.list',
])

export function isReadToolCallable(toolKey) {
  const key = String(toolKey ?? '').trim()
  if (!READ_TOOL_ALLOWLIST.has(key)) {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  const tool = loadAiToolRegistry().find((t) => t.key === key)
  if (!tool) {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  if (tool.actionType !== 'READ' && tool.actionType !== 'QUERY') {
    return { ok: false, code: 'AI_TOOL_NOT_READ' }
  }
  if (tool.productionEnabled) {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  return { ok: true, tool }
}
