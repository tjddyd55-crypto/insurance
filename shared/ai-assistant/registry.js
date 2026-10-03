import { AI_TOOL_CATALOG_RAW } from './catalogRaw.js'
import {
  AI_TOOL_ACTION_TYPES,
  AI_TOOL_BASE_FEATURE_STATUSES,
  AI_TOOL_IMPLEMENTATION_STATUS,
  AI_TOOL_IMPLEMENTATION_STATUSES,
  AI_TOOL_QA_STATUS,
  AI_TOOL_QA_STATUSES,
  AI_TOOL_RISK_LEVELS,
} from './enums.js'
import { defaultRequiresConfirmation, defaultRiskLevel } from './toolDefaults.js'

export const AI_TOOL_REGISTRY_VERSION = '0.1.0'
export const AI_TOOL_REGISTRY_UPDATED_AT = '2026-10-03T00:00:00.000Z'

const VALID_CATEGORIES = new Set(AI_TOOL_CATALOG_RAW.map((t) => t.category))

/**
 * @typedef {object} AiToolDefinitionInput
 * @property {string} key
 * @property {string} category
 * @property {string} name
 * @property {string} description
 * @property {string} actionType
 * @property {string} baseFeatureStatus
 * @property {string} [implementationStatus]
 * @property {string} [qaStatus]
 * @property {boolean} [productionEnabled]
 * @property {string|null} [serviceBinding]
 * @property {string} [riskLevel]
 * @property {string|null} [requiredPermission]
 * @property {boolean} [requiresConfirmation]
 * @property {number} [phase]
 * @property {number} [priority]
 */

/**
 * @typedef {AiToolDefinitionInput & {
 *   implementationStatus: string
 *   qaStatus: string
 *   productionEnabled: boolean
 *   serviceBinding: string|null
 *   riskLevel: string
 *   requiredPermission: string|null
 *   requiresConfirmation: boolean
 *   version: string
 *   updatedAt: string
 * }} AiToolDefinition
 */

function normalizeTool(input) {
  const actionType = String(input.actionType ?? '')
  if (!AI_TOOL_ACTION_TYPES.includes(actionType)) {
    throw new Error(`[ai-tool-registry] invalid actionType for ${input.key}: ${actionType}`)
  }
  const baseFeatureStatus = String(input.baseFeatureStatus ?? '')
  if (!AI_TOOL_BASE_FEATURE_STATUSES.includes(baseFeatureStatus)) {
    throw new Error(`[ai-tool-registry] invalid baseFeatureStatus for ${input.key}`)
  }
  const implementationStatus = input.implementationStatus ?? AI_TOOL_IMPLEMENTATION_STATUS.NOT_STARTED
  if (!AI_TOOL_IMPLEMENTATION_STATUSES.includes(implementationStatus)) {
    throw new Error(`[ai-tool-registry] invalid implementationStatus for ${input.key}`)
  }
  const qaStatus = input.qaStatus ?? AI_TOOL_QA_STATUS.NOT_TESTED
  if (!AI_TOOL_QA_STATUSES.includes(qaStatus)) {
    throw new Error(`[ai-tool-registry] invalid qaStatus for ${input.key}`)
  }
  const category = String(input.category ?? '')
  if (!VALID_CATEGORIES.has(category) && AI_TOOL_CATALOG_RAW.length > 0) {
    // category 는 catalog 내 정의된 값만 허용 (신규 category 는 catalogRaw 에 추가)
    if (!AI_TOOL_CATALOG_RAW.some((t) => t.category === category)) {
      throw new Error(`[ai-tool-registry] unknown category for ${input.key}: ${category}`)
    }
  }
  const riskLevel = input.riskLevel ?? defaultRiskLevel(actionType)
  if (!AI_TOOL_RISK_LEVELS.includes(riskLevel)) {
    throw new Error(`[ai-tool-registry] invalid riskLevel for ${input.key}`)
  }
  return {
    key: String(input.key),
    category,
    name: String(input.name),
    description: String(input.description ?? ''),
    actionType,
    riskLevel,
    requiredPermission: input.requiredPermission ?? null,
    requiresConfirmation: input.requiresConfirmation ?? defaultRequiresConfirmation(actionType),
    baseFeatureStatus,
    implementationStatus,
    qaStatus,
    productionEnabled: Boolean(input.productionEnabled),
    serviceBinding: input.serviceBinding ?? null,
    phase: typeof input.phase === 'number' ? input.phase : 0,
    priority: typeof input.priority === 'number' ? input.priority : 0,
    version: AI_TOOL_REGISTRY_VERSION,
    updatedAt: AI_TOOL_REGISTRY_UPDATED_AT,
  }
}

