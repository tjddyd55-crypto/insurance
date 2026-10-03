import { loadAiToolRegistry } from '../../shared/ai-assistant/registry.js'

const PHASE_1B_OPENAI_TOOL_ALLOWLIST = new Set([
  'customer.import.file-analyze',
  'customer.import.sheet-select',
  'customer.import.column-map',
  'customer.import.normalize',
  'customer.import.duplicate-check',
  'customer.import.validation',
  'customer.import.preview',
])

export function isToolCallableByOrchestrator(toolKey) {
  const tools = loadAiToolRegistry()
  const tool = tools.find((t) => t.key === toolKey)
  if (!tool) {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  if (!PHASE_1B_OPENAI_TOOL_ALLOWLIST.has(toolKey)) {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  if (tool.implementationStatus !== 'IMPLEMENTED') {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  if (tool.productionEnabled) {
    return { ok: false, code: 'AI_TOOL_NOT_AVAILABLE' }
  }
  return { ok: true, tool }
}

export function listOrchestratorCallableTools() {
  return loadAiToolRegistry().filter((t) => {
    const check = isToolCallableByOrchestrator(t.key)
    return check.ok
  })
}
