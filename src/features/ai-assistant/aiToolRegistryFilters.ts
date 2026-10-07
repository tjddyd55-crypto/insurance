import type { AiToolDefinition } from './types'
import type { StatusFilterKey } from './labels'

export function matchesStatusFilter(tool: AiToolDefinition, filter: StatusFilterKey): boolean {
  if (filter === 'all') {
    return true
  }
  switch (filter) {
    case 'not_started':
      return tool.implementationStatus === 'NOT_STARTED'
    case 'in_progress':
      return tool.implementationStatus === 'IN_PROGRESS'
    case 'implemented':
      return tool.implementationStatus === 'IMPLEMENTED'
    case 'qa_needed':
      return (
        tool.implementationStatus === 'IMPLEMENTED' &&
        (tool.qaStatus === 'NOT_TESTED' || tool.qaStatus === 'TESTING')
      )
    case 'qa_pass':
      return tool.qaStatus === 'PASSED'
    case 'production_on':
      return tool.productionEnabled
    case 'qa_failed':
      return tool.qaStatus === 'FAILED'
    case 'blocked':
      return tool.implementationStatus === 'BLOCKED'
    default:
      return true
  }
}

export function matchesSearchQuery(tool: AiToolDefinition, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) {
    return true
  }
  const hay = [
    tool.name,
    tool.key,
    tool.description,
    tool.serviceBinding ?? '',
    tool.category,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function filterAiTools(
  tools: AiToolDefinition[],
  options: { status: StatusFilterKey; category: string; search: string },
): AiToolDefinition[] {
  return tools.filter((tool) => {
    if (options.category && options.category !== 'all' && tool.category !== options.category) {
      return false
    }
    if (!matchesStatusFilter(tool, options.status)) {
      return false
    }
    if (!matchesSearchQuery(tool, options.search)) {
      return false
    }
    return true
  })
}
