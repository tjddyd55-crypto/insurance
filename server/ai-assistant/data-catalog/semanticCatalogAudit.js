import {
  AI_SEMANTIC_MANAGED_TABLES,
  listAiGenericCustomerReadFields,
  listAiSemanticFields,
  summarizeAiSemanticCatalog,
} from '../../../shared/ai-assistant/semanticDataCatalog.js'
import { getCustomerGenericRelation } from '../../../shared/ai-assistant/customer-query/customerGenericRelationCatalog.js'

function storageKey(table, column) {
  return `${table}.${column}`
}

export function auditSemanticCatalogAgainstDatabaseCatalog(databaseCatalog) {
  const semanticFields = listAiSemanticFields()
  const physical = new Set()
  const physicalByTable = new Map()

  for (const table of databaseCatalog?.tables ?? []) {
    const tableName = String(table.tableName ?? '')
    const columns = new Set((table.columns ?? []).map((c) => String(c.columnName ?? '')))
    physicalByTable.set(tableName, columns)
    for (const column of columns) {
      physical.add(storageKey(tableName, column))
    }
  }

  const semanticStorage = new Set(
    semanticFields.map((f) => storageKey(f.storage.table, f.storage.column)),
  )

  const missingDefinitions = []
  for (const tableName of AI_SEMANTIC_MANAGED_TABLES) {
    const columns = physicalByTable.get(tableName) ?? new Set()
    for (const column of columns) {
      const key = storageKey(tableName, column)
      if (!semanticStorage.has(key)) {
        missingDefinitions.push({
          code: 'SEMANTIC_DEFINITION_MISSING',
          table: tableName,
          column,
          storageKey: key,
        })
      }
    }
  }

  const missingStorage = []
  for (const semantic of semanticFields) {
    const key = storageKey(semantic.storage.table, semantic.storage.column)
    if (!physical.has(key)) {
      missingStorage.push({
        code: 'SEMANTIC_STORAGE_MISSING',
        semanticKey: semantic.key,
        table: semantic.storage.table,
        column: semantic.storage.column,
        storageKey: key,
      })
    }
  }

  const missingGenericRelations = []
  for (const semantic of listAiGenericCustomerReadFields()) {
    if (!getCustomerGenericRelation(semantic.storage.table)) {
      missingGenericRelations.push({
        code: 'SEMANTIC_RELATION_MISSING',
        semanticKey: semantic.key,
        table: semantic.storage.table,
      })
    }
  }

  const queryKeySeen = new Map()
  const duplicateQueryKeys = []
  for (const semantic of semanticFields) {
    const queryKey = semantic.query?.key
    if (!queryKey) continue
    if (queryKeySeen.has(queryKey)) {
      duplicateQueryKeys.push({
        code: 'SEMANTIC_QUERY_KEY_DUPLICATE',
        queryKey,
        semanticKeys: [queryKeySeen.get(queryKey), semantic.key],
      })
    } else {
      queryKeySeen.set(queryKey, semantic.key)
    }
  }

  return {
    catalog: summarizeAiSemanticCatalog(),
    database: {
      tableCount: Number(databaseCatalog?.tableCount ?? 0),
      columnCount: Number(databaseCatalog?.columnCount ?? 0),
    },
    managedTableCount: AI_SEMANTIC_MANAGED_TABLES.length,
    missingDefinitionCount: missingDefinitions.length,
    missingStorageCount: missingStorage.length,
    duplicateQueryKeyCount: duplicateQueryKeys.length,
    missingGenericRelationCount: missingGenericRelations.length,
    ok:
      missingDefinitions.length === 0 &&
      missingStorage.length === 0 &&
      duplicateQueryKeys.length === 0 &&
      missingGenericRelations.length === 0,
    issues: [
      ...missingDefinitions,
      ...missingStorage,
      ...duplicateQueryKeys,
      ...missingGenericRelations,
    ],
  }
}
