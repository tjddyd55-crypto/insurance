import { describe, expect, it } from 'vitest'

import { filterAiTools, matchesStatusFilter } from './aiToolRegistryFilters'
import type { AiToolDefinition } from './types'

function sampleTool(overrides: Partial<AiToolDefinition> = {}): AiToolDefinition {
  return {
    key: 'sample.tool',
    category: 'CUSTOMER',
    name: '샘플',
    description: 'desc',
    actionType: 'READ',
    riskLevel: 'LOW',
    requiredPermission: null,
    requiresConfirmation: false,
    baseFeatureStatus: 'AVAILABLE',
    implementationStatus: 'NOT_STARTED',
    qaStatus: 'NOT_TESTED',
    productionEnabled: false,
    serviceBinding: 'GET /api/sample',
    phase: 0,
    priority: 0,
    version: '0.1.0',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('aiToolRegistryFilters', () => {
  it('filters by implementation status', () => {
    const tools = [
      sampleTool({ key: 'a', implementationStatus: 'NOT_STARTED' }),
      sampleTool({ key: 'b', implementationStatus: 'IMPLEMENTED', qaStatus: 'PASSED' }),
    ]
    const filtered = filterAiTools(tools, { status: 'implemented', category: 'all', search: '' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].key).toBe('b')
  })

  it('qa_needed matches implemented but not qa complete', () => {
    const tool = sampleTool({ implementationStatus: 'IMPLEMENTED', qaStatus: 'NOT_TESTED' })
    expect(matchesStatusFilter(tool, 'qa_needed')).toBe(true)
    expect(matchesStatusFilter({ ...tool, qaStatus: 'PASSED' }, 'qa_needed')).toBe(false)
  })

  it('search matches serviceBinding', () => {
    const tools = [sampleTool({ key: 'x', serviceBinding: 'gaCustomerExcelApi' })]
    expect(filterAiTools(tools, { status: 'all', category: 'all', search: 'excel' })).toHaveLength(1)
  })
})
