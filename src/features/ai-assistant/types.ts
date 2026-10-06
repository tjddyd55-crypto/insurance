export type AiToolImplementationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'BLOCKED'
export type AiToolQaStatus = 'NOT_TESTED' | 'TESTING' | 'PASSED' | 'FAILED'
export type AiToolBaseFeatureStatus = 'AVAILABLE' | 'PARTIAL' | 'NOT_AVAILABLE'
export type AiToolActionType = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SEND' | 'EXTERNAL_ACTION'
export type AiToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface AiToolDefinition {
  key: string
  category: string
  name: string
  description: string
  actionType: AiToolActionType
  riskLevel: AiToolRiskLevel
  requiredPermission: string | null
  requiresConfirmation: boolean
  baseFeatureStatus: AiToolBaseFeatureStatus
  implementationStatus: AiToolImplementationStatus
  qaStatus: AiToolQaStatus
  productionEnabled: boolean
  serviceBinding: string | null
  phase: number
  priority: number
  version: string
  updatedAt: string
}

export interface AiToolRegistrySummary {
  total: number
  baseFeatureExists: number
  aiNotStarted: number
  aiInProgress: number
  aiConnected: number
  qaNeeded: number
  qaPass: number
  productionOn: number
  qaFailed: number
  blocked: number
  aiConnectionRate: { connected: number; total: number }
  productionReadyRate: { ready: number; total: number }
}

export interface AiToolRegistryCategoryRow {
  category: string
  total: number
  baseFeatureExists: number
  aiConnected: number
  qaPass: number
  productionOn: number
  blocked: number
}

export interface AiToolRegistryResponse {
  registryVersion: string
  registryUpdatedAt: string
  categories: string[]
  summary: AiToolRegistrySummary
  summaryByCategory: AiToolRegistryCategoryRow[]
  tools: AiToolDefinition[]
}


export type AiImprovementIssueType =
  | 'DATA_FIELD_NOT_DEFINED'
  | 'TOOL_NOT_WIRED'
  | 'QUERY_OPERATOR_NOT_SUPPORTED'
  | 'PERMISSION_BLOCKED'
  | 'EXECUTION_FAILED'

export type AiImprovementStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED'

export interface AiImprovementItem {
  id: number
  canonicalKey: string
  issueType: AiImprovementIssueType
  domain: string
  fieldKey: string | null
  toolKey: string | null
  requestedAction: string | null
  sampleRequestText: string
  lastRequestText: string
  occurrenceCount: number
  status: AiImprovementStatus
  lastErrorCode: string | null
  lastErrorMessage: string | null
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt: string | null
}

export interface AiDatabaseCatalogColumn {
  columnName: string
  dataType: string
  udtName: string
  nullable: boolean
  hasDefault: boolean
  foreignKey: { table: string; column: string } | null
}

export interface AiDatabaseCatalogTable {
  tableName: string
  columns: AiDatabaseCatalogColumn[]
}

export interface AiDatabaseCatalog {
  schema: string
  generatedAt: string
  tableCount: number
  columnCount: number
  foreignKeyCount: number
  tables: AiDatabaseCatalogTable[]
}
