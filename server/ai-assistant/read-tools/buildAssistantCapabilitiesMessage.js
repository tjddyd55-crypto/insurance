import { AI_TOOL_IMPLEMENTATION_STATUS } from '../../../shared/ai-assistant/enums.js'
import { loadAiToolRegistry } from '../../../shared/ai-assistant/registry.js'
import { READ_TOOL_ALLOWLIST } from './readToolAllowlist.js'

const EXAMPLE_PROMPTS = [
  'AI테스트_홍길동 찾아줘',
  '그 사람 최근 상담 보여줘',
  '오늘 할 일 알려줘',
  '오늘 일정 보여줘',
  '미처리 청구 보여줘',
]

/**
 * @param {{ name: string }} tool
 */
function capabilityLabel(tool) {
  const name = String(tool.name ?? '').trim()
  return name || null
}

/**
 * @returns {{ text: string, implementedToolCount: number, toolKeys: string[] }}
 */
export function buildAssistantCapabilitiesMessage() {
  const tools = loadAiToolRegistry()
    .filter(
      (t) =>
        READ_TOOL_ALLOWLIST.has(t.key) &&
        t.implementationStatus === AI_TOOL_IMPLEMENTATION_STATUS.IMPLEMENTED &&
        (t.actionType === 'READ' || t.actionType === 'QUERY'),
    )
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))

  const labels = tools.map(capabilityLabel).filter(Boolean)
  const summary = summarizeLabels(labels)
  const examples = EXAMPLE_PROMPTS.slice(0, 5)
    .map((line) => `- ${line}`)
    .join('\n')

  return {
    text: `지금은 ${summary}.\n\n이렇게 말씀해 보세요:\n${examples}`,
    implementedToolCount: tools.length,
    toolKeys: tools.map((t) => t.key),
  }
}

/**
 * @param {string[]} labels
 */
function summarizeLabels(labels) {
  if (labels.length === 0) {
    return '조회 가능한 업무 기능을 준비 중입니다'
  }
  const customer = labels.filter((l) => l.includes('고객'))
  const rest = labels.filter((l) => !l.includes('고객'))
  const parts = []
  if (customer.length) {
    parts.push(customer.join(', '))
  }
  if (rest.length) {
    parts.push(rest.join(', '))
  }
  const joined = parts.join(', ')
  return `${joined} 등을 할 수 있어요`
}
