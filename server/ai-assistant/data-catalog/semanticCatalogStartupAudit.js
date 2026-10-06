import { getDatabaseCatalog } from './databaseCatalogService.js'
import { auditSemanticCatalogAgainstDatabaseCatalog } from './semanticCatalogAudit.js'
import { recordAiImprovement } from '../improvement/improvementService.js'

export async function runSemanticCatalogStartupAudit(pool) {
  const databaseCatalog = await getDatabaseCatalog(pool, { force: true })
  const audit = auditSemanticCatalogAgainstDatabaseCatalog(databaseCatalog)

  console.info('[ai-semantic-catalog-audit]', {
    ok: audit.ok,
    managedTableCount: audit.managedTableCount,
    semanticFieldCount: audit.catalog.fieldCount,
    missingDefinitionCount: audit.missingDefinitionCount,
    missingStorageCount: audit.missingStorageCount,
    duplicateQueryKeyCount: audit.duplicateQueryKeyCount,
    missingGenericRelationCount: audit.missingGenericRelationCount,
  })

  for (const issue of audit.issues) {
    console.warn('[ai-semantic-catalog-issue]', issue)
    if (
      issue.code === 'SEMANTIC_DEFINITION_MISSING' ||
      issue.code === 'SEMANTIC_STORAGE_MISSING' ||
      issue.code === 'SEMANTIC_RELATION_MISSING'
    ) {
      try {
        await recordAiImprovement(pool, {
          issueType: 'DATA_FIELD_NOT_DEFINED',
          domain: 'SEMANTIC_DATA_CATALOG',
          fieldKey: issue.storageKey ?? issue.semanticKey ?? null,
          requestedAction: 'CATALOG_AUDIT',
          requestText: 'startup semantic catalog audit',
          errorCode: issue.code,
          errorMessage:
            issue.code === 'SEMANTIC_DEFINITION_MISSING'
              ? `DB field ${issue.storageKey} has no semantic definition`
              : issue.code === 'SEMANTIC_RELATION_MISSING'
                ? `Semantic field ${issue.semanticKey} has no customer generic relation for table ${issue.table}`
                : `Semantic field ${issue.semanticKey} points to missing DB field ${issue.storageKey}`,
          metadata: issue,
        })
      } catch (error) {
        console.error('[ai-semantic-catalog-improvement-record-failed]', error?.message ?? error)
      }
    }
  }

  return audit
}