let cachedTools = null

export function loadAiToolRegistry() {
  if (cachedTools) {
    return cachedTools
  }
  const seen = new Set()
  const tools = AI_TOOL_CATALOG_RAW.map((raw) => {
    const tool = normalizeTool(raw)
    if (seen.has(tool.key)) {
      throw new Error(`[ai-tool-registry] duplicate tool key: ${tool.key}`)
    }
    seen.add(tool.key)
    return tool
  })
  cachedTools = tools
  return tools
}

export function listAiToolCategories() {
  const tools = loadAiToolRegistry()
  const categories = [...new Set(tools.map((t) => t.category))].sort()
  return categories
}

/**
 * @param {AiToolDefinition[]} tools
 */
export function summarizeAiToolRegistry(tools = loadAiToolRegistry()) {
  const total = tools.length
  const baseFeatureExists = tools.filter(
    (t) => t.baseFeatureStatus === 'AVAILABLE' || t.baseFeatureStatus === 'PARTIAL',
  ).length
  const aiNotStarted = tools.filter((t) => t.implementationStatus === 'NOT_STARTED').length
  const aiInProgress = tools.filter((t) => t.implementationStatus === 'IN_PROGRESS').length
  const aiConnected = tools.filter((t) => t.implementationStatus === 'IMPLEMENTED').length
  const qaNeeded = tools.filter(
    (t) =>
      t.implementationStatus === 'IMPLEMENTED' &&
      (t.qaStatus === 'NOT_TESTED' || t.qaStatus === 'TESTING'),
  ).length
  const qaPass = tools.filter((t) => t.qaStatus === 'PASSED').length
  const productionOn = tools.filter((t) => t.productionEnabled).length
  const qaFailed = tools.filter((t) => t.qaStatus === 'FAILED').length
  const blocked = tools.filter((t) => t.implementationStatus === 'BLOCKED').length

  const productionReady = tools.filter(
    (t) => t.implementationStatus === 'IMPLEMENTED' && t.qaStatus === 'PASSED' && t.productionEnabled,
  ).length

  return {
    total,
    baseFeatureExists,
    aiNotStarted,
    aiInProgress,
    aiConnected,
    qaNeeded,
    qaPass,
    productionOn,
    qaFailed,
    blocked,
    aiConnectionRate: { connected: aiConnected, total },
    productionReadyRate: { ready: productionReady, total },
  }
}

/**
 * @param {AiToolDefinition[]} tools
 */
export function summarizeAiToolRegistryByCategory(tools = loadAiToolRegistry()) {
  const byCategory = new Map()
  for (const tool of tools) {
    if (!byCategory.has(tool.category)) {
      byCategory.set(tool.category, [])
    }
    byCategory.get(tool.category).push(tool)
  }
  const rows = []
  for (const category of [...byCategory.keys()].sort()) {
    const list = byCategory.get(category)
    rows.push({
      category,
      total: list.length,
      baseFeatureExists: list.filter((t) => t.baseFeatureStatus === 'AVAILABLE' || t.baseFeatureStatus === 'PARTIAL')
        .length,
      aiConnected: list.filter((t) => t.implementationStatus === 'IMPLEMENTED').length,
      qaPass: list.filter((t) => t.qaStatus === 'PASSED').length,
      productionOn: list.filter((t) => t.productionEnabled).length,
      blocked: list.filter((t) => t.implementationStatus === 'BLOCKED').length,
    })
  }
  return rows
}

export function validateAiToolRegistry() {
  loadAiToolRegistry()
  return true
}
